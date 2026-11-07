import {NarrativePipeline} from '../../extraction/src/pipeline.ts';
import {ProviderError} from '../../extraction/src/index.ts';
import {SupabaseStore} from '../../workflow/src/supabase-store.ts';
import type {RecordEntry} from '../../workflow/src/store.ts';
import {TelegramAPI,TelegramError} from './api.ts';
import {TelegramState,type Task} from './state.ts';
import {planUpdate,queueResult,finishUpdate,receipt,updateSchema} from './engine.ts';
import {z} from 'zod';
export function taskRunner(store:SupabaseStore,api:TelegramAPI,keys:{sarvam:string;groq:string}){
 return async(task:Task):Promise<RecordEntry>=>{
  const origin={channel:'telegram' as const,externalId:task.externalId};
  if(task.kind==='buttons')return (await store.submit({requestId:task.requestId,patientId:task.patientId,answers:task.answers},origin)).record;
  const pipeline=new NarrativePipeline({findRequest:(...args)=>store.findRequest(...args),saveNarrative:(...args)=>store.saveNarrative(...args,origin),claimAnalysis:(...args)=>store.claimAnalysis(...args),completeAnalysis:(...args)=>store.completeAnalysis(...args),patientContext:id=>store.patientContext(id)},keys);
  const request={requestId:task.requestId,patientId:task.patientId,language:task.language,synthetic:true as const};
  if(task.kind==='text')return (await pipeline.text({...request,text:task.text})).record;
  // Reuse the server checkpoint even if Telegram's original voice file has expired.
  const saved=(await store.snapshot()).records.find(r=>r.requestId===task.requestId);
  if(saved){if(saved.patientId!==task.patientId||saved.report.origin?.externalId!==task.externalId||saved.report.source!=='voice')throw Error('Telegram checkpoint conflict.');return (await pipeline.analyze(saved)).record;}
  const bytes=await api.voice(task.fileId,task.duration??0,task.size);return (await pipeline.voice(request,bytes)).record;
 };
}
export type RunTask=(task:Task)=>Promise<RecordEntry>;
export class TelegramWorker {
 constructor(private state:TelegramState,private api:TelegramAPI,private runTask:RunTask,private log:(event:object)=>void=()=>{}){}
 async recover(){
  const initial=await this.state.snapshot();if(!initial.pending)return;
  if(initial.pending.task){
   let text:string;
   try{const linked=initial.chats[String(initial.pending.chatId)];if(!linked?.consentAt||Date.now()-linked.consentAt>24*60*60*1000||linked.patientId!==initial.pending.task.patientId)text='Pairing or synthetic-only consent expired. Request a fresh link; this report was not processed.';else text=receipt(await this.runTask(initial.pending.task));}
   catch(e){text=e instanceof TelegramError&&e.kind==='rejected'?e.message:e instanceof ProviderError?'The synthetic voice report could not be transcribed. Keep the clip and use /retry or send text.':'The report could not be confirmed. Check the dashboard before using /retry; the same request ID will be retained.';this.log({event:'processing_not_confirmed',kind:e instanceof ProviderError||e instanceof TelegramError?e.kind:'storage_or_validation'});}
   await this.state.transact(s=>queueResult(s,text));
  }
  let snapshot=await this.state.snapshot();
  for(let i=0;i<(snapshot.pending?.actions.length??0);i++){
   const a=snapshot.pending!.actions[i]!;
   if(a.status==='sending'){
    await this.mark(i,'unknown');continue;
   }
   if(a.status!=='pending')continue;
   await this.state.transact(s=>{s.pending!.actions[i]!.status='sending';});
   let status:'sent'|'failed'|'unknown'='sent';
   try{const result=await this.api.call(a.method,a.payload);if(a.method==='sendMessage')z.object({message_id:z.number().int()}).parse(result);else z.literal(true).parse(result);}catch(e){status=e instanceof TelegramError&&e.kind!=='unknown'?'failed':'unknown';}
   await this.mark(i,status);
   snapshot=await this.state.snapshot();
  }
  await this.state.transact(finishUpdate);
 }
 private async mark(index:number,status:'sent'|'failed'|'unknown'){
  await this.state.transact(s=>{const p=s.pending!;const a=p.actions[index]!;a.status=status;s.deliveries.push({updateId:p.updateId,at:new Date().toISOString(),status,kind:a.method});});
  this.log({event:'telegram_reply',status});
 }
 async accept(update:unknown){await this.state.transact(s=>planUpdate(s,update,this.state.botId));await this.recover();}
 async poll(signal:AbortSignal){
  await this.recover();
  while(!signal.aborted){
   const snapshot=await this.state.snapshot();let updates:unknown;
   try{updates=await this.api.call('getUpdates',{offset:snapshot.offset,timeout:25,limit:10,allowed_updates:['message','callback_query']},signal);}
   catch(e){if(signal.aborted)return;throw e;}
   for(const update of z.array(updateSchema).parse(updates)){if(signal.aborted)return;await this.accept(update);}
  }
 }
}
