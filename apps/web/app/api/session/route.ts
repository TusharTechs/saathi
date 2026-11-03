import { z } from 'zod';
import QRCode from 'qrcode';
import { guard, body, store, json, fail } from '../../../lib/server';
import { readSession, sessionCookie, publicDemo, type Role, type Session } from '../../../lib/session';
import { accounts, hashPassword, verifyPassword, passwordRule, emailRule, limitAttempts, recordFailure, type Account } from '../../../lib/accounts';
import { saathiId, WorkflowError } from '../../../../../packages/workflow/src/index';
const role=z.enum(['medical','coordinator','family']);
const schema=z.discriminatedUnion('kind',[
  // Shared demo accounts so judges can explore every role in one click.
  z.object({kind:z.literal('demo'),role}).strict(),
  z.object({kind:z.literal('challenge')}).strict(),
  z.object({kind:z.literal('email-login'),email:emailRule,password:z.string().min(1).max(128)}).strict(),
  z.object({kind:z.literal('whatsapp-login'),challengeId:z.uuid()}).strict(),
  z.object({kind:z.literal('signup'),role,name:z.string().trim().min(1).max(80),method:z.enum(['email','whatsapp']),email:emailRule.optional(),password:passwordRule.optional(),challengeId:z.uuid().optional(),orgCode:z.string().trim().max(40).optional(),saathiId:z.string().trim().max(20).optional(),agreed:z.literal(true)}).strict(),
]);
const DEMO:Record<Role,Session>={
  medical:{role:'medical',name:'Judge · Doctor (demo)',method:'demo'},
  coordinator:{role:'coordinator',name:'Judge · Call manager (demo)',method:'demo'},
  family:{role:'family',name:'Judge · Family of Ramesh K. (demo)',patientId:'demo-ramesh',method:'demo'},
};
const ORG_CODE=()=>process.env.SAATHI_ORG_CODE||'SAATHI-DEMO';
const WA_NUMBER=()=>(process.env.SAATHI_WA_NUMBER??'').replace(/[^\d]/g,'');
export const runtime='nodejs';
const withCookie=(data:unknown,session:Session)=>{const r=json(data);r.headers.append('Set-Cookie',sessionCookie(session));return r;};
const preflight=(request:Request)=>{try{guard(request,true);}catch(e){if(!(e instanceof Error)||!/Sign in|role/.test(e.message))throw e;}};
const sessionFor=(a:Account,method:'email'|'whatsapp'):Session=>({role:a.role,name:a.name,accountId:a.id,method,...(a.patientKey?{patientId:a.patientKey,agreedAt:new Date().toISOString()}:{})});
export async function GET(request:Request){
  try{
    // Polling a WhatsApp sign-in code works before sign-in; the unguessable ID only reveals verified or expired.
    const challenge=new URL(request.url).searchParams.get('challenge');
    if(challenge){const s=await accounts().status(z.uuid().parse(challenge));return json({verified:Boolean(s?.verified),expired:!s||s.expired});}
    return json({session:readSession(request),publicDemo:publicDemo(),whatsappLogin:Boolean(WA_NUMBER()),orgCode:ORG_CODE(),demoSaathiId:saathiId('demo-ramesh')});
  }catch(e){return fail(e);}
}
export async function POST(request:Request){
  try{
    preflight(request);const input=schema.parse(await body(request));
    if(input.kind==='demo')return withCookie({role:input.role},DEMO[input.role]);
    const db=accounts();
    if(input.kind==='challenge'){
      const number=WA_NUMBER();if(!number)throw new WorkflowError(503,'WhatsApp sign-in is not configured.');
      const {id,code}=await db.challenge(),text=`LOGIN ${code}`,link=`https://wa.me/${number}?text=${encodeURIComponent(text)}`;
      return json({id,code,text,link,qr:await QRCode.toString(link,{type:'svg',margin:1,width:180,color:{dark:'#214f46',light:'#ffffff'}}),number:`+${number}`});
    }
    if(input.kind==='email-login'){
      limitAttempts('email:'+input.email);const a=await db.find({email:input.email});
      if(!a||!await verifyPassword(input.password,a.passwordHash)){recordFailure('email:'+input.email);throw new WorkflowError(400,'That email and password do not match an account.');}
      await db.touch(a.id);return withCookie({role:a.role},sessionFor(a,'email'));
    }
    if(input.kind==='whatsapp-login'){
      const status=await db.status(input.challengeId);if(!status?.verified||!status.phone)throw new WorkflowError(400,status?.expired?'This code expired. Get a new one.':'We have not received your WhatsApp message yet.');
      const a=await db.find({phone:status.phone});
      // Verified, but no account yet: keep the challenge for sign-up.
      if(!a)return json({needsSignup:true,phone:`+${status.phone}`});
      if(await db.consume(input.challengeId)!==status.phone)throw new WorkflowError(400,'This code was already used. Get a new one.');
      await db.touch(a.id);return withCookie({role:a.role},sessionFor(a,'whatsapp'));
    }
    // Sign-up: staff join an organisation with its invite code; families link to their patient with the Saathi ID from the OPD leaflet.
    if(input.role!=='family'&&input.orgCode?.toUpperCase()!==ORG_CODE().toUpperCase())throw new WorkflowError(400,'That organisation code is not correct. Ask your organisation’s Saathi administrator.');
    let patientKey:string|null=null;
    if(input.role==='family'){
      const p=(await store.queue()).patients.find(p=>saathiId(p.id)===(input.saathiId??'').toUpperCase());
      if(!p)throw new WorkflowError(400,'That Saathi ID was not found. It is on the leaflet from your OPD visit.');patientKey=p.id;
    }
    let email:string|null=null,phone:string|null=null,passwordHash:string|null=null;
    if(input.method==='email'){
      if(!input.email||!input.password)throw new WorkflowError(400,'Enter an email address and a password of at least 8 characters.');
      email=input.email;passwordHash=await hashPassword(input.password);
    }else{
      if(!input.challengeId)throw new WorkflowError(400,'Verify your mobile number on WhatsApp first.');
      const status=await db.status(input.challengeId);if(!status?.verified||!status.phone)throw new WorkflowError(400,'Verify your mobile number on WhatsApp first.');
      if(await db.find({phone:status.phone}))throw new WorkflowError(409,'This mobile number already has an account. Sign in instead.');
      phone=await db.consume(input.challengeId);if(!phone)throw new WorkflowError(400,'This code was already used. Get a new one.');
    }
    const a=await db.create({role:input.role,name:input.name,email,phone,passwordHash,patientKey});
    return withCookie({role:a.role,created:true},sessionFor(a,input.method));
  }catch(e){return fail(e);}
}
export async function DELETE(){const r=json({signedOut:true});r.headers.append('Set-Cookie',sessionCookie(null));return r;}
