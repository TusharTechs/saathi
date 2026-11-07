import {createHash} from 'node:crypto';
import {z} from 'zod';
import {processReport,WorkflowError,type Report,type RecordEntry,type Processing} from '../../workflow/src/index.ts';
import {transcribe,extract,ProviderError,languages,type Language} from './index.ts';
import type {Input,Context} from '../../shared/src/index.ts';
export const narrativeSchema=z.object({requestId:z.uuid(),patientId:z.enum(['demo-ramesh','demo-lakshmi','demo-fatima','demo-suresh','demo-meena']),language:z.enum(languages),synthetic:z.literal(true),text:z.string().trim().min(1).max(4000)}).strict();
export type NarrativeStore={
 findRequest(id:string,fingerprint:string):Promise<RecordEntry|null>;
 saveNarrative(id:string,patient:string,fingerprint:string,report:Report):Promise<{record:RecordEntry;duplicate:boolean}>;
 claimAnalysis(id:string):Promise<{claimed:boolean;lease?:string;record:RecordEntry}>;
 completeAnalysis(id:string,lease:string,report:Report):Promise<RecordEntry>;
 /** Patient context from the hospital record (usual pain score, morphine). Optional: without it, context stays unknown. */
 patientContext?(patientId:string):Promise<Context>;
};
type Providers={speech:typeof transcribe;extract:typeof extract};
export class NarrativePipeline {
 constructor(private store:NarrativeStore,private keys:{sarvam:string;groq:string},private providers:Providers={speech:transcribe,extract}){}
 private fingerprint(value:object){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
 async analyze(record:RecordEntry){
  if(!['voice','text'].includes(record.report.source))throw new WorkflowError(400,'Only voice or text reports can be extracted.');
  const claim=await this.store.claimAnalysis(record.id);
  if(!claim.claimed||!claim.lease)return {record:claim.record,duplicate:true};
  const old=claim.record.report;const message=old.input.messages[0]!;
  let report:Report;
  const processing:Processing=old.processing!;
  try{
   // The model sees only the family's words; the patient context saved with the report is kept unchanged.
   const input={...await this.providers.extract(message.text,message.id,this.keys.groq),context:old.input.context};
   report={...processReport(input,old.source,true),processing:{...processing,extraction:{provider:'groq',model:'openai/gpt-oss-120b',status:'complete'}}};
  }catch(error){
   report={...processReport({...old.input,fields:{}},old.source,true),processing:{...processing,extraction:{provider:'groq',model:'openai/gpt-oss-120b',status:'failed',failureCode:error instanceof ProviderError?error.kind:'invalid_response'}}};
  }
  if(old.origin)report.origin=old.origin;
  return {record:await this.store.completeAnalysis(record.id,claim.lease,report),duplicate:false};
 }
 private async persist(requestId:string,patientId:string,fingerprint:string,text:string,source:'voice'|'text',processing:Processing){
  const context=await this.store.patientContext?.(patientId)??{pack:'adult'};
  const input:Input={messages:[{id:requestId,text}],fields:{},context};
  // Persist before waiting for the model. This independently preserves keyword flags.
  const saved=await this.store.saveNarrative(requestId,patientId,fingerprint,{...processReport(input,source,true),processing});
  return this.analyze(saved.record);
 }
 async text(raw:unknown){
  const r=narrativeSchema.parse(raw);const fingerprint=this.fingerprint({source:'text',patientId:r.patientId,language:r.language,text:r.text});
  const existing=await this.store.findRequest(r.requestId,fingerprint);if(existing)return this.analyze(existing);
  return this.persist(r.requestId,r.patientId,fingerprint,r.text,'text',{language:r.language,extraction:{provider:'groq',model:'openai/gpt-oss-120b',status:'pending'}});
 }
 async voice(raw:unknown,bytes:Uint8Array){
  const r=narrativeSchema.omit({text:true}).parse(raw);
  const fingerprint=this.fingerprint({source:'voice',patientId:r.patientId,language:r.language,audioHash:createHash('sha256').update(bytes).digest('hex')});
  const existing=await this.store.findRequest(r.requestId,fingerprint);if(existing)return this.analyze(existing);
  const spoken=await this.providers.speech(bytes,r.language as Language,this.keys.sarvam);
  return this.persist(r.requestId,r.patientId,fingerprint,spoken.text,'voice',{language:spoken.language,transcription:{provider:'sarvam',model:'saaras:v4'},extraction:{provider:'groq',model:'openai/gpt-oss-120b',status:'pending'}});
 }
}
