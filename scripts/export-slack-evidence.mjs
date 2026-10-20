// Export only a deliberately synthetic ticket. Raw engineering traces stay local.
import fs from 'node:fs/promises';
import path from 'node:path';
import {get,list} from '../server/store.mjs';
import {withLore,hash} from '../server/lore.mjs';
import {ROOT} from '../server/config.mjs';
const [ticketId,output]=process.argv.slice(2);
if(!/^RD-\d+$/.test(ticketId||'')||!output)throw new Error('Usage: node scripts/export-slack-evidence.mjs RD-1005 OUTPUT_DIRECTORY');
const ticket=get('ticket',ticketId);
if(!/synthetic/i.test(ticket.description))throw new Error('Export is restricted to explicitly synthetic ticket descriptions.');
const runs=list('run').filter(r=>r.ticketId===ticketId).reverse();
const proposals=list('proposal').filter(p=>p.ticketId===ticketId).reverse();
const approved=proposals.findLast(p=>p.status==='approved');
if(!approved)throw new Error('No approved resolution exists.');
const canonical=await withLore('support',l=>l.read(approved.approvedPath));
const supportRuns=runs.filter(r=>r.role==='support'),last=supportRuns.at(-1);
const outbox=list('outbox').filter(o=>o.ticketId===ticketId).reverse();
const jobs=list('slack-job').filter(j=>j.ticketId===ticketId||j.data?.ticketId===ticketId).reverse();
const supportExport={ticket:{id:ticket.id,title:ticket.title,origin:ticket.origin,status:ticket.status},supportRuns,approvedResolution:approved.reviewedContent,scope:'Synthetic support evidence; private engineering transcripts excluded.'};
const checks={
 allRunsCompleted:runs.length>0&&runs.every(r=>r.status==='completed'),
 realQwenModel:runs.every(r=>r.model==='Qwen/Qwen3-235B-A22B-Instruct-2507'&&r.events.some(e=>e.type==='model')),
 freshConversations:runs.every(r=>r.priorConversationMessageCount===0&&r.initialMessages?.length===2),
 supportSourcesScoped:supportRuns.every(r=>r.sources.every(p=>/^\/(approved|support)\//.test(p))),
 noPrivateMarkerInSupport:!JSON.stringify(supportExport).includes('RELAY_PRIVATE_'),
 exactApprovedRevisionRetrieved:last.events.some(e=>e.type==='tool'&&e.status==='succeeded'&&e.command?.startsWith('cat ')&&e.command.includes(approved.approvedPath)&&hash(e.output||'')===approved.approvedDocumentHash),
 canonicalMatchesApproval:hash(canonical)===approved.approvedDocumentHash,
 reviewedTextMatches:hash(approved.reviewedContent)===approved.reviewedContentHash,
 slackReviewerAttributed:approved.reviewedBy?.startsWith('slack:'),
 changeRequestRetained:list('review-event').some(e=>e.ticketId===ticketId&&e.type==='changes-requested'),
 priorRevisionSuperseded:proposals.some(p=>p.status==='superseded'),
 allJobsCompleted:jobs.length>0&&jobs.every(j=>j.status==='completed'),
 allOutboxSent:outbox.length>0&&outbox.every(o=>o.status==='sent'),
 supportRepliesInOriginalThread:outbox.filter(o=>o.purpose==='support-reply').every(o=>o.channel===ticket.slack.supportChannel&&o.threadTs===ticket.slack.supportTs),
};
const summary={capturedAt:new Date().toISOString(),ticketId,checks,passed:Object.values(checks).every(Boolean),runs:runs.map(r=>({id:r.id,role:r.role,status:r.status,model:r.model,elapsedMs:r.elapsedMs,modelRequests:r.events.filter(e=>e.type==='model').length,mcpOperations:r.events.filter(e=>e.type==='tool').length,failedMcpOperations:r.events.filter(e=>e.type==='tool'&&e.status==='failed').length,sources:r.sources,priorConversationMessageCount:r.priorConversationMessageCount})),jobs:jobs.length,outbox:{total:outbox.length,sent:outbox.filter(o=>o.status==='sent').length},approvedPath:approved.approvedPath,reviewedBy:approved.reviewedBy,reviewedContentHash:approved.reviewedContentHash,approvedDocumentHash:approved.approvedDocumentHash,limits:['Synthetic local demonstration; implementing assistant acted as delegated operator through the reviewer Slack account. Not independent human-user sign-off.','Actual model tool loops ran against Nebius; provider token and cost telemetry unavailable.','Source retrieval and private marker checks do not prove hallucination-free generation or complete information-flow security.','Native coding clients, Docker and a RelayDesk endurance campaign were not executed.']};
const directory=path.resolve(ROOT,output);await fs.mkdir(directory,{recursive:true});
for(const [name,value] of Object.entries({'summary.json':summary,'support-evidence.json':supportExport,'flow.json':{ticket,runs,proposals,reviewEvents:list('review-event').filter(e=>e.ticketId===ticketId).reverse(),jobs,outbox,canonical}}))await fs.writeFile(path.join(directory,name),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));if(!summary.passed)process.exitCode=1;
