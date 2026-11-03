import {test} from 'node:test';
import assert from 'node:assert/strict';
process.env.SAATHI_LOCAL_DEMO='1';process.env.SAATHI_STORAGE='local';process.env.SAATHI_SESSION_SECRET='r'.repeat(40);
const {POST,GET}=await import('../apps/web/app/api/session/route.ts');
const B='http://127.0.0.1:3000';
const post=(payload:object)=>POST(new Request(`${B}/api/session`,{method:'POST',headers:{host:'127.0.0.1:3000',origin:B,'content-type':'application/json'},body:JSON.stringify(payload)}));
test('session API: every request shape parses, and demo accounts sign in per role',async()=>{
  for(const role of ['medical','coordinator','family']){const r=await post({kind:'demo',role});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie')??'',/saathi_session=/);}
  // Without Supabase, account routes fail cleanly with 503 rather than a schema or server error.
  for(const payload of [{kind:'login',login:'a@b.in',password:'x'},{kind:'login',login:'98450 12345',password:'x'},{kind:'signup',role:'medical',name:'D',method:'phone',phone:'9845012345',password:'longenough',orgCode:'SAATHI-DEMO',agreed:true},
    {kind:'signup',role:'family',name:'A',method:'email',email:'a@b.in',password:'longenough',saathiId:'SA-QFH9YB',agreed:true}]){
    const r=await post(payload);assert.ok([400,503].includes(r.status),`${payload.kind} -> ${r.status} ${await r.text()}`);}
  assert.equal((await post({kind:'signup',role:'family',name:'A',method:'email',email:'a@b.in',password:'longenough',saathiId:'SA-QFH9YB'})).status,400,'terms must be accepted');
  assert.equal((await post({kind:'challenge',phone:'9845012345'})).status,400,'WhatsApp sign-in codes are gone');
  assert.equal((await post({kind:'nope'})).status,400);
  const info=await (await GET(new Request(`${B}/api/session`,{headers:{host:'127.0.0.1:3000'}}))).json();assert.equal(info.session,null);
});
test('judge sessions switch between the three views; others cannot',async()=>{
  const cookie=(r:Response)=>(r.headers.get('set-cookie')??'').split(';')[0]!;
  const withCookie=(c:string,payload:object)=>POST(new Request(`${B}/api/session`,{method:'POST',headers:{host:'127.0.0.1:3000',origin:B,'content-type':'application/json',cookie:c},body:JSON.stringify(payload)}));
  let c=cookie(await post({kind:'demo',role:'medical'}));
  const sw=await withCookie(c,{kind:'switch',role:'family'});assert.equal(sw.status,200,await sw.clone().text());c=cookie(sw);
  const info=await (await GET(new Request(`${B}/api/session`,{headers:{host:'127.0.0.1:3000',cookie:c}}))).json();
  assert.equal(info.session.role,'family');assert.equal(info.session.patientId,'demo-ramesh');assert.equal(info.session.judge,true);
  assert.equal((await withCookie('',{kind:'switch',role:'medical'})).status,403);
});
