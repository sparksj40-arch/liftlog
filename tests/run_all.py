"""Run local, synthetic-only verification. Never deploys or contacts Google."""
import pathlib
import subprocess
import sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
checks=[
    ("JavaScript syntax", ["node","--check"], sorted(ROOT.glob("*.js"))+sorted((ROOT/"tests").glob("*.js"))),
    ("Node regression tests", ["node","--test"], [sorted((ROOT/"tests").glob("*.test.js"))]),
    ("Browser smoke", [sys.executable,"-u"], [ROOT/"tests/browser_smoke.py"]),
    ("Browser upgrade and recovery", [sys.executable,"-u"], [ROOT/"tests/browser_upgrade.py"]),
]
results=[]
for name,command,items in checks:
    print(f"\n=== {name} ===",flush=True)
    ok=True
    for item in items:
        args=[str(x) for x in (item if isinstance(item,list) else [item])]
        try:
            r=subprocess.run(command+args,cwd=ROOT,timeout=240)
            ok &= r.returncode==0
        except (OSError,subprocess.TimeoutExpired) as e:
            print(f"FAIL {name}: {e}",flush=True)
            ok=False
    results.append((name,ok))
print("\n=== Consolidated results ===")
for name,ok in results:
    print(f"{'PASS' if ok else 'FAIL'} {name}")
sys.exit(0 if all(ok for _,ok in results) else 1)
