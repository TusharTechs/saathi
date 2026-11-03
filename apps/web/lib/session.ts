import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { WorkflowError } from '../../../packages/workflow/src/index';
/**
 * Sessions for the three roles from Dr. Rao's direction: medical staff, call managers and families.
 * People sign in with an account (mobile number or email, with a password) or the judge demo access.
 * Sessions are HMAC-signed cookies; every API route checks the role.
 */
export type Role='medical'|'coordinator'|'family';
export type Method='demo'|'email'|'phone';
/** `judge` sessions (demo buttons and the judge test login) may switch between the three role views. */
export type Session={role:Role;name:string;patientId?:string;agreedAt?:string;accountId?:string;method?:Method;judge?:boolean};
const COOKIE='saathi_session';
/** Hosted mode: any host may connect, so a dedicated signing secret must be configured. */
export const publicDemo=()=>{
  if(process.env.SAATHI_PUBLIC_DEMO!=='1')return false;
  if((process.env.SAATHI_SESSION_SECRET??'').length<32)throw new WorkflowError(503,'Hosted mode needs SAATHI_SESSION_SECRET (32+ characters).');
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
  try{const s=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')) as Session&{exp:number};if(!(s.exp>Date.now())||!['medical','coordinator','family'].includes(s.role))return null;
    const out:Session={role:s.role,name:s.name};for(const k of ['patientId','agreedAt','accountId','method','judge'] as const)if(s[k])(out as Record<string,unknown>)[k]=s[k];return out;}catch{return null;}
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
/** Mobile numbers are stored as digits with the country code; a bare 10-digit Indian number gets 91. */
export const normalizePhone=(raw:string)=>{const d=raw.replace(/[^\d]/g,'');const n=d.length===10?'91'+d:d;if(!/^\d{8,15}$/.test(n))throw new WorkflowError(400,'Enter a mobile number with country code.');return n;};
