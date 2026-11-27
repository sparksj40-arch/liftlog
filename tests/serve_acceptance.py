"""Serve a local, isolated acceptance build. Does not authorize, sync, or deploy."""
import http.server
import functools
import pathlib
import sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
PORT=8765
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control","no-store")
        super().end_headers()
print("Isolated acceptance URL: http://localhost:8765/",flush=True)
print("Use a separate browser profile. Create a NEW test spreadsheet in the app. Never import real data or enter the production sheet ID.",flush=True)
print("Ctrl+C stops the server. This does not change GitHub Pages.",flush=True)
with http.server.ThreadingHTTPServer(("127.0.0.1",PORT),functools.partial(Handler,directory=str(ROOT))) as server:
    try:server.serve_forever()
    except KeyboardInterrupt:sys.exit(0)
