"""Package pinned, same-origin OCR assets without executing npm package scripts.
Run on a network-enabled build machine. No credentials or personal data are read.
"""
import hashlib
import json
import pathlib
import shutil
import subprocess
import tarfile
import tempfile

ROOT=pathlib.Path(__file__).resolve().parents[1]
PACKAGES=["tesseract.js@6.0.1","tesseract.js-core@6.0.0","@tesseract.js-data/eng@1.0.0"]
def pack(spec, directory):
    result=subprocess.run(["npm","pack",spec,"--ignore-scripts","--json","--pack-destination",str(directory)],check=True,capture_output=True,text=True)
    return directory/json.loads(result.stdout)[0]["filename"]
def copy_member(tar,name,destination):
    member=tar.getmember(name)
    if not member.isfile():raise ValueError("Unexpected package member: "+name)
    destination.parent.mkdir(parents=True,exist_ok=True)
    with tar.extractfile(member) as source, destination.open("wb") as output:
        shutil.copyfileobj(source,output)
def license_files(tar,dest):
    for member in tar.getmembers():
        if member.isfile() and "/" not in member.name.removeprefix("package/") and member.name.split("/")[-1].upper().startswith(("LICENSE","NOTICE","COPYING")):
            copy_member(tar,member.name,dest/member.name.split("/")[-1])
with tempfile.TemporaryDirectory(prefix="dashboard-ocr-") as temp:
    tmp=pathlib.Path(temp); stage=tmp/"ocr-assets";stage.mkdir()
    for index,spec in enumerate(PACKAGES):
        with tarfile.open(pack(spec,tmp),"r:gz") as tar:
            license_files(tar,stage/"licenses"/str(index))
            if index==0:
                for name in ("tesseract.min.js","worker.min.js"):
                    copy_member(tar,"package/dist/"+name,stage/name)
            elif index==1:
                for suffix in ("","-simd","-lstm","-simd-lstm"):
                    for extension in (".wasm.js",".wasm"):
                        name="tesseract-core"+suffix+extension
                        copy_member(tar,"package/"+name,stage/"core"/name)
            else:
                names=[m.name for m in tar.getmembers() if m.isfile() and m.name.endswith("/eng.traineddata.gz")]
                preferred=[n for n in names if "/4.0.0_best_int/" in n]
                if not preferred:raise ValueError("Pinned English model not found: "+str(names))
                copy_member(tar,preferred[0],stage/"lang"/"eng.traineddata.gz")
    manifest={"packages":PACKAGES,"sha256":{str(p.relative_to(stage)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(stage.rglob("*")) if p.is_file()}}
    (stage/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    dest=ROOT/"ocr-assets"
    if dest.exists():shutil.rmtree(dest)
    shutil.copytree(stage,dest)
    print("OCR assets prepared:",len(manifest["sha256"]),"files")
