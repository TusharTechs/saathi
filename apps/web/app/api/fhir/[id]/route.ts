import { guard, store, fail } from '../../../../lib/server';
import { toFhirBundle, WorkflowError } from '../../../../../../packages/workflow/src/index';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  try{
    guard(request);const {id}=await context.params,queue=await store.queue();
    const record=queue.records.find(r=>r.id===id),patient=record&&queue.patients.find(p=>p.id===record.patientId);
    if(!record||!patient)throw new WorkflowError(404,'Unknown report');
    return new Response(JSON.stringify(toFhirBundle(record,patient),null,2),{headers:{'Content-Type':'application/fhir+json; charset=utf-8','Cache-Control':'no-store','Content-Disposition':`attachment; filename="saathi-${id}.fhir.json"`}});
  }catch(e){return fail(e);}
}
