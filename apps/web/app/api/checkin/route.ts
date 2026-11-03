import { z } from 'zod';
import { guard, body, store, json, fail } from '../../../lib/server';
import { carePlanSchema } from '../../../../../packages/workflow/src/index';
const schema=z.object({patientId:z.string().min(1).max(40),plan:carePlanSchema}).strict();
export const runtime='nodejs';
/** "Check in to Saathi" from the demo hospital record: stores the synthetic care plan for one patient. */
export async function POST(request:Request){try{guard(request,true);const input=schema.parse(await body(request));if(!input.plan.consent.consented)return json({error:'Record the family’s consent before checking in to Saathi.'},400);return json(await store.checkin(input.patientId,input.plan));}catch(e){return fail(e);}}
