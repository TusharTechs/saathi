import {loadEnvFile} from 'node:process';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {z} from 'zod';
import {TelegramState,patient} from '../packages/telegram/src/state.ts';
import {WhatsAppAPI,WhatsAppBusiness,discover,WhatsAppError,WhatsAppStore,WhatsAppWorker,readiness,runWhatsAppTask,channelNumber} from '../packages/whatsapp/src/index.ts';
const root=new URL('../',import.meta.url);const mode=process.argv[2]??'check';
const option=(name:string)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
try{
 loadEnvFile(new URL('apps/web/.env.local',root));
 const required=['WA_APP_ID','WA_APP_SECRET','WA_BUSINESS_ACCOUNT_ID','WA_PHONE_NUMBER_ID','WA_ACCESS_TOKEN','WA_VERIFY_TOKEN'];
 const business=()=>new WhatsAppBusiness({appId:process.env.WA_APP_ID??'',appSecret:process.env.WA_APP_SECRET??'',wabaId:process.env.WA_BUSINESS_ACCOUNT_ID??'',phoneId:process.env.WA_PHONE_NUMBER_ID??''},process.env.WA_ACCESS_TOKEN??'',process.env.WA_GRAPH_VERSION??'v26.0');
 if(mode==='check'){
  const missing=required.filter(k=>!process.env[k]);
  if(missing.length){const found=process.env.WA_ACCESS_TOKEN&&(missing.includes('WA_APP_ID')||missing.includes('WA_BUSINESS_ACCOUNT_ID'))?await discover(process.env.WA_ACCESS_TOKEN,process.env.WA_GRAPH_VERSION??'v26.0'):undefined;
   console.log(JSON.stringify({ready:false,missing,...(found?{tokenIssuedFor:{WA_APP_ID:found.appId??null,WA_BUSINESS_ACCOUNT_ID:found.wabaIds,tokenValid:found.isValid}}:{}),externalMessagesSent:0}));process.exitCode=1;}
  else{const b=business(),result=readiness({appId:process.env.WA_APP_ID!,appSecret:'',wabaId:process.env.WA_BUSINESS_ACCOUNT_ID!,phoneId:process.env.WA_PHONE_NUMBER_ID!},await b.inspect());
   for(const c of result.checks)console.log(`${c.level==='ok'?'ok   ':c.level==='warn'?'warn ':'BLOCK'} ${c.id.padEnd(18)} ${c.detail}`);
   console.log(JSON.stringify({ready:result.ready,appSecret:'configured; live signature not verified',externalMessagesSent:0}));if(!result.ready)process.exitCode=1;}
 }else if(mode==='subscribe'||mode==='register'){
  if(!process.argv.includes('--confirm'))throw new WhatsAppError('configuration',`${mode} changes the WhatsApp Business Account. Review pnpm whatsapp:check, then re-run with --confirm. No changes made.`);
  const result=mode==='subscribe'?await business().subscribe():await business().register(process.env.WA_TWO_STEP_PIN??'');
  console.log(JSON.stringify({operation:mode,changed:result.changed,externalMessagesSent:0}));
 }else{
  const api=new WhatsAppAPI(process.env.WA_PHONE_NUMBER_ID??'',process.env.WA_ACCESS_TOKEN??'',process.env.WA_GRAPH_VERSION??'v26.0');
  const directory=join(fileURLToPath(new URL('apps/web/.saathi-demo/',root)),`whatsapp-${api.phoneId}`),id=channelNumber(api.phoneId),state=new TelegramState(directory,id,'whatsapp');
  const store=new WhatsAppStore(process.env.NEXT_PUBLIC_SUPABASE_URL??'',process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'');
  if(mode==='pair'){
   const patientId=patient.parse(option('--patient')),language=z.enum(['en-IN','hi-IN','kn-IN','unknown']).parse(option('--language')??'en-IN');
   if(!(await store.queue()).patients.some(p=>p.id===patientId))throw Error('Unknown seeded patient');
   const phone=(await api.check()).display_phone_number.replace(/\D/g,'');if(!/^[1-9]\d{7,14}$/.test(phone))throw Error('Meta did not return a usable display phone number');
   const code=await state.pair(patientId,language);console.log(`Private 15-minute pairing link:\nhttps://wa.me/${phone}?text=${encodeURIComponent('/start '+code)}\nOpen it and send the prefilled command, then confirm synthetic-only consent. No message was sent by this command.`);
  }else if(mode==='run'){
   if(!process.argv.includes('--send'))throw Error('Run requires --send. No inbox messages were processed.');if(process.env.SAATHI_STORAGE!=='supabase')throw Error('WhatsApp requires Supabase storage');
   await api.check();await store.queue();await mkdir(directory,{recursive:true,mode:0o700});const lock=join(directory,`whatsapp-${id}.worker.lock`);
   try{await writeFile(lock,String(process.pid),{flag:'wx',mode:0o600});}catch{throw Error('A WhatsApp worker lock exists. Stop the other worker before inspecting a stale lock.');}
   const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
   try{console.log('WhatsApp synthetic inbox worker active; replies enabled only within the incoming 24-hour window.');await new WhatsAppWorker(state,store,api,runWhatsAppTask(store,api,{sarvam:process.env.SARVAM_API_KEY??'',groq:process.env.GROQ_API_KEY??''}),e=>console.log(JSON.stringify(e))).poll(controller.signal);}
   finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);await rm(lock,{force:true});}
  }else throw Error('Use check, subscribe --confirm, register --confirm, pair --patient demo-ramesh --language hi-IN, or run --send.');
 }
}catch(e){console.error(e instanceof WhatsAppError?e.message:'WhatsApp setup, worker state or storage could not be confirmed. Check configuration; existing state was preserved.');process.exitCode=1;}
