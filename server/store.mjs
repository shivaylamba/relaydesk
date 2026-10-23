import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {runtime} from './config.mjs';
const db=new DatabaseSync(path.join(runtime,'relaydesk.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, body TEXT NOT NULL); CREATE INDEX IF NOT EXISTS kind_idx ON records(kind); CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, received TEXT NOT NULL);`);
export const now=()=>new Date().toISOString();
export function put(kind,value){db.prepare('INSERT INTO records(id,kind,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(value.id,kind,JSON.stringify(value));return value;}
export function get(kind,id){const row=db.prepare('SELECT body FROM records WHERE id=? AND kind=?').get(id,kind);if(!row)throw Object.assign(new Error('Record not found'),{status:404});return JSON.parse(row.body);}
export function list(kind){return db.prepare('SELECT body FROM records WHERE kind=? ORDER BY rowid DESC').all(kind).map(x=>JSON.parse(x.body));}
export function audit(type,data={}){return put('audit',{id:randomUUID(),at:now(),type,...data});}
export function receipt(id){return Number(db.prepare('INSERT OR IGNORE INTO receipts VALUES(?,?)').run(id,now()).changes)>0;}
export function createTicket(input){const number=1001+list('ticket').length;return put('ticket',{id:'RD-'+number,title:input.title,description:input.description,customer:input.customer||'Demo customer',priority:input.priority||'Medium',status:'New',createdAt:now(),updatedAt:now(),origin:input.origin||'web',slack:input.slack||null});}
export function changeTicket(id,changes){return put('ticket',{...get('ticket',id),...changes,updatedAt:now()});}
export function seed(){if(list('ticket').length)return;for(const t of [
 {title:'Charged twice after checkout retry',description:'I clicked Pay, saw a timeout, and retried. My bank now shows two entries. Can you help confirm what happened?',customer:'Maya Chen · Cedar demo',priority:'High'},
 {title:'Sign-in keeps sending me back to login',description:'After signing in successfully I land on the login screen again. This happens in my existing browser session.',customer:'Jonas Patel · Cedar demo',priority:'Medium'},
 {title:'Webhook arrived much later than expected',description:'Our order webhook was delayed after a retry. Is there an approved workaround or delivery-time guarantee?',customer:'Leah Brooks · Cedar demo',priority:'Medium'}])createTicket(t);}
export function recoverInterrupted(){for(const r of list('run').filter(r=>r.status==='running'||r.status==='queued')){r.status='failed';r.error='The app restarted before this run finished. Start a fresh run; writes were not automatically replayed.';r.endedAt=now();put('run',r);}for(const j of list('slack-job').filter(j=>j.status==='running')){j.status='needs-review';j.error='Interrupted during processing. Inspect the ticket before retrying; no automatic model/write replay.';put('slack-job',j);}for(const o of list('outbox').filter(o=>o.status==='sending')){o.status='uncertain';o.error='Delivery was interrupted. Inspect Slack before requesting another delivery.';put('outbox',o);}}

export function addTicketContext(id,note,actor='local-operator'){
 const t=get('ticket',id),context=t.context||[];
 if(context.length>=24||context.reduce((n,c)=>n+c.note.length,0)+note.length>12000)throw Object.assign(new Error('Ticket context limit reached. Create a follow-up ticket for further details.'),{status:400});
 const value=changeTicket(id,{context:[...context,{id:randomUUID(),at:now(),actor,note}]});audit('ticket.context.added',{ticketId:id,actor});return value;
}
