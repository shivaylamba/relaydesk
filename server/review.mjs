import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {withLore,hash} from './lore.mjs';
import {get,put,list,changeTicket,audit,now} from './store.mjs';
import {requireReviewer,reviewPolicies} from './review-policy.mjs';
const locks=new Set();
const conflict=message=>Object.assign(new Error(message),{status:409});
async function locked(ticketId,fn){if(locks.has(ticketId))throw conflict('A review or submission for this ticket is already in progress.');locks.add(ticketId);try{return await fn();}finally{locks.delete(ticketId);}}
async function readOptional(lore,target){try{return await lore.read(target);}catch(e){if(/file does not exist|no such file/i.test(e.message))return null;throw e;}}
function decision(p,type,actor,data={}){const event=put('review-event',{id:randomUUID(),proposalId:p.id,ticketId:p.ticketId,type,actor,sourceHash:p.sourceHash,revision:p.revision||1,at:now(),...data});audit('proposal.'+type,{ticketId:p.ticketId,proposalId:p.id,actor,sourceHash:p.sourceHash,...data});return event;}
export async function submitProposal({ticketId,title,content,author,lore}){
 return locked(ticketId,async()=>{
  const id=randomUUID(),target='/approved/'+ticketId+'.md',revision=1+Math.max(0,...list('proposal').filter(p=>p.ticketId===ticketId).map(p=>p.revision||1));
  const base=await readOptional(lore,target),text='# '+title+'\n\nStatus: proposed, awaiting nominated review.\nTicket: '+ticketId+'\nAuthor: '+author+'\nRevision: '+revision+'\n\n'+content;
  const name=ticketId+'-'+id;await lore.publish(name,text);const sourcePath='/contributions/inbox/'+name+'.md',actual=await lore.read(sourcePath);
  for(const old of list('proposal').filter(p=>p.ticketId===ticketId&&['pending','changes-requested'].includes(p.status)))put('proposal',{...old,status:'superseded',supersededAt:now(),supersededBy:id});
  const proposal={id,ticketId,title,content:actual,proposedContent:content,sourcePath,sourceHash:hash(actual),status:'pending',createdAt:now(),author,revision,destinationDocset:'/approved',targetPath:target,baseApprovedHash:base===null?null:hash(base),baseApprovedContent:base};
  put('proposal',proposal);decision(proposal,'submitted',author);changeTicket(ticketId,{status:'Review needed'});return proposal;
 });
}
async function pendingSource(id,sourceHash,lore,actor){
 const p=get('proposal',id);requireReviewer(p.destinationDocset||'/approved',actor,p.author);
 if(p.status!=='pending')throw conflict('This proposal is '+p.status+'. Open the latest pending revision.');
 if(sourceHash!==p.sourceHash)throw conflict('The reviewed source revision is stale. Reload the proposal.');
 const current=await lore.read(p.sourcePath);if(hash(current)!==p.sourceHash)throw conflict('OpenLore proposal changed after submission. Submit a new revision before reviewing.');
 return p;
}
export async function approveProposal(id,{content,sourceHash,actor='local-operator'}){
 const v=z.object({content:z.string().min(20).max(10000),sourceHash:z.string().length(64),actor:z.string().min(1).max(120)}).parse({content,sourceHash,actor});
 const ticketId=get('proposal',id).ticketId;
 return locked(ticketId,async()=>{
  if(/RELAY_PRIVATE_[A-Z0-9_]+/.test(v.content))throw new Error('Private fixture marker detected. Remove private details before promotion.');
  return withLore('reviewer',async lore=>{
   const p=await pendingSource(id,v.sourceHash,lore,v.actor),target=p.targetPath||'/approved/'+p.ticketId+'.md';
   const base=await readOptional(lore,target);if(p.baseApprovedHash!==undefined&&(base===null?null:hash(base))!==p.baseApprovedHash)throw conflict('Approved knowledge changed since this proposal was submitted. Submit a new revision against the latest document.');
   const approvedAt=now(),text='# Approved support response for '+p.ticketId+'\n\nStatus: approved\nTicket: '+p.ticketId+'\nRevision: '+(p.revision||1)+'\nProposal: '+p.id+'\nAuthor: '+p.author+'\nReviewed by: '+v.actor+'\nApproved at: '+approvedAt+'\nProposal SHA-256: '+p.sourceHash+'\n\n'+v.content;
   const intent=decision(p,'promotion-started',v.actor,{approvedPath:target,reviewedContent:v.content,reviewedContentHash:hash(v.content),approvedDocumentHash:hash(text)});
   try{await lore.write(target,text);const saved=await lore.read(target);if(hash(saved)!==hash(text))throw new Error('Promotion could not be confirmed. Inspect the destination before retrying.');}
   catch(e){decision(p,'promotion-needs-reconciliation',v.actor,{intentId:intent.id,error:String(e.message).slice(0,400)});throw e;}
   const approved={...p,status:'approved',reviewedBy:v.actor,reviewedAt:approvedAt,approvedPath:target,reviewedContent:v.content,reviewedContentHash:hash(v.content),approvedDocumentHash:hash(text)};put('proposal',approved);changeTicket(p.ticketId,{status:'Ready to reply'});decision(p,'approved',v.actor,{approvedPath:target,reviewedContentHash:approved.reviewedContentHash,approvedDocumentHash:approved.approvedDocumentHash});return approved;
  });
 });
}
export async function reviewDecision(id,{action,sourceHash,feedback,actor='local-operator'}){
 const v=z.object({action:z.enum(['request-changes','reject']),sourceHash:z.string().length(64),feedback:z.string().trim().min(3).max(3000),actor:z.string().min(1).max(120)}).parse({action,sourceHash,feedback,actor});
 return locked(get('proposal',id).ticketId,()=>withLore('reviewer',async lore=>{
  const p=await pendingSource(id,v.sourceHash,lore,v.actor),status=v.action==='reject'?'rejected':'changes-requested';
  const updated={...p,status,reviewedBy:v.actor,reviewedAt:now(),feedback:v.feedback};put('proposal',updated);decision(p,status,v.actor,{feedback:v.feedback});changeTicket(p.ticketId,{status:v.action==='reject'?'Triaged':'Changes requested'});return updated;
 }));
}
export async function cosignDocument({path,sourceHash,actor='local-operator'}){
 const root='/'+String(path).split('/')[1];if(reviewPolicies()[root]?.mode!=='cosign')throw Object.assign(new Error('This collection requires nominated approval, not cosigning.'),{status:403});requireReviewer(root,actor);
 return withLore('reviewer',async lore=>{const text=await lore.read(path);if(hash(text)!==sourceHash)throw conflict('Document changed. Read the current revision before cosigning.');
  const history=await lore.command('history');let author;for(const line of history.split('\n')){try{const row=JSON.parse(line);if(row.target===path&&row.hash===sourceHash){author=row.attribution;break;}}catch{}}
  if(author==='reviewer')throw conflict('A distinct human author cannot be verified for this reviewer-written revision.');
  if(!author)throw conflict('A matching write attribution was not found. This document cannot be cosigned yet.');
  requireReviewer(root,actor,author);const existing=list('cosign').find(c=>c.path===path&&c.sourceHash===sourceHash&&c.actor===actor);if(existing)return existing;const record=put('cosign',{id:randomUUID(),path,sourceHash,author:author||'unknown',actor,at:now()});audit('document.cosigned',{path,sourceHash,actor});return record;
 });
}
