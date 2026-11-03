import { resolve } from 'node:path';
import { z } from 'zod';
import { guard, body, json, fail } from '../../../lib/server';
import { workerStates } from '../../../../../packages/whatsapp/src/cloud';
import { SLOTS } from '../../../../../packages/workflow/src/care-plan';
const schema=z.object({patientId:z.string().min(1).max(40),slot:z.enum(SLOTS)}).strict();
export const runtime='nodejs';
/** Demo trigger: asks the WhatsApp worker to send one slot's medicine reminder on its next pass (within a minute). */
export async function POST(request:Request){
  try{guard(request,true);const input=schema.parse(await body(request)),phone=process.env.WA_PHONE_NUMBER_ID??'';
    if(!/^\d{1,40}$/.test(phone))return json({error:'WhatsApp is not configured.'},503);
    await workerStates(phone,resolve(process.cwd(),'.saathi-demo',`whatsapp-${phone}`),process.env).reminders.requestDemo(input.patientId,input.slot);
    return json({queued:true});}catch(e){return fail(e);}
}
