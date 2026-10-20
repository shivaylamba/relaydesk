#!/usr/bin/env python3
"""Start a standalone local RelayDesk workspace and its owned knowledge service."""
from pathlib import Path
import os,shutil,socket,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
if not (ROOT/'.env').exists():shutil.copy2(ROOT/'.env.example',ROOT/'.env');os.chmod(ROOT/'.env',0o600)
def run(args):subprocess.run(args,cwd=ROOT,check=True)
with socket.socket() as s:
 if s.connect_ex(('127.0.0.1',3410))==0:raise SystemExit('RelayDesk port 3410 is already in use. Open http://localhost:3410 or stop the owned process first.')
run([sys.executable,'scripts/openlore.py','setup'])
started=False
with socket.socket() as s:
 if s.connect_ex(('127.0.0.1',48180))!=0:run([sys.executable,'scripts/openlore.py','start']);started=True
 else:
  pidfile=ROOT/'.runtime/openlore.pid';args=subprocess.check_output(['ps','-p',pidfile.read_text().strip(),'-o','command='],text=True) if pidfile.exists() else ''
  if str(ROOT/'.runtime/bin/openlore') not in args:raise SystemExit('Port 48180 is occupied by an unowned process.')
run([shutil.which('pnpm') or 'pnpm','build'])
try:run([shutil.which('node') or 'node','server/index.mjs'])
except KeyboardInterrupt:pass
finally:
 if started:run([sys.executable,'scripts/openlore.py','stop'])
