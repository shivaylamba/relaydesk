#!/usr/bin/env python3
"""Run a coding client with one RelayDesk-scoped identity; no global config edits."""
from pathlib import Path
import os,sys,json,subprocess,tomllib,re
ROOT=Path(__file__).resolve().parents[1];R=ROOT/'.runtime'
if len(sys.argv)<3:raise SystemExit('Usage: python3 scripts/client.py codex|claude "prompt"')
kind=sys.argv[1];prompt='First run lore docsets and inspect your accessible roots. Read only actual returned paths. This is a limited virtual shell: no find -exec; one root per tree call. Broaden an empty search before inferring absence. A scoped not-found response is not proof of global absence. Support has no contribution-inbox access.\n\n'+' '.join(sys.argv[2:]);env=dict(os.environ)
if kind=='codex':
 env['RELAYDESK_OPENLORE_TOKEN']=(R/'credentials/codex-engineering.token').read_text().strip()
 args=['codex','exec','--ephemeral','--skip-git-repo-check','--sandbox','workspace-write','-c','mcp_servers.relaydesk.url="http://127.0.0.1:48180/mcp"','-c','mcp_servers.relaydesk.bearer_token_env_var="RELAYDESK_OPENLORE_TOKEN"','-c','mcp_servers.relaydesk.default_tools_approval_mode="approve"','-c','mcp_servers.relaydesk.required=true']
 config=Path.home()/'.codex/config.toml';saved=tomllib.loads(config.read_text()) if config.exists() else {}
 for name in saved.get('mcp_servers',{}):
  if name!='relaydesk':
   if not re.fullmatch(r'[A-Za-z0-9_-]+',name):raise SystemExit('Unsupported name in global MCP config. Use a dedicated plain-named profile.')
   args+=['-c','mcp_servers.'+name+'.enabled=false']
 args+=[prompt]
elif kind=='claude':
 p=R/'claude-support.mcp.json';p.write_text(json.dumps({'mcpServers':{'relaydesk':{'type':'http','url':'http://127.0.0.1:48180/mcp','headers':{'Authorization':'Bearer '+(R/'credentials/claude-support.token').read_text().strip()}}}},indent=2));os.chmod(p,0o600)
 args=['claude','-p','--strict-mcp-config','--mcp-config',str(p),'--allowedTools','mcp__relaydesk__shell','mcp__relaydesk__list_commands','--',prompt]
else:raise SystemExit('Choose codex or claude')
raise SystemExit(subprocess.run(args,cwd=ROOT,env=env).returncode)
