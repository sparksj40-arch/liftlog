"""Create a static Pages-ready build from an explicit public-file allowlist.
Does not deploy, read application storage, upload data or change Git settings.
"""
import pathlib
import shutil
import tempfile
from verify_ocr import verify
ROOT=pathlib.Path(__file__).resolve().parents[1]
PUBLIC=("index.html","style.css","app.js","backup.js","ocr.js","gmail-discovery.js","extensions.js","extension-ui.js","share.js","calendar-sync.js","media-backup.js","planner.js","planner-ui.js","core.js","storage.js","cloud.js","sw.js","manifest.webmanifest","icon-192.png","icon-512.png","icon-maskable.png")
verify()
with tempfile.TemporaryDirectory(prefix="liftlog-release-") as tmp:
    stage=pathlib.Path(tmp)/"site";stage.mkdir()
    for name in PUBLIC:
        p=ROOT/name
        if p.is_symlink() or not p.is_file():raise ValueError("Missing public file: "+name)
        shutil.copyfile(p,stage/name)
    shutil.copytree(ROOT/"ocr-assets",stage/"ocr-assets")
    (stage/".nojekyll").touch()
    dest=ROOT/"_site"
    if dest.exists():
        if dest.is_symlink() or not dest.is_dir():raise ValueError("Unsafe output path")
        shutil.rmtree(dest)
    shutil.copytree(stage,dest)
print("PASS static site packaged (no secrets, test fixtures, or user records)")
