import bolt from '@slack/bolt';
import {randomUUID} from 'node:crypto';
import {slackConfig as c,config,safeError} from './config.mjs';
import {put,get,list,now,receipt,createTicket,changeTicket,audit,addTicketContext} from './store.mjs';
import {startRun} from './agents.mjs';
import {approveProposal,reviewDecision} from './review.mjs';
import {requireReviewer,bodyOfProposal} from './review-policy.mjs';
import {hash} from './lore.mjs';
import {triageState,triageLabels} from './triage.mjs';
export const slackStatus={configured:false,connected:false,deliveryEnabled:c.delivery,error:null};let app,working=false;
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const job=(kind,data)=>put('slack-job',{id:randomUUID(),kind,data,status:'queued',createdAt:now()});
function binding(team,channel,role){return team===c.team&&channel===c[role];}
function reviewer(team,user,channel){if(team!==c.team||(channel&&channel!==c.review))return false;try{requireReviewer('/approved','slack:'+user);return true;}catch{return false;}}
export function queueMessage(channel,text,{ticketId,threadTs,blocks,purpose='reply'}={}){if(![c.support,c.engineering,c.review].includes(channel)||!channel)throw new Error('Slack destination is not configured.');return put('outbox',{id:randomUUID(),channel,text,threadTs,blocks,purpose,ticketId,status:c.delivery?'queued':'held',createdAt:now()});}
const link=id=>'http://localhost:'+config.port+'/#ticket='+id;
async function waitRun(id){for(let i=0;i<1500;i++){const run=get('run',id);if(run.status==='failed')throw new Error(run.error);if(run.status==='completed')return run;await new Promise(r=>setTimeout(r,1000));}throw new Error('Agent is still running. Inspect RelayDesk before retrying.');}
function actions(ticket){return[{type:'actions',elements:[{type:'button',action_id:'relay_triage',text:{type:'plain_text',text:'Request internal triage'},value:ticket.id}]}];}
export async function prepareSupportReply(ticketId,question){const ticket=get('ticket',ticketId);if(!ticket.slack)throw new Error('This ticket has no Slack support thread.');const approved=list('proposal').find(p=>p.ticketId===ticketId&&p.status==='approved');const run=await waitRun(startRun(ticketId,'support',(question?'Customer follow-up from this support thread: '+question+'\n':'')+'Respond using the latest approved knowledge. Cite actual sources.').id);if(approved){const path=approved.approvedPath;if(!run.sources.includes(path)||!run.events.some(e=>e.type==='tool'&&e.status==='succeeded'&&e.command?.startsWith('cat ')&&e.command.includes(path)&&(!approved.approvedDocumentHash||hash(e.output||'')===approved.approvedDocumentHash)))throw new Error('Reply withheld: the fresh support run did not read the exact approved document revision.');}queueMessage(c.support,run.response,{ticketId,threadTs:ticket.slack.supportTs,purpose:'support-reply',blocks:[{type:'section',text:{type:'mrkdwn',text:esc(run.response).slice(0,2900)}},...actions(ticket)]});return run;}
async function processJob(j){
 if(j.kind==='support'){
  const e=j.data;let ticket=list('ticket').find(t=>t.slack?.team===c.team&&t.slack.supportTs===(e.thread_ts||e.ts));
  if(!ticket)ticket=createTicket({title:e.text.replace(/<@[A-Z0-9]+>/g,'').trim().slice(0,120)||'Slack support request',description:e.text.replace(/<@[A-Z0-9]+>/g,'').trim().slice(0,6000),customer:'Slack member '+e.user,origin:'slack',slack:{team:c.team,supportChannel:c.support,supportTs:e.thread_ts||e.ts}});
  if(e.thread_ts&&ticket.slack?.supportTs===e.thread_ts){const note=e.text.replace(/<@[A-Z0-9]+>/g,'').trim().slice(0,2000);if(note.length>=5)ticket=addTicketContext(ticket.id,note,'slack:'+e.user);}
  j.ticketId=ticket.id;put('slack-job',j);await prepareSupportReply(ticket.id,e.text.replace(/<@[A-Z0-9]+>/g,'').trim().slice(0,2000));
 }else if(j.kind==='triage'){
  const ticket=get('ticket',j.data.ticketId);
  if(ticket.slack?.team!==c.team)throw new Error('Ticket is not bound to this workspace.');
  const run=await waitRun(startRun(ticket.id,'engineering','Assess whether this issue needs code investigation before escalation. Read relevant knowledge and submit_triage.','triage').id);
  const {assessment:a}=triageState(ticket.id);
  if(!a||a.runId!==run.id)throw new Error('No completed triage assessment is available.');
  queueMessage(c.engineering,esc(ticket.id+' · Internal triage: '+triageLabels[a.category]+'\n'+a.summary+'\nCode change: '+a.codeChange+' · Confidence: '+a.confidence+' (qualitative)\nReview evidence and choose the next step in RelayDesk: '+link(ticket.id)+'\nNo code run or Devin escalation has been started.'),{ticketId:ticket.id,purpose:'internal-triage'});
 }else if(j.kind==='escalate'||j.kind==='revise'){
  const ticket=get('ticket',j.data.ticketId);if(!ticket.slack||ticket.slack.team!==c.team)throw new Error('Ticket is not bound to this workspace.');
  queueMessage(c.engineering,(j.kind==='revise'?'Reviewer requested changes. Fresh engineering investigation for ':'Engineering investigation for ')+ticket.id+': '+ticket.title+'\nCustomer report: '+ticket.description,{ticketId:ticket.id,purpose:'engineering-handoff'});
  const run=await waitRun(startRun(ticket.id,'engineering').id);queueMessage(c.engineering,run.response,{ticketId:ticket.id,purpose:'engineering-result'});
  for(const p of list('proposal').filter(p=>p.ticketId===ticket.id&&p.status==='pending'))queueMessage(c.review,'Review proposed resolution for '+ticket.id,{ticketId:ticket.id,purpose:'review-request',blocks:[{type:'section',text:{type:'mrkdwn',text:'*'+esc(p.title)+'* · revision '+(p.revision||1)+'\n'+esc(p.proposedContent||p.content).slice(0,2200)+'\nDestination: `/approved` · SHA `'+p.sourceHash.slice(0,12)+'`'}},{type:'actions',elements:[{type:'button',action_id:'relay_review',text:{type:'plain_text',text:'Review resolution'},value:p.id}]}]});
  changeTicket(ticket.id,{status:'Review needed'});
 }else if(j.kind==='approved-reply'){await prepareSupportReply(j.data.ticketId);}
}
async function pump(){if(working||!slackStatus.connected)return;working=true;try{
 const pending=list('slack-job').filter(j=>j.status==='queued').reverse()[0];if(pending){pending.status='running';put('slack-job',pending);try{await processJob(pending);pending.status='completed';}catch(e){pending.status='failed';pending.error=safeError(e);audit('slack.job.failed',{jobId:pending.id,error:pending.error});}pending.endedAt=now();put('slack-job',pending);}
 for(const m of list('outbox').filter(x=>x.status==='queued').reverse()){
  if(!c.delivery){m.status='held';put('outbox',m);continue;}
  // Validate the bound destination again immediately before every send.
  try{const info=await app.client.conversations.info({channel:m.channel});if(!info.channel?.is_member)throw new Error('RelayDesk is no longer a member of this channel.');if(info.channel?.is_ext_shared)throw new Error('Externally shared channels are not supported by this MVP.');if([c.engineering,c.review].includes(m.channel)&&!info.channel?.is_private)throw new Error('Engineering and review destinations must be private channels.');
   m.status='sending';put('outbox',m);const response=await app.client.chat.postMessage({channel:m.channel,text:m.text.slice(0,35000),thread_ts:m.threadTs||(m.purpose==='engineering-result'&&m.ticketId?get('ticket',m.ticketId).slack?.engineeringTs:undefined),blocks:m.blocks,client_msg_id:m.id,unfurl_links:false,unfurl_media:false});m.status='sent';m.sentAt=now();m.messageTs=response.ts;if(m.purpose==='engineering-handoff'&&m.ticketId){const t=get('ticket',m.ticketId);changeTicket(t.id,{slack:{...t.slack,engineeringTs:response.ts}});}
  }catch(e){m.status=m.status==='sending'?'uncertain':'failed';m.error=safeError(e);}put('outbox',m);
 }
 }finally{working=false;}}
export async function startSlack(){
 if(!c.enabled)return;
 if(!c.token||!c.appToken||!c.team||!c.support||!c.engineering||!c.review||!c.reviewers.length){slackStatus.error='Complete the Slack settings in .env, then restart.';return;}
 if(new Set([c.support,c.engineering,c.review]).size!==3){slackStatus.error='Use three distinct support, private engineering and private review channels.';return;}
 slackStatus.configured=true;
 try{app=new bolt.App({token:c.token,appToken:c.appToken,socketMode:true,clientOptions:{retryConfig:{retries:0}}});
  app.receiver.client.on('connected',()=>{slackStatus.connected=true;});app.receiver.client.on('disconnected',()=>{slackStatus.connected=false;});
  const auth=await app.client.auth.test();if(auth.team_id!==c.team)throw new Error('Slack bot token belongs to a different workspace.');
  for(const channel of [c.support,c.engineering,c.review]){const {channel:info}=await app.client.conversations.info({channel});if(info?.is_ext_shared)throw new Error('Slack Connect channels are outside this MVP.');if(!info?.is_member)throw new Error('Invite RelayDesk to every configured channel.');if([c.engineering,c.review].includes(channel)&&!info?.is_private)throw new Error('Engineering and review channels must be private.');}
  app.event('app_mention',async({event,body})=>{if(event.bot_id||event.subtype||!binding(body.team_id,event.channel,'support'))return;if(!receipt(c.team+':'+body.event_id))return;job('support',event);});
  const requestTriage=async({ack,body,action})=>{await ack();if(!binding(body.team.id,body.channel?.id,'support'))return;const ticket=get('ticket',action.value);if(ticket.slack?.supportTs!==(body.message?.thread_ts||body.message?.ts)||ticket.slack?.team!==c.team)return;if(list('slack-job').some(j=>['queued','running'].includes(j.status)&&j.data?.ticketId===ticket.id))return;if(!receipt(c.team+':escalate:'+ticket.id+':'+body.action_ts))return;job('triage',{ticketId:ticket.id});};
  app.action('relay_triage',requestTriage);app.action('relay_escalate',requestTriage);
  app.action('relay_review',async({ack,body,action,client})=>{await ack();if(!reviewer(body.team.id,body.user.id,body.channel?.id))return;const p=get('proposal',action.value);if(p.status!=='pending'){await client.chat.postEphemeral({channel:c.review,user:body.user.id,text:'This proposal is '+p.status+'. Open the latest pending revision; no approval was applied.'});return;}if(bodyOfProposal(p).length>3000){await client.chat.postEphemeral({channel:c.review,user:body.user.id,text:'This proposal is longer than Slack’s review editor. Review it in the local RelayDesk app: '+link(p.ticketId)});return;}
   const nonce=randomUUID();put('review-session',{id:nonce,user:body.user.id,team:body.team.id,proposalId:p.id,sourceHash:p.sourceHash,createdAt:now()});
   await client.views.open({trigger_id:body.trigger_id,view:{type:'modal',callback_id:'relay_review_decision',private_metadata:nonce,title:{type:'plain_text',text:'Review resolution'},submit:{type:'plain_text',text:'Submit decision'},close:{type:'plain_text',text:'Cancel'},blocks:[
    {type:'section',text:{type:'mrkdwn',text:'*Revision '+(p.revision||1)+'* · '+esc(p.ticketId)+'\nDestination: `/approved`\nSource SHA: `'+p.sourceHash.slice(0,12)+'`\nApproval applies only to this revision and the exact text below.'}},
    {type:'input',block_id:'decision',label:{type:'plain_text',text:'Review decision'},element:{type:'static_select',action_id:'action',initial_option:{text:{type:'plain_text',text:'Approve edited resolution'},value:'approve'},options:[{text:{type:'plain_text',text:'Approve edited resolution'},value:'approve'},{text:{type:'plain_text',text:'Request changes'},value:'request-changes'},{text:{type:'plain_text',text:'Reject proposal'},value:'reject'}]}},
    {type:'input',block_id:'resolution',label:{type:'plain_text',text:'Reviewed customer-safe resolution'},element:{type:'plain_text_input',action_id:'content',multiline:true,max_length:3000,initial_value:bodyOfProposal(p).slice(0,3000)}},
    {type:'input',block_id:'feedback',optional:true,label:{type:'plain_text',text:'Feedback (required for changes or rejection)'},element:{type:'plain_text_input',action_id:'note',multiline:true,max_length:2000}}
   ]}});
  });
  app.view('relay_review_decision',async({ack,body,view})=>{
   let session;try{session=get('review-session',view.private_metadata);}catch{await ack({response_action:'errors',errors:{resolution:'Review session expired. Open the proposal again.'}});return;}
   if(!reviewer(body.team.id,body.user.id)||session.user!==body.user.id||session.team!==body.team.id||Date.now()-Date.parse(session.createdAt)>600000||session.usedAt){await ack({response_action:'errors',errors:{resolution:'You are not authorized or this review session expired.'}});return;}
   const action=view.state.values.decision.action.selected_option.value,content=view.state.values.resolution.content.value,feedback=view.state.values.feedback.note.value||'';
   if(action==='approve'&&(!content||content.length<20||/RELAY_PRIVATE_/.test(content))){await ack({response_action:'errors',errors:{resolution:'Provide a customer-safe resolution with at least 20 characters.'}});return;}
   if(action!=='approve'&&feedback.trim().length<3){await ack({response_action:'errors',errors:{feedback:'Explain what needs to change or why this proposal is rejected.'}});return;}
   await ack();session.usedAt=now();put('review-session',session);
   try{
    let p;const actor='slack:'+body.user.id;
    if(action==='approve'){p=await approveProposal(session.proposalId,{content,sourceHash:session.sourceHash,actor});job('approved-reply',{ticketId:p.ticketId});}
    else{p=await reviewDecision(session.proposalId,{action,sourceHash:session.sourceHash,feedback,actor});if(action==='request-changes')job('revise',{ticketId:p.ticketId});}
    queueMessage(c.review,p.ticketId+' revision '+(p.revision||1)+': '+(action==='approve'?'approved; fresh support retrieval queued':action==='request-changes'?'changes requested; fresh engineering revision queued':'rejected')+'\nReviewed by '+actor+' · source SHA '+p.sourceHash.slice(0,12),{ticketId:p.ticketId,purpose:'review-decision'});
   }catch(e){audit('slack.approval.failed',{proposalId:session.proposalId,error:safeError(e)});queueMessage(c.review,'Review did not complete: '+safeError(e),{purpose:'approval-error'});}
  });
  app.error(async e=>{slackStatus.error=safeError(e);audit('slack.error',{error:slackStatus.error});});await app.start();slackStatus.connected=true;setInterval(()=>void pump().catch(e=>{slackStatus.error=safeError(e);}),1000).unref();
 }catch(e){slackStatus.error=safeError(e);slackStatus.connected=false;await app?.stop().catch(()=>{});}
}
