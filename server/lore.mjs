import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {config,runtime,safeError} from './config.mjs';
export const identities={support:'support-agent',engineering:'engineering-agent',reviewer:'reviewer'};
export const roots={support:['/approved','/support'],engineering:['/approved','/engineering','/contributions'],reviewer:['/approved','/support','/engineering','/contributions']};
export const hash=text=>createHash('sha256').update(text).digest('hex');
export const quote=text=>"'"+String(text).replaceAll("'","'\\''")+"'";
export function validPath(role,value){if(typeof value!=='string'||value.length>200||!/^\/[a-zA-Z0-9_./-]+$/.test(value)||value.split('/').some(x=>x==='..'||x==='.')||!roots[role]?.some(root=>value===root||value.startsWith(root+'/')))throw new Error('Path is outside this agent’s configured collections.');return value;}
function decode(result){if(result.structuredContent&&typeof result.structuredContent.exit_code==='number')return result.structuredContent;for(const block of result.content||[]){if(block.type!=='text')continue;try{const data=JSON.parse(block.text);if(typeof data.exit_code==='number')return data;}catch{}}throw new Error(result.isError?'OpenLore MCP returned a tool error.':'OpenLore returned an unrecognized command result.');}
export class Lore{
 constructor(role,trace=()=>{}){if(!identities[role])throw new Error('Unknown agent identity');this.role=role;this.trace=trace;this.client=null;}
 async connect(){const file=path.join(runtime,'credentials',identities[this.role]+'.token');if(!fs.existsSync(file))throw new Error('OpenLore credentials missing. Run pnpm setup, then pnpm lore.');const token=fs.readFileSync(file,'utf8').trim();this.client=new Client({name:'relaydesk-'+this.role,version:'0.1.0'});await this.client.connect(new StreamableHTTPClientTransport(new URL(config.lore+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+token}}}));const tools=await this.client.listTools();this.shellName=tools.tools.find(t=>t.name==='shell')?.name;if(!this.shellName)throw new Error('OpenLore shell tool is unavailable.');}
 async command(command,{write=false}={}){const start=Date.now();let result;try{if(!this.client)await this.connect();try{result=await this.client.callTool({name:this.shellName,arguments:{command}},undefined,{timeout:30000});}catch(e){if(!/session not found/i.test(e.message))throw e;await this.close();await this.connect();if(write)throw new Error('MCP session expired. Write was not replayed. Read the current document and reconcile before retrying.');result=await this.client.callTool({name:this.shellName,arguments:{command}},undefined,{timeout:30000});}const data=decode(result);const ok=!result.isError&&data.exit_code===0;this.trace({type:'tool',identity:identities[this.role],command,status:ok?'succeeded':'failed',exitCode:data.exit_code,ms:Date.now()-start,output:String(data.stdout||data.output||data.stderr||'').slice(0,16000)});if(!ok)throw new Error(String(data.stderr||data.output||'OpenLore command rejected').slice(0,400));return String(data.stdout??data.output??'');}catch(e){if(!result)this.trace({type:'tool',identity:identities[this.role],command,status:'failed',ms:Date.now()-start,error:safeError(e)});throw e;}}
 async read(p){validPath(this.role,p);return this.command('cat '+quote(p));}
 async discover(){return JSON.stringify({identity:await this.command('whoami'),collections:await this.command('lore docsets'),paths:await this.command('find / -type f'),guidance:'Read actual returned paths. Search broad keywords; broaden empty matches. Virtual shell: basic find only, no -exec, one tree root per call. Scoped not-found does not imply global absence.'});}
 async search(query){if(typeof query!=='string'||query.length<2||query.length>120||/[\n\r\0]/.test(query))throw new Error('Use a short search phrase.');return this.command('grep -ri '+quote(query)+' /');}
 async write(p,content){validPath(this.role,p);if(content.length>14000)throw new Error('Document exceeds the 14,000 character budget.');return this.command('printf %s '+quote(content)+' > '+quote(p),{write:true});}
 async publish(name,content){if(!/^RD-\d+(?:-[0-9a-f-]{36})?$/.test(name))throw new Error('Invalid ticket ID');return this.command('printf %s '+quote(content)+' | publish /contributions/'+name+'.md',{write:true});}
 async close(){if(this.client){await this.client.close().catch(()=>{});this.client=null;}}
}
export async function withLore(role,fn){const lore=new Lore(role);try{return await fn(lore);}finally{await lore.close();}}
