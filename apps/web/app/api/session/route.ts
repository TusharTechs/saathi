import { z } from 'zod';
import { guard, body, store, json, fail } from '../../../lib/server';
import { readSession, sessionCookie, issueCode, checkCode, normalizeContact, checkStaffCode, publicDemo } from '../../../lib/session';
import { saathiId } from '../../../../../packages/workflow/src/index';
const schema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('staff'),role:z.enum(['medical','coordinator']),name:z.string().trim().min(1).max(60),code:z.string().max(80).optional()}).strict(),
  z.object({kind:z.literal('code'),contact:z.string().max(120)}).strict(),
  z.object({kind:z.literal('family'),contact:z.string().max(120),code:z.string().max(10),saathiId:z.string().max(20),agreed:z.literal(true)}).strict(),
]);
export const runtime='nodejs';
const withCookie=(data:unknown,cookie:string)=>{const r=json(data);r.headers.append('Set-Cookie',cookie);return r;};
const preflight=(request:Request)=>{try{guard(request,true);}catch(e){if(!(e instanceof Error)||!/Sign in|role/.test(e.message))throw e;}};
export async function GET(request:Request){try{return json({session:readSession(request),publicDemo:publicDemo()});}catch(e){return fail(e);}}
export async function POST(request:Request){
  try{
    preflight(request);const input=schema.parse(await body(request));
    if(input.kind==='staff'){checkStaffCode(input.code);return withCookie({role:input.role},sessionCookie({role:input.role,name:input.name}));}
    const contact=normalizeContact(input.contact);
    // No SMS or email is sent in the demo, so the code is returned for display on screen.
    if(input.kind==='code')return json({sent:false,demoCode:issueCode(contact)});
    checkCode(contact,input.code);
    const patient=(await store.queue()).patients.find(p=>saathiId(p.id)===input.saathiId.trim().toUpperCase());
    if(!patient)return json({error:'That Saathi ID was not found. It is on the leaflet from your OPD visit.'},400);
    return withCookie({role:'family',patientId:patient.id},sessionCookie({role:'family',name:contact,patientId:patient.id,agreedAt:new Date().toISOString()}));
  }catch(e){return fail(e);}
}
export async function DELETE(){return withCookie({signedOut:true},sessionCookie(null));}
