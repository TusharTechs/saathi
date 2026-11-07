import { guard, json, fail } from '../../../lib/server';
import { workspace } from '../../../lib/workspace';
import { store } from '../../../lib/server';
import { verifyRx } from '../../../../../packages/workflow/src/prescription';
import { familyReplies } from '../../../../../packages/workflow/src/index';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** A signed-in family sees only their own patient's details, plan, appointments and the replies to their requests. */
export async function GET(request:Request){
  try{
    const session=guard(request,false,'json',['family']),ws=await workspace(),p=ws.patients.find(p=>p.id===session.patientId);
    if(!p)return json({error:'Patient not found.'},404);const entry=ws.carePlans[p.id];
    const [events,rx]=await Promise.all([store.careEvents(p.id),store.prescriptions(p.id)]);
    const secret=process.env.SAATHI_SESSION_SECRET||process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
    // Hospital pricing pattern: a follow-up within the window costs a fraction of the first consultation.
    const lastCall=ws.records.filter(r=>r.patientId===p.id).map(r=>Date.parse(r.createdAt)).sort((a,b)=>b-a)[0];
    const followUp=Boolean(lastCall&&Date.now()-lastCall<ws.service.fees.followUpWithinDays*86400000);
    const fee={...ws.service.fees,due:Math.round(ws.service.fees.audioCall*(followUp?ws.service.fees.followUpFactor:1)),followUp};
    const requests=ws.records.filter(r=>r.patientId===p.id).slice(-10).reverse().map(r=>({id:r.id,createdAt:r.createdAt,status:r.status,text:r.report.input.messages.map(m=>m.text).join(' ').slice(0,1000),replies:familyReplies(r.report.evaluation.tier,r.report.processing?.extraction.status,r.report.evaluation.matched,r.report.input.fields)}));
    return json({closure:entry?.plan.closure??null,patient:{name:entry?.plan.demographics.name??p.name,age:entry?.plan.demographics.age??p.age,saathiId:p.saathiId,hospital:entry?.plan.hospital.name??null,hospitalId:entry?.plan.hospital.hospitalId??null},medications:entry?.plan.medications.filter(m=>!m.rescue)??[],appointments:entry?.plan.appointments??[],requests,fees:fee,slots:[...new Set((entry?.plan.medications.filter(m=>!m.rescue)??[]).flatMap(m=>m.slots))],events,prescriptions:rx.map(r=>({id:r.id,issuedAt:r.issuedAt,prescriber:r.prescriber,items:r.items.length,verified:verifyRx({...r,issuedAt:new Date(r.issuedAt).toISOString()},secret)}))});
  }catch(e){return fail(e);}
}
