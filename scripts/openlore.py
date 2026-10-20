#!/usr/bin/env python3
"""Manage RelayDesk's isolated OpenLore v0.7.5 instance. Credentials never print."""
from pathlib import Path
import hashlib,json,os,platform,shutil,signal,socket,subprocess,sys,time,urllib.request
ROOT=Path(__file__).resolve().parents[1];R=ROOT/'.runtime';LORE=R/'lore';BIN=R/'bin/openlore'
URL='http://127.0.0.1:48180'
PRINCIPALS={'support-agent':'support','engineering-agent':'engineering','reviewer':'reviewer','claude-support':'support','codex-engineering':'engineering'}
def cmd(args,**kw):return subprocess.run(args,check=True,text=True,capture_output=True,**kw)
def setup():
 R.mkdir(exist_ok=True);os.chmod(R,0o700);BIN.parent.mkdir(exist_ok=True)
 if not BIN.exists():
  supplied=os.environ.get('OPENLORE_BIN')
  if supplied:shutil.copy2(supplied,BIN)
  else:
   archive=f'openlore_{"darwin" if platform.system()=="Darwin" else "linux"}_{"arm64" if platform.machine() in ["arm64","aarch64"] else "amd64"}.tar.gz'
   base='https://github.com/aakarim/OpenLore/releases/download/v0.7.5/'
   urllib.request.urlretrieve(base+archive,R/archive);urllib.request.urlretrieve(base+'checksums.txt',R/'checksums.txt')
   expected=next(x.split()[0] for x in (R/'checksums.txt').read_text().splitlines() if x.endswith(archive))
   assert hashlib.sha256((R/archive).read_bytes()).hexdigest()==expected,'Release checksum mismatch'
   cmd(['tar','-xzf',str(R/archive),'-C',str(BIN.parent)])
 assert cmd([str(BIN),'version']).stdout.strip()=='openlore 0.7.5','Requires OpenLore v0.7.5'
 LORE.mkdir(exist_ok=True);docs=LORE/'documents'
 # Rerunning setup refreshes credentials without overwriting learned knowledge.
 shutil.copytree(ROOT/'knowledge',docs,dirs_exist_ok=True,copy_function=lambda src,dst: shutil.copy2(src,dst) if not Path(dst).exists() else str(dst))
 creds=R/'credentials';creds.mkdir(exist_ok=True);os.chmod(creds,0o700)
 identities=[]
 for principal,role in PRINCIPALS.items():
  key=creds/principal
  if not key.exists():cmd(['ssh-keygen','-q','-t','ed25519','-N','','-C',principal,'-f',str(key)])
  identities.append({'name':principal,'roles':[role],'public_key':key.with_suffix('.pub').read_text().strip()})
 policy={'allow_keyless':False,'unknown_identity':'deny','roles':{r:{} for r in ['support','engineering','reviewer']},'identities':identities,'docsets':{}}
 for name,allow in {'approved':{'support':'ro','engineering':'ro','reviewer':'rw'},'support':{'support':'rw','reviewer':'rw'},'engineering':{'engineering':'rw','reviewer':'rw'},'contributions':{'engineering':'publish','reviewer':'rw'}}.items():
  ds={'paths':['/'+name],'access':{'allow':allow}}
  if name=='contributions':ds['inbox']='inbox'
  policy['docsets'][name]=ds
 (LORE/'lore.json').write_text(json.dumps(policy,indent=2)+'\n')
 (LORE/'openlore.yml').write_text('''port: 42322
http_port: 48180
metrics_port: 0
external_url: http://127.0.0.1:48180
auth_file: ./lore.json
data_dir: ./data
readonly: false
write_conflict_policy: hash
passkeys:
  enabled: false
mcp:
  enabled: true
  require_auth: true
tokens:
  issuer: http://127.0.0.1:48180
  audience: http://127.0.0.1:48180
''')
 for principal in PRINCIPALS:
  token=cmd([str(BIN),'token','mint','--identity',principal,'--ttl','168h'],cwd=LORE).stdout.strip()
  p=creds/(principal+'.token');p.write_text(token);os.chmod(p,0o600)
 print('Configured isolated OpenLore v0.7.5. Five principals; existing knowledge preserved; credentials are local and ignored.')
def start():
 if not BIN.exists():setup()
 for port in [48180,42322]:
  with socket.socket() as s:
   if s.connect_ex(('127.0.0.1',port))==0:raise SystemExit(f'Port {port} occupied. Refusing to start an overlapping service.')
 with (R/'openlore.log').open('a') as log:p=subprocess.Popen([str(BIN),'--metrics-port','0','./documents'],cwd=LORE,stdout=log,stderr=log,start_new_session=True)
 (R/'openlore.pid').write_text(str(p.pid))
 for _ in range(60):
  if p.poll() is not None:raise SystemExit('OpenLore exited. Inspect .runtime/openlore.log')
  try:urllib.request.urlopen(URL,timeout=1);print('RelayDesk OpenLore ready: '+URL);return
  except Exception:time.sleep(.2)
 raise SystemExit('OpenLore startup timed out')
def stop():
 f=R/'openlore.pid'
 if not f.exists():return
 pid=int(f.read_text());result=subprocess.run(['ps','-p',str(pid),'-o','command='],capture_output=True,text=True)
 if result.returncode: f.unlink();return
 if str(BIN) not in result.stdout:raise SystemExit('PID belongs to another process; refusing to stop.')
 os.kill(pid,signal.SIGTERM)
 for _ in range(160):
  p=subprocess.run(['ps','-p',str(pid),'-o','stat='],capture_output=True,text=True)
  if p.returncode or p.stdout.strip().startswith('Z'):f.unlink();print('Owned OpenLore stopped after drain.');return
  time.sleep(.25)
 raise SystemExit('OpenLore still draining; ownership record retained.')
if __name__=='__main__':{'setup':setup,'start':start,'stop':stop}[sys.argv[1] if len(sys.argv)>1 else 'setup']()
