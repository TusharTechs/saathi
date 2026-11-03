import { timingSafeEqual, createHash } from 'node:crypto';
import { json } from '../../../lib/server';
import { runPass } from '../../../../../packages/whatsapp/src/cloud';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
/**
 * The WhatsApp worker as a serverless function. Called by the Supabase receiver when a message arrives and by
 * pg_cron every minute (reminders, on-call alerts, escalations). Requires the shared worker secret.
 */
const allowed=(request:Request)=>{
  const given=createHash('sha256').update((request.headers.get('authorization')??'').replace(/^Bearer\s+/i,'')).digest();
  return [process.env.SAATHI_WORKER_SECRET,process.env.CRON_SECRET].some(s=>s&&s.length>=32&&timingSafeEqual(given,createHash('sha256').update(s).digest()));
};
async function handle(request:Request){
  if(!allowed(request))return json({error:'Not allowed'},401);
  try{return json(await runPass(process.env,40000));}
  catch{return json({error:'Worker pass failed; it is retried on the next call.'},500);}
}
export const POST=handle;
export const GET=handle;
