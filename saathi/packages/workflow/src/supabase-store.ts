import { createHash } from 'node:crypto';
import { z } from 'zod';
import { inputSchema } from '../../shared/src/index.ts';
import { adultProtocol } from '../../clinical-content/src/index.ts';
import { intakeSchema, buttonInput, processReport, type Report } from './intake.ts';
import { fixtureInput } from './fixtures.ts';
import { savedSchema, WorkflowError, type Snapshot, type RecordEntry, type Patient } from './store.ts';
const queueSchema=savedSchema.extend({storage:z.literal('supabase'),patients:z.array(z.object({id:z.string(),name:z.string(),age:z.number(),language:z.string(),diagnosis:z.string(),initials:z.string()})),team:z.array(z.string())});
const recordSchema=savedSchema.shape.records.element;
/** Server-only, service-role adapter. Use only behind the existing loopback demo guard. */
export class SupabaseStore {
 private url:URL;
 constructor(url:string,private key:string,private transport:typeof fetch=fetch){
  this.url=new URL(url);
  if(this.url.protocol!=='https:'||!/^([a-z0-9]+)\.supabase\.co$/.test(this.url.hostname)||this.url.username||this.url.password||this.url.port||this.url.search||this.url.hash||!key)
   throw new WorkflowError(503,'Supabase storage configuration is incomplete. No local fallback is enabled.');
 }
 private async rpc(name:string,body:object={}){
  let response:Response;
  try{response=await this.transport(new URL(`/rest/v1/rpc/${name}`,this.url),{
   method:'POST',headers:{apikey:this.key,'Content-Type':'application/json',...(!this.key.startsWith('sb_secret_')?{Authorization:`Bearer ${this.key}`}:{})},
   body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),
  });}catch{throw new WorkflowError(503,'Supabase request failed or timed out. A write may have completed; retry with the same request ID or refresh the queue.');}
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok){
   const code=data&&typeof data==='object'&&'code' in data?String(data.code):'';
   if(code==='PT409'||code==='40001'||code==='23505')throw new WorkflowError(409,'Report or request ID conflict. Refresh the queue before retrying.');
   if(code==='P0002')throw new WorkflowError(404,'Synthetic patient or report not found.');
   if(code==='22023')throw new WorkflowError(409,'Invalid report or status transition. Acknowledge an open report before resolving it.');
   throw new WorkflowError(503,'Supabase storage is unavailable or not migrated. No local fallback is enabled.');
  }
  return data;
 }
 async queue():Promise<Snapshot & {storage:'supabase';patients:Patient[];team:string[]}>{
  try{return queueSchema.parse(await this.rpc('saathi_demo_queue')) as unknown as Snapshot & {storage:'supabase';patients:Patient[];team:string[]};}
  catch(e){if(e instanceof WorkflowError)throw e;throw new WorkflowError(503,'Supabase returned an incompatible queue format. Records were not changed.');}
 }
 async snapshot():Promise<Snapshot>{return this.queue();}
 async submit(raw:unknown):Promise<{record:RecordEntry;duplicate:boolean}>{
  const request=intakeSchema.parse(raw);
  if(request.scenario&&Object.keys(request.answers).length)throw new WorkflowError(400,'Choose a synthetic scenario or enter answers, not both.');
  const fingerprint=createHash('sha256').update(JSON.stringify({patientId:request.patientId,scenario:request.scenario,answers:request.answers})).digest('hex');
  const input=request.scenario?fixtureInput(request):buttonInput(request,{pack:'adult'});
  const report=processReport(input,request.scenario?'synthetic_fixture':'buttons',Boolean(request.answers.concerns));
  const result=await this.rpc('saathi_demo_submit',{p_request_id:request.requestId,p_patient_key:request.patientId,p_fingerprint:fingerprint,p_report:report,p_protocol:adultProtocol});
  return z.object({record:recordSchema,duplicate:z.boolean()}).parse(result) as unknown as {record:RecordEntry;duplicate:boolean};
 }
 async findRequest(requestId:string,fingerprint:string):Promise<RecordEntry|null>{
  const raw=await this.rpc('saathi_demo_lookup',{p_request_id:requestId,p_fingerprint:fingerprint});
  return raw===null?null:recordSchema.parse(raw) as unknown as RecordEntry;
 }
 async saveNarrative(requestId:string,patientId:string,fingerprint:string,report:Report){
  inputSchema.parse(report.input);
  return z.object({record:recordSchema,duplicate:z.boolean()}).parse(await this.rpc('saathi_demo_submit',{
   p_request_id:requestId,p_patient_key:patientId,p_fingerprint:fingerprint,p_report:report,p_protocol:adultProtocol,
  })) as unknown as {record:RecordEntry;duplicate:boolean};
 }
 async claimAnalysis(id:string){
  return z.object({claimed:z.boolean(),lease:z.uuid().optional(),record:recordSchema}).parse(await this.rpc('saathi_demo_claim_analysis',{target:id})) as unknown as {claimed:boolean;lease?:string;record:RecordEntry};
 }
 async completeAnalysis(id:string,lease:string,report:Report){
  inputSchema.parse(report.input);
  return recordSchema.parse(await this.rpc('saathi_demo_complete_analysis',{target:id,p_lease:lease,p_report:report})) as unknown as RecordEntry;
 }
 async importLocal(record:RecordEntry){
  recordSchema.parse(record);inputSchema.parse(record.report.input);
  const result=await this.rpc('saathi_demo_import',{p_record:record,p_protocol:adultProtocol});
  return z.object({record:recordSchema,duplicate:z.boolean()}).parse(result) as unknown as {record:RecordEntry;duplicate:boolean};
 }
 async transition(id:string,action:'acknowledge'|'resolve',expectedRevision:number):Promise<RecordEntry>{
  return recordSchema.parse(await this.rpc('saathi_demo_transition',{target:id,action,expected_revision:expectedRevision})) as unknown as RecordEntry;
 }
 async tick(){return z.object({changed:z.number().int().nonnegative()}).parse(await this.rpc('saathi_demo_tick'));}
}
