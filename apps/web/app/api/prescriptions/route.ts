import { randomUUID } from 'node:crypto';
import { guard, body, store, json, fail } from '../../../lib/server';
import { workspace } from '../../../lib/workspace';
import { rxInput, blockedItems, signRx, verifyRx, type Prescription } from '../../../../../packages/workflow/src/prescription';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const secret=()=>process.env.SAATHI_SESSION_SECRET||process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
/**
 * Prescription changes after a teleconsult (Dr. Rao, review E1): the doctor guides the change on the call and saves it here;
 * nothing is printed or sent to the family. It is issued in person at the OPD within 2-3 working days. Only doctors save
 * changes (nurses and psychologists cannot); anti-cancer drugs are refused; the app never suggests a medicine.
 */
export async function POST(request:Request){
  try{
    const session=guard(request,true,'json',['medical']),input=rxInput.parse(await body(request));
    if(session.staff&&session.staff!=='doctor')return json({error:'Only doctors can change a prescription. Nurses and psychologists can send reminders and add notes.'},403);
    const blocked=blockedItems(input.items);
    if(blocked.length)return json({error:`${blocked.map(b=>b.medicine).join(', ')}: the palliative care team does not prescribe anti-cancer drugs.`,blocked},422);
    const draft:Omit<Prescription,'signature'>={id:randomUUID(),alertId:input.alertId,patientId:input.patientId,prescriber:session.name,registration:input.registration,items:input.items,advice:input.advice||null,issuedAt:new Date().toISOString()};
    const rx:Prescription={...draft,signature:signRx(draft,secret())};
    await store.prescribe(rx);return json(rx,201);
  }catch(e){return fail(e);}
}
export async function GET(request:Request){
  try{
    // Printable prescriptions are for staff issuing them at the OPD; families only see a 'collect at OPD' notice.
    const session=guard(request,false,'json',['medical']),url=new URL(request.url);void session;
    const patientId=url.searchParams.get('patient');
    const all=await store.prescriptions(patientId??null),id=url.searchParams.get('id');
    const list=(id?all.filter(r=>r.id===id):all).map(r=>({...r,advice:r.advice,verified:verifyRx({...r,advice:r.advice??null,issuedAt:new Date(r.issuedAt).toISOString()},secret())}));
    if(id&&list[0]){const ws=await workspace(),p=ws.patients.find(p=>p.id===list[0]!.patientId),plan=ws.carePlans[list[0]!.patientId]?.plan;
      return json([{...list[0],patient:{name:plan?.demographics.name??p?.name,age:plan?.demographics.age??p?.age,sex:plan?.demographics.sex??null,hospitalId:plan?.hospital.hospitalId??null,hospital:plan?.hospital.name??null,saathiId:p?.saathiId,abha:p?.abha}}]);}
    return json(list);
  }catch(e){return fail(e);}
}
