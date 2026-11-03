import { guard, json, fail } from '../../../lib/server';
import { workspace } from '../../../lib/workspace';
import { familyReply } from '../../../../../packages/workflow/src/index';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** A signed-in family sees only their own patient's details, plan, appointments and the replies to their requests. */
export async function GET(request:Request){
  try{
    const session=guard(request,false,'json',['family']),ws=await workspace(),p=ws.patients.find(p=>p.id===session.patientId);
    if(!p)return json({error:'Patient not found.'},404);const entry=ws.carePlans[p.id];
    const requests=ws.records.filter(r=>r.patientId===p.id).slice(-10).reverse().map(r=>({id:r.id,createdAt:r.createdAt,status:r.status,reply:familyReply(r.report.evaluation.tier,r.report.processing?.extraction.status)}));
    return json({patient:{name:entry?.plan.demographics.name??p.name,age:entry?.plan.demographics.age??p.age,saathiId:p.saathiId,hospital:entry?.plan.hospital.name??null,hospitalId:entry?.plan.hospital.hospitalId??null},medications:entry?.plan.medications.filter(m=>!m.rescue)??[],appointments:entry?.plan.appointments??[],requests,fees:ws.service.fees});
  }catch(e){return fail(e);}
}
