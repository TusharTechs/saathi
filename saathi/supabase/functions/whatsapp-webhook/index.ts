import {webhook} from './handler.ts';
const env=(name:string)=>Deno.env.get(name)??'';
Deno.serve(webhook({appSecret:env('WA_APP_SECRET'),verifyToken:env('WA_VERIFY_TOKEN'),phoneId:env('WA_PHONE_NUMBER_ID')},async messages=>{
 const key=env('SUPABASE_SERVICE_ROLE_KEY'),url=env('SUPABASE_URL');
 if(!url||!key)throw Error('Unavailable');
 const response=await fetch(`${url}/rest/v1/rpc/saathi_wa_enqueue`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_phone:env('WA_PHONE_NUMBER_ID'),p_messages:messages}),signal:AbortSignal.timeout(12000),redirect:'error'});
 if(!response.ok)throw Error('Unavailable');
}));
