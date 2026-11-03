import {loadEnvFile} from 'node:process';
import {readFile,writeFile,rename,rm} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
const root=new URL('../',import.meta.url),envFile=new URL('apps/web/env.local',root),mode=process.argv[2]??'plan';
try{
 loadEnvFile(envFile);
 const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??'');if(url.protocol!=='https:'||!/^([a-z0-9]+)\.supabase\.co$/.test(url.hostname))throw Error('Invalid project URL');
 const ref=url.hostname.split('.')[0],callback=`${url.origin}/functions/v1/whatsapp-webhook`,slug='whatsapp-webhook';
 const files=await Promise.all(['index.ts','handler.ts'].map(async name=>({name,source:await readFile(new URL('supabase/functions/whatsapp-webhook/'+name,root),'utf8')})));
 const checksum=createHash('sha256').update(files.map(f=>f.source).join('\n')).digest('hex');
 const call=async(path,options={})=>{const token=process.env.SUPABASE_ACCESS_TOKEN;if(!token)throw Error('Management token missing');let r;try{r=await fetch(`https://api.supabase.com/v1/projects/${ref}/${path}`,{...options,headers:{Authorization:`Bearer ${token}`,...options.headers},redirect:'error',signal:AbortSignal.timeout(45000)});}catch{throw Error('Supabase operation not confirmed; no automatic retry was made.');}if(!r.ok)throw Error(`Supabase operation failed (HTTP ${r.status}); response withheld. Edge Functions and Secrets permissions may be needed.`);return r;};
 if(mode==='plan')console.log(JSON.stringify({callback,deployedByThisCommand:false,files:files.map(f=>f.name),checksum,authentication:'Meta HMAC-SHA256; verification token for GET only',publicDashboard:false,requiredSecrets:['WA_PHONE_NUMBER_ID','WA_APP_SECRET','WA_VERIFY_TOKEN'],missing:['WA_PHONE_NUMBER_ID','WA_ACCESS_TOKEN','WA_APP_SECRET','WA_VERIFY_TOKEN'].filter(k=>!process.env[k])},null,2));
 else if(mode==='prepare'){
  if(process.env.WA_VERIFY_TOKEN){console.log('WA_VERIFY_TOKEN already exists; it was preserved.');}
  else{const source=await readFile(envFile,'utf8'),secret=randomBytes(32).toString('hex'),line=`WA_VERIFY_TOKEN=${secret}`,next=/^WA_VERIFY_TOKEN=.*$/m.test(source)?source.replace(/^WA_VERIFY_TOKEN=.*$/m,()=>line):source+'\n'+line+'\n',temporary=new URL('apps/web/env.local.tmp',root);
   try{await writeFile(temporary,next,{mode:0o600,flag:'wx'});await rename(temporary,envFile);}finally{await rm(temporary,{force:true});}console.log('Generated WA_VERIFY_TOKEN in apps/web/env.local. Value withheld.');}
 }else if(mode==='deploy'){
  if(!process.argv.includes('--publish'))throw Error('Deployment requires --publish after reviewing whatsapp:plan. No changes made.');
  for(const name of ['WA_PHONE_NUMBER_ID','WA_APP_SECRET','WA_VERIFY_TOKEN'])if(!process.env[name])throw Error(`Missing ${name}; no deployment attempted.`);
  if(!/^\d{1,40}$/.test(process.env.WA_PHONE_NUMBER_ID)||process.env.WA_APP_SECRET.length<32||process.env.WA_VERIFY_TOKEN.length<32)throw Error('Phone ID or webhook secrets failed configuration validation; no deployment attempted.');
  const existing=await(await call('functions')).json();if(!Array.isArray(existing))throw Error('Unexpected function listing');
  if(existing.some(f=>f.slug===slug)&&!process.argv.includes('--replace'))throw Error('Function already exists; inspect it before explicitly using --replace.');
  await call('secrets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(['WA_PHONE_NUMBER_ID','WA_APP_SECRET','WA_VERIFY_TOKEN','SAATHI_APP_URL','SAATHI_WORKER_SECRET'].filter(name=>process.env[name]).map(name=>({name,value:process.env[name]})))});
  const form=new FormData();form.set('metadata',JSON.stringify({name:slug,entrypoint_path:'index.ts',verify_jwt:false}));for(const file of files)form.append('file',new File([file.source],file.name,{type:'application/typescript'}));
  await call('functions/deploy?slug='+slug,{method:'POST',body:form});console.log(JSON.stringify({callback,checksum,deployed:true,publicDashboard:false}));
 }else throw Error('Use plan, prepare or deploy --publish.');
}catch(e){console.error(e instanceof Error?e.message:'WhatsApp deployment failed; details withheld.');process.exitCode=1;}
