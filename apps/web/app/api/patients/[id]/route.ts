import { z } from 'zod';
import { guard, body, store, json, fail } from '../../../../lib/server';
import { WorkflowError, type CarePlanEntry } from '../../../../../../packages/workflow/src/index';
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('close'),reason:z.enum(['died','transferred','other']),note:z.string().max(300).default('')}).strict(),
  z.object({action:z.literal('reopen')}).strict(),
]);
export const runtime='nodejs';
/** Close Saathi follow-up when a patient dies or moves to another primary team (Dr. Rao, 7 Nov), or reopen it. */
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{
    const session=guard(request,true,'json',['medical']),{id}=await context.params,input=schema.parse(await body(request));
    const plans:Record<string,CarePlanEntry>=await store.carePlans(),entry=plans[id];
    if(!entry)throw new WorkflowError(400,'This patient has not been checked in to Saathi from the hospital record.');
    const {closure:_,...rest}=entry.plan;void _;
    const plan=input.action==='close'?{...rest,closure:{reason:input.reason,note:input.note,closedAt:new Date().toISOString(),closedBy:session.name}}:rest;
    return json(await store.checkin(id,plan));
  }catch(e){return fail(e);}
}
