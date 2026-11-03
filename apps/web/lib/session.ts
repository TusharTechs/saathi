import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { WorkflowError } from '../../../packages/workflow/src/index';
/**
 * Simulated sign-in for the demo: three roles from Dr. Rao's direction, signed cookies, and one-time codes
 * shown on screen because no SMS or email provider is connected. This is role separation, not real authentication.
 */
export type Role='medical'|'coordinator'|'family';
export type Session={role:Role;name:string;patientId?:string;agreedAt?:string};
const COOKIE='saathi_session';
/** Hosted demo: any host may connect, so a signing secret and a staff access code must both be configured. */
export const publicDemo=()=>{
  if(process.env.SAATHI_PUBLIC_DEMO!=='1')return false;
  if((process.env.SAATHI_SESSION_SECRET??'').length<32||(process.env.SAATHI_STAFF_CODE??'').length<8)throw new WorkflowError(503,'Public demo needs SAATHI_SESSION_SECRET (32+ characters) and SAATHI_STAFF_CODE (8+ characters).');
  return true;
};
// Server-only signing key. Never sign with an empty secret, which would make cookies forgeable.
const key=()=>{
  const secret=process.env.SAATHI_SESSION_SECRET||process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(secret.length<16)throw new WorkflowError(503,'Set SAATHI_SESSION_SECRET in env.local to enable sign-in.');
  return createHash('sha256').update('saathi-session:'+secret).digest();
};
const sign=(payload:string)=>createHmac('sha256',key()).update(payload).digest('base64url');
export function readSession(request:Request):Session|null{
  const raw=request.headers.get('cookie')?.split(/;\s*/).find(c=>c.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);if(!raw)return null;
  const [payload,mac]=raw.split('.');if(!payload||!mac)return null;
  const expected=Buffer.from(sign(payload)),given=Buffer.from(mac);if(expected.length!==given.length||!timingSafeEqual(expected,given))return null;
  try{const s=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')) as Session&{exp:number};return s.exp>Date.now()&&['medical','coordinator','family'].includes(s.role)?{role:s.role,name:s.name,patientId:s.patientId,agreedAt:s.agreedAt}:null;}catch{return null;}
}
export function sessionCookie(session:Session|null){
  if(!session)return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  const payload=Buffer.from(JSON.stringify({...session,exp:Date.now()+12*3600000})).toString('base64url');
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`;
}
export function requireRole(request:Request,roles:Role[]):Session{
  const s=readSession(request);if(!s)throw new WorkflowError(401,'Sign in to Saathi first.');
  if(!roles.includes(s.role))throw new WorkflowError(403,'Your role cannot open this part of Saathi.');return s;
}
// One-time codes live only in this server process for five minutes.
const codes=new Map<string,{code:string;expires:number;tries:number}>();
export const normalizeContact=(contact:string)=>{const c=contact.trim().toLowerCase();if(/^\+?\d[\d\s-]{7,16}$/.test(c))return c.replace(/[^\d]/g,'');if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c))return c;throw new WorkflowError(400,'Enter a mobile number or an email address.');};
export function issueCode(contact:string){const code=String(randomInt(100000,1000000));codes.set(contact,{code,expires:Date.now()+300000,tries:0});return code;}
export function checkCode(contact:string,code:string){
  const entry=codes.get(contact);if(!entry||entry.expires<Date.now())throw new WorkflowError(400,'The code has expired. Request a new one.');
  if(++entry.tries>5){codes.delete(contact);throw new WorkflowError(429,'Too many attempts. Request a new code.');}
  if(entry.code!==code.trim())throw new WorkflowError(400,'That code is not correct.');codes.delete(contact);
}
// Staff access code for the hosted demo, with a coarse lockout against guessing.
let staffFailures:number[]=[];
export function checkStaffCode(given:string|undefined){
  if(!publicDemo())return;
  staffFailures=staffFailures.filter(t=>t>Date.now()-600000);
  if(staffFailures.length>=20)throw new WorkflowError(429,'Too many attempts. Try again in ten minutes.');
  const a=createHash('sha256').update(given??'').digest(),b=createHash('sha256').update(process.env.SAATHI_STAFF_CODE!).digest();
  if(!timingSafeEqual(a,b)){staffFailures.push(Date.now());throw new WorkflowError(403,'That staff access code is not correct.');}
}
