import { z } from 'zod';
import { guard, body, store, json, fail } from '../../../../lib/server';
const schema=z.object({action:z.enum(['acknowledge','resolve']),expectedRevision:z.number().int().positive()}).strict();
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{guard(request,true);const {id}=await context.params;const input=schema.parse(await body(request));return json(await store.transition(id,input.action,input.expectedRevision));}catch(e){return fail(e);}
}
