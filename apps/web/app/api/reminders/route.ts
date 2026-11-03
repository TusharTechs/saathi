import { resolve } from 'node:path';
import { z } from 'zod';
import { guard, body, json, fail } from '../../../lib/server';
import { ReminderState } from '../../../../../packages/whatsapp/src/reminders';
import { SLOTS } from '../../../../../packages/workflow/src/care-plan';
const schema=z.object({patientId:z.string().min(1).max(40),slot:z.enum(SLOTS)}).strict();
export const runtime='nodejs';
/** Demo trigger: asks the local WhatsApp worker to send one slot's medicine reminder on its next check (within 30 s). */
export async function POST(request:Request){
  try{guard(request,true);const input=schema.parse(await body(request)),phone=process.env.WA_PHONE_NUMBER_ID??'';
    if(!/^\d{1,40}$/.test(phone))return json({error:'WhatsApp is not configured on this computer.'},503);
    await new ReminderState(resolve(process.cwd(),'.saathi-demo',`whatsapp-${phone}`)).requestDemo(input.patientId,input.slot);
    return json({queued:true});}catch(e){return fail(e);}
}
