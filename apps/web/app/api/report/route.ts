import { guard, json, fail } from '../../../lib/server';
import { workspace } from '../../../lib/workspace';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ist=(at:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
/** Non-medical view: counts, status and administrative fields only. No symptoms, quotes, rules or call notes. */
export async function GET(request:Request){
  try{
    guard(request,false,'json',['medical','coordinator']);const ws=await workspace();
    const rows=ws.records.map(r=>{const p=ws.patients.find(p=>p.id===r.patientId),plan=ws.carePlans[r.patientId]?.plan,ack=r.events.find(e=>e.type==='acknowledged'),closed=[...r.events].reverse().find(e=>e.type==='resolved');
      return {id:r.id,date:ist(r.createdAt),createdAt:r.createdAt,patient:plan?.demographics.name??p?.name??r.patientId,hospitalId:plan?.hospital.hospitalId??null,saathiId:p?.saathiId??null,urgency:r.report.evaluation.tier??'REVIEW',status:r.status,acknowledgedBy:ack?.actor??null,acknowledgedAt:ack?.at??null,closedAt:closed?.at??null,done:r.status==='resolved'?'Call completed':r.status==='acked'?'In call-back list':'Waiting for acknowledgement',fee:ws.fees[r.id]??'due',channel:r.report.origin?.channel??'web'};});
    return json({rows,fees:ws.service.fees});
  }catch(e){return fail(e);}
}
