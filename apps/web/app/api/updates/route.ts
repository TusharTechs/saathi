import { z } from 'zod';
import { guard, body, store, json, fail } from '../../../lib/server';
import { SLOTS } from '../../../../../packages/workflow/src/care-plan';
import type { CarePlanEntry } from '../../../../../packages/workflow/src/index';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ist=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
// Families (or staff on their behalf) report between calls: today's pain score, medicines given, hospital admission or discharge.
const schema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('pain'),value:z.number().int().min(0).max(10),patientId:z.string().optional()}).strict(),
  z.object({kind:z.enum(['admitted','discharged']),note:z.string().trim().max(300).default(''),patientId:z.string().optional()}).strict(),
  z.object({kind:z.literal('dose'),slot:z.enum(SLOTS),status:z.enum(['given','not_given']),patientId:z.string().optional()}).strict(),
]);
export async function POST(request:Request){
  try{
    const session=guard(request,true,'json',['family','medical']),input=schema.parse(await body(request));
    const patientId=session.role==='family'?session.patientId!:input.patientId;if(!patientId)return json({error:'Choose a patient.'},400);
    const source=session.role==='family'?'web' as const:'staff' as const;
    if(input.kind==='dose'){
      const plans:Record<string,CarePlanEntry>=await store.carePlans(),plan=plans[patientId]?.plan,meds=plan?.medications.filter(m=>!m.rescue&&m.slots.includes(input.slot))??[];
      if(!meds.length)return json({error:'No regular medicines are scheduled at that time.'},400);
      for(const m of meds)await store.logDose(patientId,m.key,ist(),input.slot,input.status,'web');
      return json({logged:meds.length});
    }
    return json(await store.careEvent(patientId,input.kind,input.kind==='pain'?input.value:null,input.kind==='pain'?null:input.note||null,source));
  }catch(e){return fail(e);}
}
export async function GET(request:Request){
  try{const session=guard(request,false,'json',['medical','family']);const q=new URL(request.url).searchParams.get('patient');
    const patientId=session.role==='family'?session.patientId!:q;if(!patientId)return json({error:'Choose a patient.'},400);
    return json(await store.careEvents(patientId));}catch(e){return fail(e);}
}
