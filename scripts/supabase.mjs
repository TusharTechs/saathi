import { loadEnvFile } from 'node:process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url);
try{loadEnvFile(new URL('apps/web/env.local',root));}catch{throw new Error('Save apps/web/env.local before running this command.');}
const mode=process.argv[2]??'plan';
const schema=await readFile(new URL('supabase/migrations/202610230001_core.sql',root),'utf8');
const seed=await readFile(new URL('supabase/seed/demo.sql',root),'utf8');
const hardening=(await readFile(new URL('supabase/migrations/202610230002_function_permissions.sql',root),'utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const storage=(await readFile(new URL('supabase/migrations/202610230003_demo_storage.sql',root),'utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const conflicts=(await readFile(new URL('supabase/migrations/202610230004_conflict_responses.sql',root),'utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const analysis=(await readFile(new URL('supabase/migrations/202610230005_narrative_analysis.sql',root),'utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const telegram=(await readFile(new URL('supabase/migrations/202610230006_telegram_origin.sql',root),'utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const whatsapp=(await readFile(new URL('supabase/migrations/202610230007_whatsapp_intake.sql',root),'utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const oncall=(await readFile(new URL('supabase/migrations/202611030008_whatsapp_oncall.sql',root),'utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const teleconsult=(await readFile(new URL('supabase/migrations/202611030009_teleconsult.sql',root),'utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const accounts=(await readFile(new URL('supabase/migrations/202611040010_accounts_and_cloud_worker.sql',root),'utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const loginPhone=(await readFile(new URL('supabase/migrations/202611040011_login_expected_phone.sql',root),'utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const query=schema.replace(/commit;\s*$/i,()=>`${hardening}\n${seed}\n${storage}\n${conflicts}\n${analysis}\n${telegram}\n${whatsapp}\n${oncall}\n${teleconsult}\n${accounts}\n${loginPhone}\ncommit;`);
const hash=createHash('sha256').update(query).digest('hex').slice(0,12);
const tables=['care_team_members','patients','patient_care_team','protocol_versions','messages','checkins','alerts','alert_events'];
function project(){
 const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??'');
 if(url.protocol!=='https:'||!/^([a-z0-9]+)\.supabase\.co$/.test(url.hostname)||url.username||url.password||url.port||url.search||url.hash)throw new Error('Expected an HTTPS Supabase project URL.');
 return {url,ref:url.hostname.split('.')[0]};
}
async function call(url,options={}){
 let r;
 try{r=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw new Error('Supabase connection failed or timed out. No automatic write retry was attempted.');}
 return r;
}
async function management(ref,path,body){
 const token=process.env.SUPABASE_ACCESS_TOKEN;
 if(!token)throw new Error('SUPABASE_ACCESS_TOKEN is missing. A project API key cannot run SQL migrations.');
 const r=await call(`https://api.supabase.com/v1/projects/${ref}/database/${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw new Error(`Supabase management request failed (HTTP ${r.status}). Response content was withheld to protect secrets.`);
 return r.json();
}
try{
 if(mode==='plan'){
  console.log(JSON.stringify({mode,changes:'Create synthetic schema, RLS, service-only workflow and intake RPCs; seed five patients and three unlinked team members',tables,migrationName:`saathi_core_${hash}`,checksum:hash,externalWrites:false},null,2));
 }else if(mode==='check'){
  const {url}=project();
  const keys={public:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,server:process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY};
  for(const [kind,key] of Object.entries(keys)){
   if(!key){console.log(`${kind} key: missing`);process.exitCode=1;continue;}
   const r=await call(new URL('/auth/v1/settings',url),{headers:{apikey:key}});
   console.log(`${kind} key: ${r.ok?'accepted':'rejected'} (HTTP ${r.status})`);
   if(!r.ok)process.exitCode=1;
  }
  const r=await call(new URL('/rest/v1/patients?select=id&limit=0',url),{headers:{apikey:keys.public??''}});
  console.log(`Patient schema endpoint: HTTP ${r.status}. No patient rows were requested.`);
 }else if(mode==='storage'){
  const {ref}=project();
  const state=await management(ref,'query',{query:"select to_regprocedure('public.saathi_demo_queue()') is not null as ready",read_only:true});
  if(!Array.isArray(state))throw new Error('Unexpected migration inspection response. Nothing was applied.');
  if(state[0]?.ready){console.log('Supabase demo storage migration is already present. No migration was repeated.');}
  else{
   const storageQuery=await readFile(new URL('supabase/migrations/202610230003_demo_storage.sql',root),'utf8');
   await management(ref,'migrations',{name:'saathi_202610230003_demo_storage',query:storageQuery});
   console.log('Supabase service-only demo storage migration applied.');
  }
  const conflictState=await management(ref,'query',{query:"select position('PT409' in pg_get_functiondef('public.saathi_demo_transition(uuid,text,integer)'::regprocedure))>0 as ready",read_only:true});
  if(!Array.isArray(conflictState))throw new Error('Unexpected conflict migration inspection response.');
  if(!conflictState[0]?.ready){
   const conflictQuery=await readFile(new URL('supabase/migrations/202610230004_conflict_responses.sql',root),'utf8');
   await management(ref,'migrations',{name:'saathi_202610230004_conflict_responses',query:conflictQuery});
   console.log('Explicit conflict response migration applied.');
  }
 }else if(mode==='analysis'){
  const {ref}=project();
  const state=await management(ref,'query',{query:"select to_regprocedure('public.saathi_demo_claim_analysis(uuid)') is not null as ready",read_only:true});
  if(!Array.isArray(state))throw new Error('Unexpected analysis migration inspection response.');
  if(state[0]?.ready)console.log('Narrative analysis migration is already present. No migration was repeated.');
  else{
   const query=await readFile(new URL('supabase/migrations/202610230005_narrative_analysis.sql',root),'utf8');
   await management(ref,'migrations',{name:'saathi_202610230005_narrative_analysis',query});
   console.log('Service-only narrative analysis migration applied.');
  }
 }else if(mode==='telegram'){
  const {ref}=project();
  const state=await management(ref,'query',{query:"select to_regprocedure('public.saathi_telegram_submit(uuid,text,text,jsonb,jsonb)') is not null as ready",read_only:true});
  if(!Array.isArray(state))throw new Error('Unexpected Telegram migration inspection response.');
  if(state[0]?.ready)console.log('Telegram provenance migration is already present. No migration was repeated.');
  else{
   const query=await readFile(new URL('supabase/migrations/202610230006_telegram_origin.sql',root),'utf8');
   await management(ref,'migrations',{name:'saathi_202610230006_telegram_origin',query});
   console.log('Service-only Telegram provenance migration applied.');
  }
 }else if(mode==='whatsapp'){
  const {ref}=project();
  const state=await management(ref,'query',{query:"select to_regprocedure('public.saathi_wa_enqueue(text,jsonb)') is not null as ready",read_only:true});
  if(!Array.isArray(state))throw new Error('Unexpected WhatsApp migration inspection response.');
  if(state[0]?.ready)console.log('WhatsApp intake migration is already present. No migration was repeated.');
  else{
   const query=await readFile(new URL('supabase/migrations/202610230007_whatsapp_intake.sql',root),'utf8');
   await management(ref,'migrations',{name:'saathi_202610230007_whatsapp_intake',query});
   console.log('Service-only WhatsApp intake migration applied.');
  }
 }else if(mode==='oncall'){
  const {ref}=project();
  const state=await management(ref,'query',{query:"select to_regprocedure('public.saathi_wa_enqueue(text,jsonb)') is not null as present, coalesce(pg_get_functiondef(to_regprocedure('public.saathi_wa_enqueue(text,jsonb)')) like '%oncall%',false) as ready",read_only:true});
  if(!Array.isArray(state))throw new Error('Unexpected on-call migration inspection response.');
  if(!state[0]?.present)throw new Error('Apply the WhatsApp intake migration first (pnpm supabase:whatsapp).');
  if(state[0]?.ready)console.log('WhatsApp on-call migration is already present. No migration was repeated.');
  else{
   const query=await readFile(new URL('supabase/migrations/202611030008_whatsapp_oncall.sql',root),'utf8');
   await management(ref,'migrations',{name:'saathi_202611030008_whatsapp_oncall',query});
   console.log('WhatsApp on-call inbox filter applied.');
  }
 }else if(mode==='teleconsult'){
  const {ref}=project();
  const state=await management(ref,'query',{query:"select to_regprocedure('public.saathi_demo_close(uuid,integer,text,text)') is not null as ready",read_only:true});
  if(!Array.isArray(state))throw new Error('Unexpected teleconsult migration inspection response.');
  if(state[0]?.ready)console.log('Teleconsult migration is already present. No migration was repeated.');
  else{
   const query=await readFile(new URL('supabase/migrations/202611030009_teleconsult.sql',root),'utf8');
   await management(ref,'migrations',{name:'saathi_202611030009_teleconsult',query});
   console.log('Teleconsult migration applied: call notes, care plans, dose logs and fees.');
  }
 }else if(mode==='schedule'){
  // Calls the serverless WhatsApp worker every 2 minutes (reminders, on-call alerts, escalations). The secret stays in Vault.
  const {ref}=project(),app=process.env.SAATHI_APP_URL??'',secret=process.env.SAATHI_WORKER_SECRET??'';
  if(!/^https:\/\/[a-z0-9.-]+$/.test(app)||!/^[0-9a-f]{64}$/.test(secret))throw new Error('Set SAATHI_APP_URL (https origin) and SAATHI_WORKER_SECRET in env.local first.');
  const query=`create extension if not exists pg_cron;create extension if not exists pg_net;
do $s$ begin
 if exists(select 1 from vault.secrets where name='saathi_worker_secret') then perform vault.update_secret((select id from vault.secrets where name='saathi_worker_secret'),'${secret}');
 else perform vault.create_secret('${secret}','saathi_worker_secret');end if;
 if exists(select 1 from cron.job where jobname='saathi-worker') then perform cron.unschedule('saathi-worker');end if;
end $s$;
select cron.schedule('saathi-worker','*/2 * * * *',$job$select net.http_post(url:='${app}/api/worker',headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='saathi_worker_secret')),body:='{}'::jsonb,timeout_milliseconds:=55000)$job$);`;
  await management(ref,'query',{query});
  console.log(JSON.stringify(await management(ref,'query',{query:"select jobname,schedule,active from cron.job where jobname='saathi-worker'",read_only:true})));
 }else if(mode==='login-phone'){
  const {ref}=project();
  const state=await management(ref,'query',{query:"select to_regprocedure('public.saathi_login_challenge(text,integer,text)') is not null as ready",read_only:true});
  if(!Array.isArray(state))throw new Error('Unexpected inspection response.');
  if(state[0]?.ready)console.log('Mobile-first sign-in migration is already present.');
  else{await management(ref,'migrations',{name:'saathi_202611040011_login_expected_phone',query:await readFile(new URL('supabase/migrations/202611040011_login_expected_phone.sql',root),'utf8')});console.log('Mobile-first sign-in migration applied.');}
 }else if(mode==='accounts'){
  const {ref}=project();
  const state=await management(ref,'query',{query:"select to_regprocedure('public.saathi_demo_close_as(uuid,integer,text,text,text)') is not null as ready",read_only:true});
  if(!Array.isArray(state))throw new Error('Unexpected accounts migration inspection response.');
  if(state[0]?.ready)console.log('Accounts and cloud worker migration is already present. No migration was repeated.');
  else{
   const query=await readFile(new URL('supabase/migrations/202611040010_accounts_and_cloud_worker.sql',root),'utf8');
   await management(ref,'migrations',{name:'saathi_202611040010_accounts_and_cloud_worker',query});
   console.log('Accounts, WhatsApp login, cloud worker state and named call-log actors applied.');
  }
 }else if(mode==='apply'){
  const {ref}=project();
  const result=await management(ref,'query',{query:`select tablename from pg_catalog.pg_tables where schemaname='public' and tablename in (${tables.map(t=>`'${t}'`).join(',')})`,read_only:true});
  if(!Array.isArray(result))throw new Error('Unexpected schema inspection response. Nothing was applied.');
  if(result.length)throw new Error('Some Saathi tables already exist. Refusing to overwrite or rerun; inspect migration history first.');
  await management(ref,'migrations',{name:`saathi_core_${hash}`,query});
  const verified=await management(ref,'query',{query:"select count(*)::int as patients from public.patients where synthetic=true",read_only:true});
  const count=Array.isArray(verified)?verified[0]?.patients:undefined;
  if(count!==5)throw new Error('Migration request completed but seed verification failed. Inspect the project before retrying.');
  console.log('Core migration and synthetic seed applied. Verified five synthetic patients. App storage is not switched automatically.');
 }else throw new Error('Use plan, check, storage, analysis, telegram, whatsapp, oncall, teleconsult or apply.');
}catch(error){console.error(error instanceof Error?error.message:'Supabase operation failed; credentials withheld.');process.exitCode=1;}
