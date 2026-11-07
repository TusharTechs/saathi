import { resolve } from 'node:path';
import { z } from 'zod';
import { guard, body, json, fail } from '../../../lib/server';
import { workerStates } from '../../../../../packages/whatsapp/src/cloud';
import { SLOTS, type CarePlanEntry } from '../../../../../packages/workflow/src/care-plan';
import { dueReminders } from '../../../../../packages/whatsapp/src/reminders';
import { store } from '../../../lib/server';
const schema=z.object({patientId:z.string().min(1).max(40),slot:z.enum(SLOTS)}).strict();
export const runtime='nodejs';
/** Demo trigger: asks the WhatsApp worker to send one slot's medicine reminder on its next pass (within a minute). */
export async function POST(request:Request){
  try{guard(request,true);const input=schema.parse(await body(request)),phone=process.env.WA_PHONE_NUMBER_ID??'';
    // The exact text the family would receive, from the same function the worker uses.
    const plans:Record<string,CarePlanEntry>=await store.carePlans(),entry=plans[input.patientId];
    const preview=entry?dueReminders(entry,input.patientId,'0',Date.now(),new Set([`welcome:${input.patientId}:${entry.checkedInAt}`]),[input.slot]).find(d=>d.key.startsWith('demo:'))?.text??null:null;
    if(!preview)return json({queued:false,preview:null,error:`No regular medicine is scheduled for the ${input.slot}.`},400);
    if(!/^\d{1,40}$/.test(phone))return json({queued:false,preview});
    await workerStates(phone,resolve(process.cwd(),'.saathi-demo',`whatsapp-${phone}`),process.env).reminders.requestDemo(input.patientId,input.slot);
    return json({queued:true,preview});}catch(e){return fail(e);}
}
