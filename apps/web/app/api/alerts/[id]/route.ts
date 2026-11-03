import { z } from 'zod';
import { guard, body, store, json, fail } from '../../../../lib/server';
const schema=z.discriminatedUnion('action',[
  z.object({action:z.enum(['acknowledge','resolve']),expectedRevision:z.number().int().positive()}).strict(),
  z.object({action:z.literal('close'),expectedRevision:z.number().int().positive(),notes:z.string().max(4000),advice:z.string().max(2000).default('')}).strict(),
  z.object({action:z.literal('fee'),status:z.enum(['due','paid','waived'])}).strict(),
]);
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{const session=guard(request,true,'json',['medical','coordinator']);const {id}=await context.params;const input=schema.parse(await body(request));
    // The call manager may only update fee status; clinical actions stay with medical staff.
    if(session.role==='coordinator'&&input.action!=='fee')return json({error:'Only medical staff can acknowledge or close calls.'},403);
    if(input.action==='close')return json(await store.close(id,input.expectedRevision,input.notes,input.advice));
    if(input.action==='fee'){await store.setFee(id,input.status);return json({id,status:input.status});}
    return json(await store.transition(id,input.action,input.expectedRevision));}catch(e){return fail(e);}
}
