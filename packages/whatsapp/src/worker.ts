import {createHash} from 'node:crypto';
import {NarrativePipeline} from '../../extraction/src/pipeline.ts';
import {TelegramState,type Task,type State} from '../../telegram/src/state.ts';
import {planUpdate,queueResult,finishUpdate} from '../../telegram/src/engine.ts';
import {familyReplies,GREETING,GREETING_PATTERN,closedMessage} from '../../workflow/src/service-config.ts';
import type {CarePlanEntry} from '../../workflow/src/care-plan.ts';
import {WhatsAppAPI,WhatsAppError} from './api.ts';
import {WhatsAppStore,type Inbound} from './store.ts';
import type {OnCallAlerts} from './oncall.ts';
import type {Reminders} from './reminders.ts';
export const isGreeting=(m:Inbound)=>m.kind==='text'&&GREETING_PATTERN.test(m.text??'');
export const isLoginCode=(m:Inbound)=>m.kind==='text'&&/^\s*login\s+\d{6}\s*$/i.test(m.text??'');
export const channelNumber=(phone:string)=>createHash('sha256').update(phone).digest().readUInt32BE(0);
export function planWhatsApp(state:State,id:number,message:Inbound,phone:string,now=Date.now()){
 const sender=Number(message.from),base={message_id:id,chat:{id:sender,type:'private'},from:{id:sender,is_bot:false}};
 let button=message.kind==='button'?message.buttonId:undefined;
 const draft=state.chats[message.from]?.draft;
 if(message.kind==='text'&&message.text==='/skip'&&draft)button=`q:${draft.nonce}:${draft.step}:skip`;
 const raw=button?{update_id:id,callback_query:{id:message.id,from:base.from,data:button,message:base}}:{update_id:id,message:{...base,...(message.kind==='text'?{text:message.text}:message.kind==='voice'?{voice:{file_id:message.mediaId}}:{})}};
 planUpdate(state,raw,channelNumber(phone),now,{name:'WhatsApp',namespace:phone,externalId:message.id});
 if(state.pending){state.pending.actions=state.pending.actions.filter(a=>a.method==='sendMessage');state.pending.receivedAt=message.timestamp*1000;state.pending.channelMessageId=message.id;}
}
export function runWhatsAppTask(store:WhatsAppStore,api:WhatsAppAPI,keys:{sarvam:string;groq:string}){
 return async(task:Task)=>{
  const origin={channel:'whatsapp' as const,externalId:task.externalId};
  if(task.kind==='buttons')return (await store.submit({requestId:task.requestId,patientId:task.patientId,answers:task.answers},origin)).record;
  const pipeline=new NarrativePipeline({findRequest:(...a)=>store.findRequest(...a),saveNarrative:(...a)=>store.saveNarrative(...a,origin),claimAnalysis:(...a)=>store.claimAnalysis(...a),completeAnalysis:(...a)=>store.completeAnalysis(...a)},keys);
  const request={requestId:task.requestId,patientId:task.patientId,language:task.language,synthetic:true as const};
  if(task.kind==='text')return (await pipeline.text({...request,text:task.text})).record;
  const saved=(await store.snapshot()).records.find(r=>r.requestId===task.requestId);
  if(saved){if(saved.patientId!==task.patientId||saved.report.origin?.channel!=='whatsapp'||saved.report.origin.externalId!==task.externalId||saved.report.source!=='voice')throw Error('Channel checkpoint conflict');return (await pipeline.analyze(saved)).record;}
  return (await pipeline.voice(request,await api.voice(task.fileId))).record;
 };
}
export class WhatsAppWorker {
 constructor(private state:TelegramState,private store:WhatsAppStore,private api:WhatsAppAPI,private runTask:ReturnType<typeof runWhatsAppTask>,private log:(event:object)=>void=()=>{},private oncall?:OnCallAlerts,private reminders?:Reminders){}
 async recover(){
  let snapshot=await this.state.snapshot();const p=snapshot.pending;if(!p)return;
  await this.store.binding(this.api.phoneId,p.chatId,snapshot.chats[String(p.chatId)]);
  if(p.task){let texts:string[];
   const session=snapshot.chats[String(p.chatId)];
   if(!session?.consentAt||Date.now()-session.consentAt>=86400000||session.patientId!==p.task.patientId)texts=['Synthetic-only consent expired. Request a fresh patient link; this report was not processed.'];
   else try{const record=await this.runTask(p.task);texts=familyReplies(record.report.evaluation.tier,record.report.processing?.extraction.status,record.report.evaluation.matched,record.report.input.fields);}catch{texts=['The report could not be confirmed. Check the dashboard before /retry. The same request ID will be retained.'];}
   await this.state.transact(s=>{for(const t of texts)queueResult(s,t);});
  }
  snapshot=await this.state.snapshot();
  for(let i=0;i<snapshot.pending!.actions.length;i++){
   const a=snapshot.pending!.actions[i]!;if(a.status==='sending'){await this.mark(i,'unknown');continue;}if(a.status!=='pending')continue;
   await this.state.transact(s=>{s.pending!.actions[i]!.status='sending';});let status:'accepted'|'unknown'|'failed'='accepted';
   try{await this.api.send(a,snapshot.pending!.receivedAt??0);}catch(e){status=e instanceof WhatsAppError&&e.kind!=='unknown'?'failed':'unknown';}
   await this.mark(i,status);
  }
  await this.state.transact(finishUpdate);await this.store.complete(this.api.phoneId,(await this.state.snapshot()).offset);
 }
 private async mark(i:number,status:'accepted'|'unknown'|'failed'){
  await this.state.transact(s=>{const p=s.pending!;p.actions[i]!.status=status;s.deliveries.push({updateId:p.updateId,at:new Date().toISOString(),status,kind:'whatsapp_reply'});});this.log({event:'whatsapp_reply',status});
 }
 async once(){
  await this.recover();const state=await this.state.snapshot();await this.store.complete(this.api.phoneId,state.offset);
  // An alert failure must not hold up family reports; it is retried on the next check.
  await this.oncall?.check().catch(()=>this.log({event:'oncall_check',status:'failed'}));
  await this.reminders?.check(state.chats).catch(()=>this.log({event:'reminder_check',status:'failed'}));
  const next=await this.store.next(this.api.phoneId,state.offset);if(!next)return false;
  // Every family message reopens WhatsApp's free 24-hour window for reminders.
  if(state.chats[next.message.from])await this.reminders?.seen(next.message);
  const consume=async()=>{await this.state.transact(s=>{s.offset=next.id+1;});await this.store.complete(this.api.phoneId,next.id+1);return true;};
  // Website sign-in codes are verified by the receiver; they are never reports.
  if(isLoginCode(next.message))return consume();
  if(await this.reminders?.inbound(next.message,state.chats))return consume();
  if(await this.oncall?.inbound(next.message)){await this.state.transact(s=>{s.offset=next.id+1;});await this.store.complete(this.api.phoneId,next.id+1);return true;}
  // A consented family's "Hi" opens the conversation instead of becoming an empty report.
  const chat=state.chats[next.message.from];
  // A closed patient (died or moved to another team) gets only the fixed OPD message; nothing is reported or triaged.
  const plans:Record<string,CarePlanEntry>|undefined=chat?.patientId&&chat.consentAt?await this.store.carePlans?.().catch(()=>({})):undefined;
  const closedPlan=chat?.patientId?plans?.[chat.patientId]?.plan:undefined;
  if(closedPlan?.closure){
   let status:'accepted'|'unknown'|'failed'='accepted';
   try{await this.api.send({method:'sendMessage',status:'pending',payload:{chat_id:Number(next.message.from),text:closedMessage(closedPlan.demographics.name)}},next.message.timestamp*1000);}catch(e){status=e instanceof WhatsAppError&&e.kind!=='unknown'?'failed':'unknown';}
   this.log({event:'whatsapp_closed_patient',status});return consume();
  }
  if(isGreeting(next.message)&&chat?.consentAt&&Date.now()-chat.consentAt<86400000&&!chat.draft){
   let status:'accepted'|'unknown'|'failed'='accepted';
   try{await this.api.send({method:'sendMessage',status:'pending',payload:{chat_id:Number(next.message.from),text:GREETING}},next.message.timestamp*1000);}catch(e){status=e instanceof WhatsAppError&&e.kind!=='unknown'?'failed':'unknown';}
   this.log({event:'whatsapp_greeting',status});await this.state.transact(s=>{s.offset=next.id+1;});await this.store.complete(this.api.phoneId,next.id+1);return true;
  }
  await this.state.transact(s=>planWhatsApp(s,next.id,next.message,this.api.phoneId));await this.recover();return true;
 }
 async poll(signal:AbortSignal){while(!signal.aborted){if(!await this.once())await new Promise<void>(resolve=>{if(signal.aborted){resolve();return;}const end=()=>{clearTimeout(timer);signal.removeEventListener('abort',end);resolve();};const timer=setTimeout(end,2000);signal.addEventListener('abort',end,{once:true});});}}
}
