"""Exercise the actual production baseline and development build on a temporary localhost origin.
No real account, data, installed app, or production service is used.
"""
import functools
import http.server
import json
import os
import pathlib
import subprocess
import tempfile
import threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = "9afb6d5c37ae3a758599dcd2e81a92490c04b0b8"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(self.server.source), **kwargs)
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *args):
        pass

def state(page):
    return page.evaluate("""async () => (await import('./storage.js')).load()""")

def wait_saved(page):
    page.locator("#status").get_by_text("Saved locally", exact=True).wait_for()

def ready_worker(page):
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    return page.evaluate("navigator.serviceWorker.ready.then(r => r.active.state)")

with tempfile.TemporaryDirectory(prefix="liftlog-upgrade-") as tmp:
    baseline = pathlib.Path(tmp) / "baseline"
    baseline.mkdir()
    archive = subprocess.check_output(["git", "-C", str(ROOT), "archive", BASE])
    subprocess.run(["tar", "-xf", "-", "-C", str(baseline)], input=archive, check=True)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    server.source = baseline
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}/"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
            context = browser.new_context(accept_downloads=True, viewport={"width":390,"height":844})
            page = context.new_page()
            page.set_default_timeout(15000)
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            # Construct deterministic synthetic history using the real V2.0 data model.
            page.goto(url)
            wait_saved(page)
            ready_worker(page)
            page.evaluate("""async () => {
                const C=await import('./core.js'), S=await import('./storage.js');
                const d=C.newDB(), date=C.dayKey(), w=C.blankWeek();
                const activity={kind:'lift',slot:'lift',title:'Synthetic planned workout',exercises:[{name:'Lat pulldown',sets:2,unit:'lb'}]};
                w[C.weekday(date)].activities=[activity];
                d.events.push(C.eventFor(d.events,'schedule','schedule',{versions:[{id:'synthetic-schedule',effective:'2020-01-01',weekly:w}],overrides:{}}));
                let old=C.startSession(C.addDays(date,-2),activity,{scheduled:false});
                old.startedAt=new Date(Date.now()-172800000).toISOString();
                old.completedAt=new Date(Date.now()-172700000).toISOString();
                old.status='completed';old.exercises[0].sets[0].weight='80';old.exercises[0].sets[0].reps='12';old.exercises[0].sets[0].done=true;
                d.events.push(C.eventFor(d.events,'session',old.key,old));
                d.draft=C.startSession(date,activity);d.draft.exercises[0].sets[0].weight='90';d.draft.exercises[0].sets[0].reps='10';d.draft.exercises[0].sets[0].done=true;
                await S.save(d);
            }""")
            page.reload()
            page.get_by_role("heading", name="Synthetic planned workout").wait_for()
            wait_saved(page)
            original=state(page)
            assert original["draft"]["exercises"][0]["sets"][0]["weight"]=="90"
            print("PASS V2.0 synthetic history and active workout")
            # Serve development source from exactly the same isolated origin.
            server.source=ROOT
            page.evaluate("""async () => {const r=await navigator.serviceWorker.getRegistration();await r.update()}""")
            page.wait_for_function("navigator.serviceWorker.getRegistration().then(r => !!r.waiting)")
            page.evaluate("""async () => {
                const r=await navigator.serviceWorker.getRegistration();
                await new Promise((resolve,reject)=>{
                    const timeout=setTimeout(()=>reject(Error('Worker activation timed out')),12000);
                    navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timeout);resolve()},{once:true});
                    r.waiting.postMessage('SKIP_WAITING');
                })
            }""")
            page.reload()
            page.locator(".dashboard-home").wait_for()
            page.get_by_role("heading",name="Synthetic planned workout").wait_for()
            wait_saved(page)
            upgraded=state(page)
            assert upgraded["events"]==original["events"], "Upgrade altered historical events"
            assert upgraded["draft"]==original["draft"], "Upgrade altered active workout"
            assert upgraded["prefs"]==original["prefs"], "Upgrade altered preferences"
            assert upgraded["extension"]["events"]==[]
            print("PASS actual V2.0 to V2.1 service worker upgrade preserves database")
            # Verify actual offline navigation and local writes.
            context.set_offline(True)
            page.reload()
            page.get_by_role("heading",name="Synthetic planned workout").wait_for()
            page.locator('[data-set="0:1:weight"]').fill("95")
            page.locator('[data-set="0:1:reps"]').fill("9")
            page.locator('[data-act="done"][data-i="0"][data-j="1"]').click()
            wait_saved(page)
            page.reload()
            page.get_by_role("heading",name="Synthetic planned workout").wait_for()
            assert page.locator('[data-set="0:1:weight"]').input_value()=="95"
            assert state(page)["draft"]["exercises"][0]["sets"][1]["done"] is True
            print("PASS offline reload, workout edit and persistence")
            # Export through the actual UI; import in a clean, separate browser context.
            page.locator('[data-act="nav"][data-v="settings"]').click()
            with page.expect_download() as download:
                page.locator('[data-act="export-json"]').click()
            backup=pathlib.Path(tmp)/"synthetic-backup.json"
            download.value.save_as(backup)
            data=json.loads(backup.read_text())
            assert data["events"]==original["events"]
            assert data["config"]=={"clientId":"","sheetId":""}
            assert data["draft"]["exercises"][0]["sets"][1]["weight"]=="95"
            print("PASS offline complete JSON export without cloud configuration")
            clean=browser.new_context(viewport={"width":390,"height":844})
            recovered=clean.new_page()
            recovered.set_default_timeout(15000)
            recovered.on("pageerror",lambda e: errors.append(str(e)))
            recovered.on("dialog",lambda d: d.accept())
            recovered.goto(url)
            recovered.get_by_role("heading",name="Personal dashboard").wait_for()
            wait_saved(recovered)
            recovered.locator("#import-file").set_input_files(backup)
            recovered.get_by_role("heading",name="Synthetic planned workout").wait_for()
            wait_saved(recovered)
            restored=state(recovered)
            assert restored["events"]==data["events"]
            assert restored["draft"]==data["draft"]
            assert restored["extension"]["events"]==data["extension"]["events"]
            print("PASS recovery in clean browser context")
            recovered.locator("#import-file").set_input_files(backup)
            recovered.get_by_role("heading",name="Synthetic planned workout").wait_for()
            wait_saved(recovered)
            assert state(recovered)["events"]==data["events"]
            print("PASS repeated backup import does not duplicate history")
            assert not errors, errors
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
