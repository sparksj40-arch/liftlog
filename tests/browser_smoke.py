import subprocess, time, pathlib, threading, http.server, functools
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1]
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url='https://liftlog.test/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']); page=b.new_page(viewport={'width':390,'height':844},service_workers='block');
 def route(r):
  from urllib.parse import urlparse
  path=urlparse(r.request.url).path.lstrip('/') or 'index.html'
  f=root/path
  if f.is_file(): r.fulfill(path=str(f))
  else: r.abort()
 page.route('https://liftlog.test/**',route);  errors=[]; dialogs=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:(dialogs.append(d.message),d.accept()))
 page.goto(url);page.get_by_role('heading',name='Personal dashboard').wait_for();print('PASS dashboard')
 page.get_by_role('button',name='Measurements Check-ins and history').click();page.locator('#assessment-date').fill('2026-11-29');page.locator('#assessment-date').dispatch_event('change');
 page.locator('[data-x="measurement-skip"][data-id="back"]').click();page.locator('[data-x="measurement-undo"][data-id="back"]').wait_for();page.locator('[data-x="measurement-undo"][data-id="back"]').click();page.locator('[data-x="measurement-skip"][data-id="back"]').wait_for();print('PASS skip and undo')
 page.locator('#m-waist-0').fill('36');page.locator('[data-x="measurement-record"][data-id="waist"]').click();page.get_by_text('Average: 36 in').wait_for();page.locator('#assessment-notes').fill('Synthetic note');page.locator('[data-x="assessment-notes"]').click();page.wait_for_timeout(200);assert page.locator('#assessment-notes').input_value()=='Synthetic note';print('PASS measurement and note')
 page.locator('#assessment-date').fill('2026-12-06');page.locator('#assessment-date').dispatch_event('change');page.locator('#m-chest-fold-0').fill('12');page.locator('#m-chest-fold-1').fill('14');page.locator('#m-chest-fold-2').fill('16');page.locator('[data-x="measurement-record"][data-id="chest-fold"]').click();page.get_by_text('Average: 14 mm').wait_for();print('PASS three readings')
 page.locator('.dashboard-home').click();page.get_by_role('button',name='Food log Supplemental nutrition records').click();page.locator('#food-description').fill('Synthetic meal');page.locator('#food-calories').fill('333');page.locator('#food-samsungCalories').fill('330');page.locator('[data-x="food-save"]').click();page.get_by_text('Synthetic meal',exact=True).wait_for();print('PASS food save')
 page.locator('.dashboard-home').click();page.get_by_role('button',name='LiftLog Training, recovery and progress').click();page.locator('[data-act="unscheduled"][data-kind="lift"]').click();page.locator('#exercise-search').fill('lat pulldown');page.locator('[data-x="picker-select"]').click();page.get_by_role('heading',name='Lat pulldown').wait_for();page.locator('[data-act="add-ex"]').click();page.locator('#exercise-search').fill('plank');page.locator('[data-x="picker-select"][data-bank="builtin:plank"]').click();page.get_by_role('heading',name='Plank',exact=True).wait_for();print('PASS workout exercise picker')
 page.reload();page.get_by_role('heading',name='Lat pulldown').wait_for();page.get_by_role('heading',name='Plank',exact=True).wait_for();print('PASS draft persists after reload')
 assert not errors,errors;assert not dialogs,dialogs
 b.close()
server.shutdown()
