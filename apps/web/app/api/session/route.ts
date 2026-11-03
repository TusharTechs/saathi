import { z } from 'zod';
import { guard, body, store, json, fail } from '../../../lib/server';
import { readSession, sessionCookie, publicDemo, normalizePhone, type Role, type Session } from '../../../lib/session';
import { accounts, hashPassword, verifyPassword, passwordRule, emailRule, limitAttempts, recordFailure, type Account } from '../../../lib/accounts';
import { saathiId, WorkflowError } from '../../../../../packages/workflow/src/index';
import { JUDGE_EMAIL, JUDGE_NAME, JUDGE_PATIENT } from '../../../lib/judge-accounts';
/**
 * Sign-in needs no outside messaging service: accounts use a mobile number or an email address with a password.
 * (WhatsApp code sign-in was removed on 3 Nov after Meta blocked the app's API access; no login depends on Meta.)
 */
const role=z.enum(['medical','coordinator','family']);
const schema=z.discriminatedUnion('kind',[
  // Shared demo accounts so judges can explore every role in one click.
  z.object({kind:z.literal('demo'),role}).strict(),
  // Judges switch views without signing in again.
  z.object({kind:z.literal('switch'),role}).strict(),
  z.object({kind:z.literal('login'),login:z.string().trim().min(3).max(120),password:z.string().min(1).max(128)}).strict(),
  z.object({kind:z.literal('signup'),role,name:z.string().trim().min(1).max(80),method:z.enum(['phone','email']),phone:z.string().trim().max(20).optional(),email:emailRule.optional(),password:passwordRule,orgCode:z.string().trim().max(40).optional(),saathiId:z.string().trim().max(20).optional(),agreed:z.literal(true)}).strict(),
]);
// One judge identity viewed through each role; the family view is the synthetic patient Ramesh K.
const judgeView=(role:Role,base:Partial<Session>={}):Session=>({name:JUDGE_NAME,method:'demo',...base,role,judge:true,...(role==='family'?{patientId:JUDGE_PATIENT,agreedAt:new Date().toISOString()}:{})});
const ORG_CODE=()=>process.env.SAATHI_ORG_CODE||'SAATHI-DEMO';
export const runtime='nodejs';
const withCookie=(data:unknown,session:Session)=>{const r=json(data);r.headers.append('Set-Cookie',sessionCookie(session));return r;};
const preflight=(request:Request)=>{try{guard(request,true);}catch(e){if(!(e instanceof Error)||!/Sign in|role/.test(e.message))throw e;}};
const sessionFor=(a:Account,method:'email'|'phone'):Session=>({role:a.role,name:a.name,accountId:a.id,method,...(a.patientKey?{patientId:a.patientKey,agreedAt:new Date().toISOString()}:{})});
/** A login is an email address if it contains @, otherwise a mobile number. */
const parseLogin=(login:string)=>login.includes('@')?{email:emailRule.parse(login)}:{phone:normalizePhone(login)};
export async function GET(request:Request){
  try{return json({session:readSession(request),publicDemo:publicDemo(),orgCode:ORG_CODE(),demoSaathiId:saathiId('demo-ramesh')});}
  catch(e){return fail(e);}
}
export async function POST(request:Request){
  try{
    preflight(request);const input=schema.parse(await body(request));
    if(input.kind==='demo')return withCookie({role:input.role},judgeView(input.role));
    if(input.kind==='switch'){const current=readSession(request);if(!current?.judge)throw new WorkflowError(403,'Only judge test sessions can switch views.');
      return withCookie({role:input.role},judgeView(input.role,{name:current.name,method:current.method,accountId:current.accountId}));}
    const db=accounts();
    if(input.kind==='login'){
      const by=parseLogin(input.login),key='login:'+(by.email??by.phone);limitAttempts(key);
      const a=await db.find(by);
      if(!a||!await verifyPassword(input.password,a.passwordHash)){recordFailure(key);throw new WorkflowError(400,'That mobile number or email and password do not match an account.');}
      await db.touch(a.id);
      if(a.email===JUDGE_EMAIL)return withCookie({role:'medical'},judgeView('medical',{name:a.name,method:'email',accountId:a.id}));
      return withCookie({role:a.role},sessionFor(a,by.email?'email':'phone'));
    }
    // Sign-up: staff join an organisation with its invite code; families link to their patient with the Saathi ID from the OPD leaflet.
    if(input.role!=='family'&&input.orgCode?.toUpperCase()!==ORG_CODE().toUpperCase())throw new WorkflowError(400,'That organisation code is not correct. Ask your organisation’s Saathi administrator.');
    let patientKey:string|null=null;
    if(input.role==='family'){
      const p=(await store.queue()).patients.find(p=>saathiId(p.id)===(input.saathiId??'').toUpperCase());
      if(!p)throw new WorkflowError(400,'That Saathi ID was not found. It is on the leaflet from your OPD visit.');patientKey=p.id;
    }
    const email=input.method==='email'?input.email??null:null,phone=input.method==='phone'?normalizePhone(input.phone??''):null;
    if(input.method==='email'&&!email)throw new WorkflowError(400,'Enter an email address.');
    const a=await db.create({role:input.role,name:input.name,email,phone,passwordHash:await hashPassword(input.password),patientKey});
    return withCookie({role:a.role,created:true},sessionFor(a,input.method));
  }catch(e){return fail(e);}
}
export async function DELETE(){const r=json({signedOut:true});r.headers.append('Set-Cookie',sessionCookie(null));return r;}
