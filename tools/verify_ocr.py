"""Check the generated static OCR package for completeness, sizes and integrity."""
import hashlib
import json
import pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / "ocr-assets"
PACKAGES = ["tesseract.js@6.0.1", "tesseract.js-core@6.0.0", "@tesseract.js-data/eng@1.0.0"]
REQUIRED = {"tesseract.min.js", "worker.min.js", "lang/eng.traineddata.gz"}
REQUIRED.update("core/tesseract-core"+s+e for s in ("","-simd","-lstm","-simd-lstm") for e in (".wasm.js",".wasm"))
def verify():
    manifest = json.loads((ASSETS/"manifest.json").read_text())
    if manifest["packages"] != PACKAGES:
        raise ValueError("Unexpected OCR package versions")
    entries = manifest["sha256"]
    actual = {p.relative_to(ASSETS).as_posix() for p in ASSETS.rglob("*") if p.is_file() and p.name != "manifest.json"}
    if actual != set(entries) or not REQUIRED <= actual:
        raise ValueError("Missing or unexpected OCR assets")
    for name, digest in entries.items():
        p = ASSETS/name
        if p.is_symlink() or not p.is_file() or not 0 < p.stat().st_size <= 95*1024*1024:
            raise ValueError("Invalid OCR asset: "+name)
        if hashlib.sha256(p.read_bytes()).hexdigest() != digest:
            raise ValueError("OCR checksum mismatch: "+name)
    if not any(name.startswith("licenses/") for name in actual):
        raise ValueError("Missing OCR license notices")
    print("PASS OCR package completeness, versions and manifest integrity:",len(actual),"files")
if __name__=="__main__":
    verify()
