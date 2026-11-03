import {randomUUID} from 'node:crypto';
import {CloudDocs} from '../../workflow/src/cloud-docs.ts';
import {TelegramState} from '../../telegram/src/state.ts';
import {WhatsAppAPI} from './api.ts';
import {WhatsAppStore} from './store.ts';
import {WhatsAppWorker,runWhatsAppTask,channelNumber} from './worker.ts';
import {OnCallAlerts,OnCallState} from './oncall.ts';
import {Reminders,ReminderState} from './reminders.ts';
type Env=Record<string,string|undefined>;
export const cloudKeys=(phoneId:string)=>({chat:`whatsapp:${channelNumber(phoneId)}`,oncall:`oncall:${phoneId}`,reminders:`reminders:${phoneId}`});
export const cloudDocs=(env:Env)=>new CloudDocs(env.NEXT_PUBLIC_SUPABASE_URL??'',env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY||'');
/** The three worker states, kept in Supabase (SAATHI_WORKER_STATE=supabase) or in local JSON files. */
export function workerStates(phoneId:string,directory:string,env:Env){
 const id=channelNumber(phoneId);
 if(env.SAATHI_WORKER_STATE!=='supabase')return {chat:new TelegramState(directory,id,'whatsapp'),oncall:new OnCallState(directory),reminders:new ReminderState(directory),cloud:null};
 const docs=cloudDocs(env),k=cloudKeys(phoneId);
 return {chat:new TelegramState(directory,id,'whatsapp',{docs,key:k.chat}),oncall:new OnCallState(directory,{docs,key:k.oncall}),reminders:new ReminderState(directory,{docs,key:k.reminders}),cloud:docs};
}
export function buildWorker(env:Env,directory:string,log:(e:object)=>void=()=>{}){
 const api=new WhatsAppAPI(env.WA_PHONE_NUMBER_ID??'',env.WA_ACCESS_TOKEN??'',env.WA_GRAPH_VERSION??'v26.0');
 const store=new WhatsAppStore(env.NEXT_PUBLIC_SUPABASE_URL??'',env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY||'');
 const s=workerStates(api.phoneId,directory,env);
 const worker=new WhatsAppWorker(s.chat,store,api,runWhatsAppTask(store,api,{sarvam:env.SARVAM_API_KEY??'',groq:env.GROQ_API_KEY??''}),log,new OnCallAlerts(s.oncall,store,api,log),new Reminders(s.reminders,store,api,log));
 return {api,store,worker,...s};
}
/**
 * One serverless pass: take the lease, drain the inbox for up to `budgetMs`, check reminders and on-call alerts,
 * advance escalations, release. A second caller while the lease is held returns at once.
 */
export async function runPass(env:Env,budgetMs=40000,log:(e:object)=>void=()=>{}){
 const {worker,store,cloud}=buildWorker(env,'/tmp/saathi-unused',log);
 if(!cloud)throw Error('Serverless passes need SAATHI_WORKER_STATE=supabase.');
 const holder=randomUUID();if(!await cloud.acquire('whatsapp-worker',holder,Math.ceil(budgetMs/1000)+20))return {busy:true,processed:0,escalated:0};
 try{
  const end=Date.now()+budgetMs;let processed=0;
  while(Date.now()<end&&await worker.once())processed++;
  const {changed}=await store.tick();
  return {busy:false,processed,escalated:changed};
 }finally{await cloud.release('whatsapp-worker',holder);}
}
