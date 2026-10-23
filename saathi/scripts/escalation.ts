import {loadEnvFile} from 'node:process';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {DemoStore,SupabaseStore} from '../packages/workflow/src/index.ts';
import {runEscalations,escalationStatus} from '../packages/workflow/src/escalation.ts';
try{loadEnvFile(new URL('../apps/web/.env.local',import.meta.url));}catch{/* Offline demo can run without service credentials. */}
const directory=fileURLToPath(new URL('../apps/web/.saathi-demo/',import.meta.url));
try{
 const mode=process.argv[2]??'check',storage=process.env.SAATHI_STORAGE??'local';
 if(!['local','supabase'].includes(storage))throw Error('Invalid storage mode.');
 const store=storage==='supabase'?new SupabaseStore(process.env.NEXT_PUBLIC_SUPABASE_URL??'',process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||''):new DemoStore(directory);
 if(mode==='check'){
  const snapshot=await store.snapshot();console.log(JSON.stringify({storage,externalMessagesSent:0,reports:snapshot.records.filter(r=>r.status==='open'&&r.report.evaluation.tier==='RED').map(r=>({id:r.id,status:escalationStatus(r)}))},null,2));
 }else if(mode==='run'){
  await mkdir(directory,{recursive:true,mode:0o700});const lock=join(directory,'escalation.worker.lock');
  try{await writeFile(lock,String(process.pid),{flag:'wx',mode:0o600});}catch{throw Error('An escalation worker lock exists. Stop the other worker before inspecting a stale lock.');}
  const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
   console.log('Synthetic escalation checks active every 30 seconds. No external notifications. Ctrl-C stops checks.');
   await runEscalations(store,controller.signal,result=>{console.log(JSON.stringify({at:new Date().toISOString(),...result}));});
  }finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);await rm(lock,{force:true});}
 }else throw Error('Use check (read-only) or run (updates synthetic escalation state).');
}catch{console.error('Escalation worker failed. Check storage configuration and worker lock; credentials and provider responses were withheld.');process.exitCode=1;}
