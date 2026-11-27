"""Real local OCR test using a synthetic image. No Google account or personal data."""
import functools
import http.server
import pathlib
import threading
import os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
server=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f"http://127.0.0.1:{server.server_port}/"
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        page=browser.new_page(service_workers="block")
        foreign=[]
        def route(r):
            if r.request.url.startswith(url):r.continue_()
            else:
                foreign.append(r.request.url)
                r.abort()
        page.route("**/*",route)
        page.goto(url)
        result=page.evaluate("""async () => {
          const {recognizePhoto}=await import('./ocr.js');
          const c=document.createElement('canvas');c.width=1000;c.height=240;
          const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,240);
          ctx.fillStyle='black';ctx.font='bold 60px sans-serif';
          ctx.fillText('BUY FURNACE FILTERS',30,95);ctx.fillText('WASH THE CAR',30,185);
          const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));
          return await recognizePhoto(blob);
        }""")
        normalized=" ".join(result.upper().split())
        assert "BUY FURNACE FILTERS" in normalized and "WASH THE CAR" in normalized,result
        assert not foreign,foreign
        browser.close()
        print("PASS actual local OCR with all external HTTP requests blocked")
finally:
    server.shutdown()
