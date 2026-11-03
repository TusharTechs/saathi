import { randomUUID } from 'node:crypto';
import { guard, body, store, json, fail } from '../../../lib/server';
import { workspace } from '../../../lib/workspace';
import { rxInput, restrictedItems, restrictedList, signRx, verifyRx, type Prescription } from '../../../../../packages/workflow/src/prescription';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const secret=()=>process.env.SAATHI_SESSION_SECRET||process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
/**
 * Teleconsult prescriptions (Telemedicine Practice Guidelines 2020). Only medical staff write them; the app blocks
 * narcotic, psychotropic, Schedule X and anti-cancer drugs and never suggests a medicine.
 */
export async function POST(request:Request){
  try{
    const session=guard(request,true,'json',['medical']),input=rxInput.parse(await body(request));
    const blocked=restrictedItems(input.items);
    if(blocked.length)return json({error:`${blocked.map(b=>`${b.medicine} (${b.category})`).join(', ')} cannot be prescribed by teleconsultation. ${restrictedList.refillAdvice}`,blocked},422);
    const draft:Omit<Prescription,'signature'>={id:randomUUID(),alertId:input.alertId,patientId:input.patientId,prescriber:session.name,registration:input.registration,items:input.items,advice:input.advice||null,issuedAt:new Date().toISOString()};
    const rx:Prescription={...draft,signature:signRx(draft,secret())};
    await store.prescribe(rx);return json(rx,201);
  }catch(e){return fail(e);}
}
export async function GET(request:Request){
  try{
    const session=guard(request,false,'json',['medical','family']),url=new URL(request.url);
    const patientId=session.role==='family'?session.patientId!:url.searchParams.get('patient');
    const all=await store.prescriptions(patientId??null),id=url.searchParams.get('id');
    const list=(id?all.filter(r=>r.id===id):all).map(r=>({...r,advice:r.advice,verified:verifyRx({...r,advice:r.advice??null,issuedAt:new Date(r.issuedAt).toISOString()},secret())}));
    if(id&&list[0]){const ws=await workspace(),p=ws.patients.find(p=>p.id===list[0]!.patientId),plan=ws.carePlans[list[0]!.patientId]?.plan;
      return json([{...list[0],patient:{name:plan?.demographics.name??p?.name,age:plan?.demographics.age??p?.age,sex:plan?.demographics.sex??null,hospitalId:plan?.hospital.hospitalId??null,hospital:plan?.hospital.name??null,saathiId:p?.saathiId,abha:p?.abha}}]);}
    return json(list);
  }catch(e){return fail(e);}
}
