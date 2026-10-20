import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
dotenv.config({path:path.join(ROOT,'.env'),quiet:true});
export const runtime=path.join(ROOT,'.runtime');fs.mkdirSync(runtime,{recursive:true,mode:0o700});
export const config={host:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||3410),lore:process.env.OPENLORE_URL||'http://127.0.0.1:48180',key:process.env.NEBIUS_API_KEY||'',base:(process.env.NEBIUS_BASE_URL||'https://api.tokenfactory.nebius.com/v1').replace(/\/$/,''),model:process.env.NEBIUS_MODEL||'Qwen/Qwen3-235B-A22B-Instruct-2507',operatorKey:process.env.RELAYDESK_OPERATOR_KEY||''};
export const slackConfig={enabled:process.env.SLACK_ENABLED==='true',delivery:process.env.SLACK_DELIVERY_ENABLED==='true',token:process.env.SLACK_BOT_TOKEN||'',appToken:process.env.SLACK_APP_TOKEN||'',team:process.env.SLACK_TEAM_ID||'',support:process.env.SLACK_SUPPORT_CHANNEL_ID||'',engineering:process.env.SLACK_ENGINEERING_CHANNEL_ID||'',review:process.env.SLACK_REVIEW_CHANNEL_ID||'',reviewers:(process.env.SLACK_REVIEWER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean)};
export function safeError(error){let text=String(error?.message||error);for(const value of [config.key,slackConfig.token,slackConfig.appToken,config.operatorKey])if(value)text=text.replaceAll(value,'[redacted]');return text.slice(0,600);}
