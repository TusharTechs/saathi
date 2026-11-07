import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { SupabaseStore, WorkflowError } from '../../../packages/workflow/src/index';
import type { Role } from './session';
/**
 * Saathi accounts: a mobile number or email address with a password (scrypt).
 * Stored in Supabase behind service-only functions (migration 010).
 */
const SCRYPT={N:16384,r:8,p:1,maxmem:64*1024*1024};
const scrypt=(password:string,salt:Buffer)=>new Promise<Buffer>((resolve,reject)=>scryptCallback(password.normalize('NFKC'),salt,32,SCRYPT,(e,key)=>e?reject(e):resolve(key)));
export async function hashPassword(password:string){const salt=randomBytes(16);return `scrypt$${salt.toString('base64url')}$${(await scrypt(password,salt)).toString('base64url')}`;}
export async function verifyPassword(password:string,stored:string|null|undefined){
  const [kind,salt,hash]=(stored??'').split('$');if(kind!=='scrypt'||!salt||!hash)return false;
  const key=await scrypt(password,Buffer.from(salt,'base64url')),expected=Buffer.from(hash,'base64url');
  return expected.length===key.length&&timingSafeEqual(expected,key);
}
export const passwordRule=z.string().min(8,'Use at least 8 characters for the password.').max(128);
export const emailRule=z.string().trim().toLowerCase().max(120).email('Enter a valid email address.');
const account=z.object({id:z.uuid(),role:z.enum(['medical','coordinator','family']),name:z.string(),email:z.string().nullable(),phone:z.string().nullable(),patientKey:z.string().nullable(),passwordHash:z.string().nullable().optional(),staffType:z.enum(['doctor','nurse','psychologist']).nullable().optional()});
export type Account=z.infer<typeof account>;
export class AccountStore extends SupabaseStore {
  async create(input:{role:Role;name:string;email?:string|null;phone?:string|null;passwordHash?:string|null;patientKey?:string|null}){
    try{return account.parse(await this.rpc('saathi_account_create',{p_role:input.role,p_name:input.name,p_email:input.email??null,p_phone:input.phone??null,p_password_hash:input.passwordHash??null,p_patient_key:input.patientKey??null,p_organisation:'demo-org'}));}
    catch(e){if(e instanceof WorkflowError&&e.code===409)throw new WorkflowError(409,'An account with this email or mobile number already exists. Sign in instead.');throw e;}
  }
  async find(by:{email?:string;phone?:string}){return account.nullable().parse(await this.rpc('saathi_account_find',{p_email:by.email??null,p_phone:by.phone??null}));}
  async touch(id:string){await this.rpc('saathi_account_touch',{p_id:id});}
  async setStaff(id:string,staff:'doctor'|'nurse'|'psychologist'){await this.rpc('saathi_account_set_staff',{p_id:id,p_staff:staff});}
}
export function accounts(){
  if((process.env.SAATHI_STORAGE??'local')!=='supabase')throw new WorkflowError(503,'Accounts need Supabase storage. Use a demo account, or set SAATHI_STORAGE=supabase.');
  return new AccountStore(process.env.NEXT_PUBLIC_SUPABASE_URL??'',process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'');
}
// Coarse, per-instance guard against password guessing (serverless instances do not share it).
const failures=new Map<string,number[]>();
export function limitAttempts(key:string){const recent=(failures.get(key)??[]).filter(t=>t>Date.now()-600000);failures.set(key,recent);if(recent.length>=8)throw new WorkflowError(429,'Too many attempts. Wait ten minutes and try again.');}
export function recordFailure(key:string){failures.set(key,[...(failures.get(key)??[]),Date.now()]);}
