// Reproducible synthetic integration checks against the real local OpenLore instance.
// This is a policy/workflow check, not an LLM evaluation or independent human approval.
import fs from 'node:fs';
import {createTicket,changeTicket} from '../server/store.mjs';
import {Lore,hash} from '../server/lore.mjs';
import {submitProposal,approveProposal,reviewDecision,cosignDocument} from '../server/review.mjs';
import {requireReviewer} from '../server/review-policy.mjs';
const dir='docs/evidence/review-'+new Date().toISOString().replace(/[-:]/g,'').replace(/\..*/,'Z');fs.mkdirSync(dir,{recursive:true});
const checks=[],snapshots=[];const check=(name,passed,detail)=>{checks.push({name,passed:!!passed,detail});fs.writeFileSync(dir+'/checks.json',JSON.stringify(checks,null,2));if(!passed)throw new Error(name);};
async function denied(name,fn,pattern){try{await fn();check(name,false,'Unexpected success');}catch(e){check(name,pattern.test(e.message),e.message);}}
const eng=new Lore('engineering'),support=new Lore('support'),reviewer=new Lore('reviewer');
const t=createTicket({title:'Verification · exact revision review',description:'Synthetic verification of nomination, stale revisions and safe publication. Not a customer incident.',customer:'RelayDesk verification'});
try{
 const caps=await support.command('lore docsets');check('support collection discovery excludes contributions',!caps.includes('contributions'),caps);
 await denied('OpenLore denies support backend read',()=>support.command('cat /engineering/checkout-investigation.md'),/file does not exist/);
 const content='Synthetic guidance: two bank entries do not confirm two settled charges. Ask which entries are pending or settled; do not promise a refund or a delivery date.';
 const submit=()=>submitProposal({ticketId:t.id,title:'Synthetic reviewed checkout guidance',content,author:'engineering-agent',lore:eng});
 let p=await submit();snapshots.push(p);
 await denied('OpenLore denies support pending draft read',()=>support.command('cat '+p.sourcePath),/file does not exist/);
 await denied('non-nominated actor denied',()=>approveProposal(p.id,{content,sourceHash:p.sourceHash,actor:'engineering-agent'}),/not a nominated reviewer/);
 const oldPolicy=process.env.RELAYDESK_REVIEW_POLICIES;process.env.RELAYDESK_REVIEW_POLICIES=JSON.stringify({'/approved':{mode:'nominated',reviewers:['engineering-agent']}});
 await denied('self-approval denied even when nominated',()=>requireReviewer('/approved','engineering-agent','engineering-agent'),/own submission/);
 if(oldPolicy===undefined)delete process.env.RELAYDESK_REVIEW_POLICIES;else process.env.RELAYDESK_REVIEW_POLICIES=oldPolicy;
 await denied('stale submitted hash rejected',()=>approveProposal(p.id,{content,sourceHash:'0'.repeat(64)}),/stale/);
 await eng.read(p.sourcePath);await eng.write(p.sourcePath,p.content+'\nChanged after submission.\n');
 await denied('remote source edit invalidates review',()=>approveProposal(p.id,{content,sourceHash:p.sourceHash}),/changed after submission/);
 const p2=await submit();snapshots.push(p2);check('resubmission uses a unique source path',p.sourcePath!==p2.sourcePath);
 await denied('superseded revision cannot be approved',()=>approveProposal(p.id,{content,sourceHash:p.sourceHash}),/superseded/);
 const requested=await reviewDecision(p2.id,{action:'request-changes',sourceHash:p2.sourceHash,feedback:'Keep uncertainty explicit and remove unsupported commitments.'});check('request changes prevents publication',requested.status==='changes-requested');
 const p3=await submit();snapshots.push(p3);const approved=await approveProposal(p3.id,{content,sourceHash:p3.sourceHash});
 const canonical=await support.read(approved.approvedPath);check('support reads exact approved revision',hash(canonical)===approved.approvedDocumentHash);check('approval records exact reviewed text',hash(content)===approved.reviewedContentHash);
 const p4=await submit();snapshots.push(p4);await reviewer.read(p4.targetPath);await reviewer.write(p4.targetPath,canonical+'\nConcurrent maintainer update.\n');
 await denied('changed destination invalidates stale proposal',()=>approveProposal(p4.id,{content,sourceHash:p4.sourceHash}),/changed since this proposal/);
 await reviewer.read(p4.targetPath);await reviewer.write(p4.targetPath,canonical);await reviewDecision(p4.id,{action:'reject',sourceHash:p4.sourceHash,feedback:'Verification complete; reject the unused stale revision.'});
 const note='/engineering/'+t.id+'.md';await eng.write(note,'# Synthetic internal observation\nThis is an investigation note, not customer-facing approved guidance.\n');const body=await eng.read(note);
 const signed=await cosignDocument({path:note,sourceHash:hash(body)});check('cosign tied to current attributed content',signed.sourceHash===hash(body)&&signed.author==='engineering-agent');
 await eng.read(note);await eng.write(note,body+'\nNew unendorsed revision.\n');check('edit does not inherit prior cosign',signed.sourceHash!==hash(await eng.read(note)));
 await denied('approved docset cannot bypass nominated review with cosign',()=>cosignDocument({path:approved.approvedPath,sourceHash:hash(canonical)}),/nominated approval/);
 changeTicket(t.id,{status:'Resolved'});fs.writeFileSync(dir+'/proposals.json',JSON.stringify(snapshots,null,2));
 fs.writeFileSync(dir+'/summary.json',JSON.stringify({passed:true,ticketId:t.id,checks:checks.length,scope:'Actual OpenLore MCP operations and RelayDesk policy APIs. Synthetic scripted workflow checks; no model responses or independent human review claimed.'},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,ticketId:t.id,evidence:dir}));
}catch(e){fs.writeFileSync(dir+'/failure.json',JSON.stringify({error:e.message,ticketId:t.id},null,2));console.error(e.message);process.exitCode=1;}
finally{await Promise.allSettled([eng.close(),support.close(),reviewer.close()]);}
