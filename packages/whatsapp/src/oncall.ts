import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {hashCode,type Action} from '../../telegram/src/state.ts';
import type {RecordEntry} from '../../workflow/src/store.ts';
import {WhatsAppError} from './api.ts';
import type {Inbound} from './store.ts';
/**
 * WhatsApp alert to one on-call care-team phone for every new RED report, from any channel.
 * Sends stay inside the free 24-hour window opened by the phone's own /oncall or Acknowledge;
 * an expired window is recorded and never falls back to a paid template.
 */
const DAY=24*60*60*1000;
const alertSchema=z.object({id:z.string(),at:z.string(),status:z.enum(['sending','accepted','failed','unknown','window_closed'])});
const onCallSchema=z.object({version:z.literal(1),invite:z.object({hash:z.string(),expires:z.number()}).optional(),sender:z.string().regex(/^\d{8,15}$/).optional(),registeredAt:z.number().optional(),lastInboundAt:z.number().optional(),alerts:z.array(alertSchema)});
export type OnCall=z.infer<typeof onCallSchema>;
export class OnCallState {
 constructor(private directory:string){}
 async transact<T>(operation:(s:OnCall)=>T):Promise<T>{
  await mkdir(this.directory,{recursive:true,mode:0o700});const lock=join(this.directory,'oncall.lock');let acquired=false;
  for(let i=0;i<100;i++){try{await mkdir(lock);acquired=true;break;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw Error('On-call state lock failed.');await new Promise(r=>setTimeout(r,25));}}
  if(!acquired)throw Error('On-call state is locked. Stop workers before inspecting a stale lock.');
  const file=join(this.directory,'oncall.json'),temporary=join(this.directory,`oncall-${randomUUID()}.tmp`);
  try{
   let state:OnCall={version:1,alerts:[]};try{state=onCallSchema.parse(JSON.parse(await readFile(file,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw Error('On-call state could not be read. Existing state was preserved.');}
   const result=operation(state);state.alerts=state.alerts.slice(-500);await writeFile(temporary,JSON.stringify(onCallSchema.parse(state)),{mode:0o600});await rename(temporary,file);return structuredClone(result);
  }finally{await rm(temporary,{force:true});await rm(lock,{recursive:true,force:true});}
 }
 snapshot(){return this.transact(s=>s);}
 async invite(now=Date.now()){const code=randomBytes(24).toString('base64url');await this.transact(s=>{s.invite={hash:hashCode(code),expires:now+15*60*1000};});return code;}
}
const ist=(ms:number)=>new Date(ms).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const text=(chatId:number,body:string,buttons?:{text:string;callback_data:string}[]):Action=>({method:'sendMessage',status:'pending',payload:{chat_id:chatId,text:body,...(buttons?{reply_markup:{inline_keyboard:[buttons]}}:{})}});
export const isOnCallMessage=(m:Inbound)=>(m.kind==='text'&&/^\/(oncall( [A-Za-z0-9_-]{32})?|offcall)$/.test(m.text??''))||(m.kind==='button'&&/^ack:[0-9a-f-]{36}$/.test(m.buttonId??''));
type Store={queue():Promise<{records:RecordEntry[];patients:{id:string;name:string}[]}>;transition(id:string,action:'acknowledge',revision:number):Promise<RecordEntry>};
type Sender={send(action:Action,receivedAt:number):Promise<unknown>};
export class OnCallAlerts {
 private lastCheck=0;
 constructor(private state:OnCallState,private store:Store,private api:Sender,private log:(event:object)=>void=()=>{},private interval=10000){}
 /** Records any message from the on-call phone as opening its window; consumes only on-call commands and Acknowledge taps. */
 async inbound(m:Inbound,now=Date.now()){
  const at=m.timestamp*1000;
  if(!isOnCallMessage(m)){await this.state.transact(s=>{if(s.sender===m.from)s.lastInboundAt=Math.max(s.lastInboundAt??0,at);});return false;}
  const chat=Number(m.from);let reply:Action|undefined;
  if(m.kind==='text'){
   const code=m.text!.split(' ')[1];
   reply=await this.state.transact(s=>{
    if(code){
     if(!s.invite||s.invite.expires<now||s.invite.hash!==hashCode(code))return text(chat,'This on-call link has expired or was already used. Ask for a new one.');
     delete s.invite;Object.assign(s,{sender:m.from,registeredAt:now,lastInboundAt:at});
     return text(chat,`You are now the Saathi demo on-call contact. New RED reports (synthetic data) will be sent here until ${ist(at+DAY)}. Send /oncall at the start of each shift to keep alerts coming; /offcall stops them. No real patient is connected.`);
    }
    if(s.sender!==m.from)return text(chat,'This number is not registered for Saathi on-call alerts. Ask the care team for a private on-call link.');
    if(m.text==='/offcall'){delete s.sender;delete s.registeredAt;delete s.lastInboundAt;return text(chat,'On-call alerts stopped for this number. Ask for a new link to register again.');}
    s.lastInboundAt=Math.max(s.lastInboundAt??0,at);return text(chat,`On-call alerts are on until ${ist(at+DAY)}.`);
   });
  }else{
   const id=m.buttonId!.slice(4),registered=await this.state.transact(s=>{if(s.sender!==m.from)return false;s.lastInboundAt=Math.max(s.lastInboundAt??0,at);return true;});
   if(!registered)reply=text(chat,'Only the registered on-call number can acknowledge Saathi alerts.');
   else{
    const queue=await this.store.queue(),record=queue.records.find(r=>r.id===id),name=queue.patients.find(p=>p.id===record?.patientId)?.name??'this patient';
    if(!record)reply=text(chat,'That report was not found. Check the Saathi dashboard.');
    else if(record.status!=='open')reply=text(chat,`The report for ${name} is already ${record.status==='acked'?'acknowledged':'resolved'}.`);
    else try{await this.store.transition(record.id,'acknowledge',record.revision);reply=text(chat,`Acknowledged in Saathi for ${name}. Escalation has stopped. It is recorded as the simulated Demo doctor 1.`);this.log({event:'oncall_ack'});}
    catch{reply=text(chat,'The report changed in the dashboard before this tap. Check it there; nothing else was changed.');}
   }
  }
  try{await this.api.send(reply,at);}catch(e){this.log({event:'oncall_reply',status:e instanceof WhatsAppError&&e.kind!=='unknown'?'failed':'unknown'});}
  return true;
 }
 /** Sends at most five new RED alerts per check; a send interrupted by a crash becomes "unknown" and is never repeated. */
 async check(now=Date.now()){
  if(now-this.lastCheck<this.interval)return;this.lastCheck=now;
  const s=await this.state.transact(s=>{for(const a of s.alerts)if(a.status==='sending')a.status='unknown';return s;});
  if(!s.sender||!s.registeredAt)return;
  const queue=await this.store.queue(),seen=new Set(s.alerts.map(a=>a.id));
  const fresh=queue.records.filter(r=>r.report.evaluation.tier==='RED'&&r.status==='open'&&Date.parse(r.createdAt)>=s.registeredAt!&&!seen.has(r.id)).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(0,5);
  for(const r of fresh){
   const open=now-(s.lastInboundAt??0)<DAY-60000;
   await this.state.transact(x=>{x.alerts.push({id:r.id,at:new Date(now).toISOString(),status:open?'sending':'window_closed'});});
   if(!open){this.log({event:'oncall_alert',status:'window_closed'});continue;}
   const name=queue.patients.find(p=>p.id===r.patientId)?.name??r.patientId,rules=r.report.evaluation.traces.filter(t=>t.outcome===true).map(t=>`${t.ruleId} ${t.label}`);
   const body=[`Saathi demo alert · RED · synthetic data`,`${name} · ${ist(Date.parse(r.createdAt))} · via ${r.report.origin?.channel==='whatsapp'?'WhatsApp':r.report.origin?.channel==='telegram'?'Telegram':'web'}`,...(rules.length?rules:r.report.evaluation.matched).slice(0,4).map(x=>`• ${x}`),`Review the caregiver's words in the Saathi dashboard. Tap Acknowledge to stop escalation.`,`Alerts continue until ${ist((s.lastInboundAt??0)+DAY)}; send /oncall to extend.`].join('\n');
   let status:'accepted'|'failed'|'unknown'='accepted';
   try{await this.api.send(text(Number(s.sender),body.slice(0,1024),[{text:'Acknowledge',callback_data:`ack:${r.id}`}]),s.lastInboundAt!);}catch(e){status=e instanceof WhatsAppError&&e.kind!=='unknown'?'failed':'unknown';}
   await this.state.transact(x=>{const a=x.alerts.find(a=>a.id===r.id);if(a)a.status=status;});this.log({event:'oncall_alert',status});
  }
 }
}
