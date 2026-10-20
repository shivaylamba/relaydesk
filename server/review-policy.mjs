import {slackConfig} from './config.mjs';
const humanReviewers=()=>['local-operator',...slackConfig.reviewers.map(id=>'slack:'+id)];
export function reviewPolicies(){
 const defaults={'/approved':{mode:'nominated',reviewers:humanReviewers(),selfReview:false},'/engineering':{mode:'cosign',reviewers:humanReviewers(),selfReview:false},'/support':{mode:'cosign',reviewers:humanReviewers(),selfReview:false}};
 if(!process.env.RELAYDESK_REVIEW_POLICIES)return defaults;
 let overrides;try{overrides=JSON.parse(process.env.RELAYDESK_REVIEW_POLICIES);}catch{throw new Error('RELAYDESK_REVIEW_POLICIES must be valid JSON.');}
 for(const [root,value] of Object.entries(overrides)){
  if(!defaults[root]||!['nominated','cosign'].includes(value.mode)||!Array.isArray(value.reviewers)||!value.reviewers.length||!value.reviewers.every(x=>typeof x==='string'&&x.length<120))throw new Error('Invalid review policy for '+root);
  if(root==='/approved'&&value.mode!=='nominated')throw new Error('Customer-facing knowledge requires nominated approval in RelayDesk.');
  defaults[root]={mode:value.mode,reviewers:value.reviewers,selfReview:false};
 }
 return defaults;
}
export function requireReviewer(root,actor,author){
 const policy=reviewPolicies()[root];
 if(!policy||!policy.reviewers.includes(actor))throw Object.assign(new Error('This identity is not a nominated reviewer for '+root+'.'),{status:403});
 if(actor===author)throw Object.assign(new Error('Contributors cannot review their own submission.'),{status:403});
 return policy;
}
export function bodyOfProposal(p){return p.proposedContent||p.content.split('\n\n').slice(2).join('\n\n')||p.content;}
