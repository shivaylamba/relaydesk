/** Interactive walkthrough. Real provider/tool calls; never auto-approves a proposal. */
import readline from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
const base=process.env.RELAYDESK_URL||'http://localhost:3410';
const headers={'Content-Type':'application/json','X-RelayDesk-Key':process.env.RELAYDESK_OPERATOR_KEY||''};
async function api(path,body){const r=await fetch(base+'/api'+path,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw new Error(d.error);return d;}
async function run(id,role){const r=await api('/tickets/'+id+'/runs',{role});console.log('Started real '+role+' run:',r.id);while(true){await new Promise(r=>setTimeout(r,1000));const data=await api('/runs/'+r.id);if(data.status==='failed')throw new Error(data.error);if(data.status==='completed'){console.log(data.response);console.log('Sources:',data.sources);return data;}}}
const ui=readline.createInterface({input:stdin,output:stdout});
try{const ticket=await api('/tickets',{title:'Checkout timeout followed by duplicate bank entries',description:'Synthetic customer: Checkout timed out; I retried and now see two bank entries. What should I do?',customer:'Guided synthetic demo',priority:'High'});
 console.log('Ticket:',ticket.id,' — '+base+'/#ticket='+ticket.id);await run(ticket.id,'support');await ui.question('\nPress Enter to investigate with the separate engineering identity. ');await run(ticket.id,'engineering');
 console.log('\nOpen Review queue, edit and approve the customer-safe proposal.');await ui.question('After approval, press Enter to start a fresh support session. ');
 const d=await api('/tickets/'+ticket.id+'?role=support');if(!d.approved.length)throw new Error('No approved resolution yet. Review it in the UI first.');await run(ticket.id,'support');console.log('\nFinished. Export the support evidence from the ticket header. Slack delivery remains separate and explicit.');
}finally{ui.close();}
