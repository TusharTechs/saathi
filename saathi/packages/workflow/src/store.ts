import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { intakeSchema, buttonInput, processReport, processingSchema, originSchema, type Report } from './intake.ts';
import { fixtureInput } from './fixtures.ts';

export type Patient={id:string;name:string;age:number;language:string;diagnosis:string;initials:string};
export const patients:Patient[]=[
  {id:'demo-ramesh',name:'Ramesh K.',age:64,language:'Hindi',diagnosis:'Oral cancer',initials:'RK'},
  {id:'demo-lakshmi',name:'Lakshmi S.',age:58,language:'Kannada',diagnosis:'Breast cancer',initials:'LS'},
  {id:'demo-fatima',name:'Fatima A.',age:47,language:'Hindi',diagnosis:'Cervical cancer',initials:'FA'},
  {id:'demo-suresh',name:'Suresh P.',age:71,language:'English',diagnosis:'Lung cancer',initials:'SP'},
  {id:'demo-meena',name:'Meena R.',age:56,language:'Kannada',diagnosis:'Breast cancer',initials:'MR'},
];
export const team=['Demo doctor 1','Demo doctor 2','Demo coordinator'] as const;
export type Event={id:string;at:string;type:'created'|'acknowledged'|'resolved'|'escalated'|'escalation_exhausted'|'imported'|'analysis_started'|'analysis_completed'|'analysis_failed'|'reopened';actor:string;details:string};
export type RecordEntry={id:string;patientId:string;requestId:string;fingerprint:string;createdAt:string;status:'open'|'acked'|'resolved';revision:number;escalationLevel:number;lastEscalatedAt:string;exhausted:boolean;report:Report;events:Event[]};
export type Snapshot={version:1;records:RecordEntry[]};
export class WorkflowError extends Error {constructor(public code:number,message:string){super(message);}}
export const savedSchema=z.object({version:z.literal(1),records:z.array(z.object({
  id:z.uuid(),patientId:z.string(),requestId:z.uuid(),fingerprint:z.string(),createdAt:z.iso.datetime({offset:true}),status:z.enum(['open','acked','resolved']),revision:z.number().int(),escalationLevel:z.number().int().min(0).max(2),lastEscalatedAt:z.iso.datetime({offset:true}),exhausted:z.boolean(),
  report:z.object({input:z.object({messages:z.array(z.object({id:z.string(),text:z.string()})),fields:z.record(z.string(),z.unknown()),context:z.record(z.string(),z.unknown())}),evaluation:z.object({mode:z.literal('demo_only'),protocolVersion:z.string(),tier:z.enum(['RED','AMBER','GREEN']).nullable(),status:z.enum(['complete','needs_followup','unsupported_pack']),matched:z.array(z.string()),unknownRuleIds:z.array(z.string()),followupFields:z.array(z.string()),traces:z.array(z.unknown())}),safetyNet:z.array(z.unknown()),source:z.enum(['buttons','synthetic_fixture','voice','text']),needsTextReview:z.boolean(),processing:processingSchema.optional(),origin:originSchema.optional()}),
  events:z.array(z.object({id:z.uuid(),at:z.iso.datetime({offset:true}),type:z.enum(['created','acknowledged','resolved','escalated','escalation_exhausted','imported','analysis_started','analysis_completed','analysis_failed','reopened']),actor:z.string(),details:z.string()})),
}))});
/** Single-host synthetic store. Directory lock serializes independent route bundles/processes. */
export class DemoStore {
  constructor(private directory:string,private clock=()=>new Date()){}
  private event(type:Event['type'],details:string,actor='Demo system'):Event {return {id:randomUUID(),at:this.clock().toISOString(),type,actor,details};}
  private async transact<T>(operation:(state:Snapshot)=>T,write=true):Promise<T>{
    await mkdir(this.directory,{recursive:true,mode:0o700});
    const lock=join(this.directory,'transaction.lock');
    let acquired=false;
    for(let i=0;i<100;i++){
      try {await mkdir(lock);acquired=true;break;}
      catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST') throw e; await new Promise(r=>setTimeout(r,25));}
    }
    if(!acquired) throw new WorkflowError(503,'Demo store is busy. Retry; a stale lock may require local recovery.');
    try {
      let state:Snapshot={version:1,records:[]};
      try {state=savedSchema.parse(JSON.parse(await readFile(join(this.directory,'queue.json'),'utf8'))) as unknown as Snapshot;}
      catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT') throw new WorkflowError(503,'Demo store could not be read. Existing records were preserved.');}
      const result=operation(state);
      if(write){
        const temporary=join(this.directory,`queue.${randomUUID()}.tmp`);
        try {await writeFile(temporary,JSON.stringify(state,null,2),{mode:0o600}); await rename(temporary,join(this.directory,'queue.json'));}
        finally{await rm(temporary,{force:true});}
      }
      return structuredClone(result);
    }finally{await rm(lock,{recursive:true,force:true});}
  }
  async snapshot(){return this.transact(s=>s,false);}
  async queue(){return {...await this.snapshot(),patients,team:[...team],storage:'local' as const};}
  async submit(raw:unknown){
    const request=intakeSchema.parse(raw);
    if(!patients.some(p=>p.id===request.patientId)) throw new WorkflowError(404,'Unknown synthetic patient');
    if(request.scenario && Object.keys(request.answers).length) throw new WorkflowError(400,'Choose a synthetic scenario or enter answers, not both.');
    const fingerprint=createHash('sha256').update(JSON.stringify({patientId:request.patientId,scenario:request.scenario,answers:request.answers})).digest('hex');
    return this.transact(state=>{
      const previous=state.records.find(r=>r.requestId===request.requestId);
      if(previous){if(previous.fingerprint!==fingerprint) throw new WorkflowError(409,'Request ID already used with different answers');return {record:previous,duplicate:true};}
      const input=request.scenario?fixtureInput(request):buttonInput(request,{pack:'adult'});
      const report=processReport(input,request.scenario?'synthetic_fixture':'buttons',Boolean(request.answers.concerns));
      const at=this.clock().toISOString();
      const record:RecordEntry={id:randomUUID(),patientId:request.patientId,requestId:request.requestId,fingerprint,createdAt:at,status:'open',revision:1,escalationLevel:0,lastEscalatedAt:at,exhausted:false,report,events:[this.event('created',`Local report received; tier ${report.evaluation.tier??'pending'}. External notifications disabled.`)]};
      state.records.push(record);return {record,duplicate:false};
    });
  }
  async transition(id:string,action:'acknowledge'|'resolve',expectedRevision:number){
    return this.transact(state=>{
      const r=state.records.find(r=>r.id===id);if(!r) throw new WorkflowError(404,'Report not found');
      if(r.revision!==expectedRevision) throw new WorkflowError(409,'Report changed. Refresh and try again.');
      const next=action==='acknowledge'?'acked':'resolved';
      if((action==='acknowledge' && r.status!=='open') || (action==='resolve' && r.status!=='acked')) throw new WorkflowError(409,'Acknowledge an open report before resolving it.');
      r.status=next;r.revision++;r.events.push(this.event(action==='acknowledge'?'acknowledged':'resolved',`Status changed to ${next}.`,'Demo doctor 1'));return r;
    });
  }
  async tick(){
    return this.transact(state=>{
      let changed=0;
      for(const r of state.records){
        if(r.report.evaluation.tier!=='RED'||r.status!=='open'||r.exhausted||this.clock().getTime()-Date.parse(r.lastEscalatedAt)<15*60*1000) continue;
        if(r.escalationLevel<2){r.escalationLevel++;r.events.push(this.event('escalated',`Demo escalation to ${team[r.escalationLevel]}; no notification sent.`));}
        else {r.exhausted=true;r.events.push(this.event('escalation_exhausted','All demo escalation contacts reached. Remains open for human review.'));}
        r.lastEscalatedAt=this.clock().toISOString();r.revision++;changed++;
      }
      return {changed};
    });
  }
}
