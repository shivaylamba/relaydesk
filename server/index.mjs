import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {ROOT,config,safeError} from './config.mjs';
import {seed,list,get,createTicket,recoverInterrupted,changeTicket,audit,addTicketContext} from './store.mjs';
import {startRun,visibleRuns} from './agents.mjs';
import {withLore,roots,hash} from './lore.mjs';
import {approveProposal,reviewDecision,cosignDocument} from './review.mjs';
import {triageState,decideTriage,devinBrief} from './triage.mjs';
import {reviewPolicies} from './review-policy.mjs';
import {startSlack,slackStatus,prepareSupportReply} from './slack.mjs';
const localHosts=['127.0.0.1','localhost','::1'];
if(!localHosts.includes(config.host)&&config.operatorKey.length<24)throw new Error('Non-loopback hosting requires RELAYDESK_OPERATOR_KEY with at least 24 characters.');
const app=express();app.disable('x-powered-by');
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');if(localHosts.includes(config.host)&&!localHosts.includes(req.hostname))return res.status(403).json({error:'Unknown host'});next();});
app.use('/api',(req,res,next)=>{
 if(config.operatorKey){const supplied=Buffer.from(String(req.headers['x-relaydesk-key']||'')),expected=Buffer.from(config.operatorKey);if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return res.status(401).json({error:'Enter the RelayDesk operator key to continue.'});}
 const origin=req.headers.origin;if(origin){try{const parsed=new URL(origin);const same=parsed.host===req.get('host');const dev=localHosts.includes(parsed.hostname)&&['3410','3411'].includes(parsed.port);if(!same&&!dev)return res.status(403).json({error:'Cross-origin API requests are not allowed.'});}catch{return res.status(403).json({error:'Invalid origin'});}}
 if(!['GET','HEAD'].includes(req.method)&&!req.is('application/json'))return res.status(415).json({error:'Use application/json.'});next();
});
app.use(express.json({limit:'40kb'}));
const roleSchema=z.enum(['support','engineering']);
app.get('/api/bootstrap',(_req,res)=>res.json({name:'RelayDesk',tickets:list('ticket'),pendingReviews:list('proposal').filter(p=>p.status==='pending').length,model:config.model,providerConfigured:!!config.key,slack:slackStatus,collections:roots,reviewPolicies:reviewPolicies(),scope:'Single trusted operator. Synthetic local workspace. Agent knowledge boundaries are enforced by separate OpenLore identities.'}));
app.post('/api/tickets',(req,res)=>{const v=z.object({title:z.string().min(3).max(120),description:z.string().min(10).max(6000),customer:z.string().max(120).optional(),priority:z.enum(['High','Medium','Low']).optional()}).strict().parse(req.body);const t=createTicket(v);audit('ticket.created',{ticketId:t.id});res.status(201).json(t);});
app.get('/api/tickets/:id',(req,res)=>{const t=get('ticket',req.params.id),role=roleSchema.parse(req.query.role||'support');const ts=role==='engineering'?triageState(t.id):null;res.json({ticket:t,triageReady:ts?!!ts.assessment&&ts.decision?.action==='engineering-investigation'&&!ts.stale&&ts.run?.id===ts.assessment.runId&&ts.run?.status==='completed':undefined,runs:visibleRuns(t.id,role),proposals:role==='engineering'?list('proposal').filter(p=>p.ticketId===t.id):[],approved:list('proposal').filter(p=>p.ticketId===t.id&&p.status==='approved').map(p=>({id:p.id,title:p.title,path:p.approvedPath,reviewedAt:p.reviewedAt})),audit:list('audit').filter(a=>a.ticketId===t.id).slice(0,20)});});
app.post('/api/tickets/:id/runs',(req,res)=>{const v=z.object({role:roleSchema,prompt:z.string().max(3000).optional()}).strict().parse(req.body);res.status(202).json(startRun(req.params.id,v.role,v.prompt));});
// Internal triage endpoints use the same trusted-operator authentication as the workspace.
app.get('/api/tickets/:id/triage',(req,res)=>res.json(triageState(req.params.id)));
app.post('/api/tickets/:id/triage',(req,res)=>{z.object({}).strict().parse(req.body);res.status(202).json(startRun(req.params.id,'engineering','Assess routing before escalation. Read relevant approved and engineering knowledge, then submit_triage. Do not propose or implement a fix.','triage'));});
app.post('/api/triage/:id/decision',async(req,res)=>res.json(await decideTriage(req.params.id,req.body)));
app.post('/api/tickets/:id/devin-brief',async(req,res)=>{const v=z.object({acknowledgeInternal:z.literal(true)}).strict().parse(req.body);res.json(await devinBrief(req.params.id,v));});
app.post('/api/tickets/:id/context',(req,res)=>{const v=z.object({note:z.string().trim().min(5).max(2000)}).strict().parse(req.body);res.json(addTicketContext(req.params.id,v.note));});
app.post('/api/tickets/:id/slack-reply',async(req,res)=>{await prepareSupportReply(req.params.id);res.json({ok:true});});
app.post('/api/tickets/:id/resolve',(req,res)=>{const t=get('ticket',req.params.id);if(!list('proposal').some(p=>p.ticketId===t.id&&p.status==='approved'))throw new Error('Approve a resolution before marking this ticket resolved.');res.json(changeTicket(t.id,{status:'Resolved'}));});
app.get('/api/runs/:id',(req,res)=>res.json(get('run',req.params.id)));
app.get('/api/reviews',(_req,res)=>res.json(list('proposal').map(p=>({...p,reviewEvents:list('review-event').filter(e=>e.proposalId===p.id),policy:reviewPolicies()[p.destinationDocset||'/approved']}))));
app.get('/api/review-policies',(_req,res)=>res.json(reviewPolicies()));
app.post('/api/reviews/:id/approve',async(req,res)=>{const v=z.object({content:z.string().min(20).max(10000),sourceHash:z.string().length(64)}).strict().parse(req.body);res.json(await approveProposal(req.params.id,v));});
for(const action of ['request-changes','reject'])app.post('/api/reviews/:id/'+action,async(req,res)=>{const v=z.object({sourceHash:z.string().length(64),feedback:z.string().trim().min(3).max(3000)}).strict().parse(req.body);res.json(await reviewDecision(req.params.id,{...v,action}));});
app.get('/api/knowledge',async(req,res)=>{const role=roleSchema.parse(req.query.role||'support');const result=await withLore(role,async lore=>({identity:role+'-agent',collections:await lore.command('lore docsets'),tree:await lore.command('tree /'),documents:(await lore.command('find / -type f')).split('\n').filter(p=>p.endsWith('.md')).slice(0,200)}));res.json(result);});
app.post('/api/knowledge/read',async(req,res)=>{const v=z.object({role:roleSchema,path:z.string().max(200)}).strict().parse(req.body);const content=await withLore(v.role,lore=>lore.read(v.path));res.json({path:v.path,content,sourceHash:hash(content),cosigns:list('cosign').filter(c=>c.path===v.path),policy:reviewPolicies()['/'+v.path.split('/')[1]]});});
app.post('/api/knowledge/cosign',async(req,res)=>{const v=z.object({path:z.string().max(200),sourceHash:z.string().length(64)}).strict().parse(req.body);res.json(await cosignDocument(v));});
app.post('/api/connections/check',async(_req,res)=>{const data={};for(const role of ['support','engineering']){try{data[role]={ok:true,identity:await withLore(role,lore=>lore.command('whoami'))};}catch(e){data[role]={ok:false,error:safeError(e)};}}res.json(data);});
app.get('/api/slack',(_req,res)=>res.json({status:slackStatus,outbox:list('outbox').map(({text,blocks,...rest})=>rest),jobs:list('slack-job').map(({data,...rest})=>rest)}));
app.get('/api/slack/manifest',(_req,res)=>res.download(path.join(ROOT,'slack-manifest.json')));
app.get('/api/tickets/:id/evidence',(req,res)=>{const t=get('ticket',req.params.id);res.setHeader('Content-Disposition','attachment; filename="'+t.id+'-evidence.json"');res.json({ticket:{id:t.id,title:t.title,origin:t.origin,status:t.status},scope:'Public support evidence only; engineering transcripts excluded.',supportRuns:visibleRuns(t.id,'support'),approvedResolutions:list('proposal').filter(p=>p.ticketId===t.id&&p.status==='approved').map(p=>({title:p.title,path:p.approvedPath,reviewedContent:p.reviewedContent,sourceHash:p.sourceHash,reviewedAt:p.reviewedAt})),modelUsage:'Provider token and cost telemetry is not collected; no zero-cost claim.'});});
const dist=path.join(ROOT,'dist');if(fs.existsSync(dist)){app.use(express.static(dist));app.get('/{*path}',(_req,res)=>res.sendFile(path.join(dist,'index.html')));}
app.use((error,_req,res,_next)=>{const status=error instanceof z.ZodError?400:error.status||500;res.status(status).json({error:error instanceof z.ZodError?'Invalid request: '+error.issues.map(x=>x.path.join('.')+' '+x.message).join('; '):safeError(error)});});
seed();recoverInterrupted();app.listen(config.port,config.host,()=>{console.log('RelayDesk: http://'+config.host+':'+config.port);void startSlack();});
