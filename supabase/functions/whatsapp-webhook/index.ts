import {webhook} from './handler.ts';
const env=(name:string)=>Deno.env.get(name)??'';
const rpc=(url:string,key:string,name:string,body:object)=>fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000),redirect:'error'});
Deno.serve(webhook({appSecret:env('WA_APP_SECRET'),verifyToken:env('WA_VERIFY_TOKEN'),phoneId:env('WA_PHONE_NUMBER_ID')},async messages=>{
 const key=env('SUPABASE_SERVICE_ROLE_KEY'),url=env('SUPABASE_URL');
 if(!url||!key)throw Error('Unavailable');
 // "LOGIN 123456" from any WhatsApp number verifies a website sign-in code. Inbound messages cost nothing.
 if(!(await rpc(url,key,'saathi_wa_login',{p_messages:messages})).ok)throw Error('Unavailable');
 if(!(await rpc(url,key,'saathi_wa_enqueue',{p_phone:env('WA_PHONE_NUMBER_ID'),p_messages:messages})).ok)throw Error('Unavailable');
 // Wake the serverless worker now instead of waiting for the next minute's scheduled pass.
 const app=env('SAATHI_APP_URL'),secret=env('SAATHI_WORKER_SECRET');
 if(app&&secret){const wake=fetch(`${app}/api/worker`,{method:'POST',headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(55000)}).catch(()=>undefined);(globalThis as {EdgeRuntime?:{waitUntil(p:Promise<unknown>):void}}).EdgeRuntime?.waitUntil(wake);}
}));
