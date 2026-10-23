import {loadEnvFile} from 'node:process';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {z} from 'zod';
import {fileURLToPath} from 'node:url';
import {TelegramAPI,TelegramError,TelegramState,TelegramWorker,taskRunner,patient} from '../packages/telegram/src/index.ts';
import {SupabaseStore} from '../packages/workflow/src/supabase-store.ts';
const root=new URL('../',import.meta.url);
try{loadEnvFile(new URL('apps/web/.env.local',root));}catch{console.error('Save apps/web/.env.local before configuring Telegram.');process.exit(1);}
const mode=process.argv[2]??'check';
const option=(key:string)=>{const i=process.argv.indexOf(key);return i>=0?process.argv[i+1]:undefined;};
try{
 const api=new TelegramAPI(process.env.TELEGRAM_BOT_TOKEN??'');
 const identity=await api.identity();const directory=resolve(fileURLToPath(new URL('apps/web/.saathi-demo/',root))),state=new TelegramState(directory,identity.id);
 if(mode==='check'){
  await api.checkPolling();const snapshot=await state.snapshot();console.log(JSON.stringify({bot:identity.username,credentials:'accepted',webhook:'not configured',linkedChats:Object.values(snapshot.chats).filter(c=>c.consentAt&&Date.now()-c.consentAt<24*60*60*1000).length,deliveryFailures:snapshot.deliveries.filter(d=>d.status!=='sent').length,pendingUpdate:Boolean(snapshot.pending),externalMessagesSent:0}));
 }else if(mode==='pair'){
  const patientId=patient.parse(option('--patient')),language=z.enum(['en-IN','hi-IN','kn-IN','unknown']).parse(option('--language')??'en-IN');
  const store=new SupabaseStore(process.env.NEXT_PUBLIC_SUPABASE_URL??'',process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'');
  if(!(await store.queue()).patients.some(p=>p.id===patientId))throw Error('Synthetic patient is not seeded.');
  const code=await state.pair(patientId,language);
  console.log(`Open this private, single-use link in Telegram within 15 minutes, then confirm synthetic-only consent:\nhttps://t.me/${identity.username}?start=${code}\nKeep this pairing link private. No message was sent by this command.`);
 }else if(mode==='run'){
  if(!process.argv.includes('--send'))throw Error('Run requires --send to enable synthetic replies. No updates were consumed.');
  if(process.env.SAATHI_STORAGE!=='supabase')throw Error('Telegram requires SAATHI_STORAGE=supabase.');
  await api.checkPolling();await mkdir(directory,{recursive:true,mode:0o700});const lock=join(directory,`telegram-${identity.id}.worker.lock`);
  try{await writeFile(lock,String(process.pid),{flag:'wx',mode:0o600});}catch{throw Error('A Telegram worker lock exists. Stop the other worker; inspect stale locks before removing them.');}
  const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
   const store=new SupabaseStore(process.env.NEXT_PUBLIC_SUPABASE_URL??'',process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'');
   await store.queue();
   console.log('Telegram synthetic-only local poller active. Replies enabled. Ctrl-C stops it; no webhook or public server is created.');
   await new TelegramWorker(state,api,taskRunner(store,api,{sarvam:process.env.SARVAM_API_KEY??'',groq:process.env.GROQ_API_KEY??''}),event=>console.log(JSON.stringify(event))).poll(controller.signal);
  }finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);await rm(lock,{force:true});}
 }else throw Error('Use check, pair --patient demo-ramesh --language hi-IN, or run --send.');
}catch(e){
 const safe=e instanceof TelegramError?e.message:e instanceof Error&&!(e instanceof z.ZodError)&&!e.message.includes('https:')&&!e.message.includes('token')?e.message:'Telegram setup failed validation. Response content was withheld.';
 console.error(safe);process.exitCode=1;
}
