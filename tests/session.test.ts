import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionCookie, readSession, requireRole, checkStaffCode, publicDemo, issueCode, checkCode, normalizeContact } from '../apps/web/lib/session.ts';

const env={...process.env};
const reset=()=>{process.env={...env,SAATHI_SESSION_SECRET:'x'.repeat(40)};delete process.env.SAATHI_PUBLIC_DEMO;delete process.env.SAATHI_STAFF_CODE;};
const req=(cookie?:string)=>new Request('http://127.0.0.1:3000/api/queue',{headers:cookie?{cookie}:{}});
const cookieOf=(set:string)=>set.split(';')[0]!;

test('a signed session round-trips and keeps the family patient binding',()=>{
  reset();const c=cookieOf(sessionCookie({role:'family',name:'a@b.in',patientId:'demo-ramesh',agreedAt:'2026-11-03T10:00:00Z'}));
  assert.deepEqual(readSession(req(c)),{role:'family',name:'a@b.in',patientId:'demo-ramesh',agreedAt:'2026-11-03T10:00:00Z'});
});
test('a tampered session payload is rejected',()=>{
  reset();const [name,value]=cookieOf(sessionCookie({role:'family',name:'x',patientId:'demo-ramesh'})).split('=');
  const [,mac]=value!.split('.');const forged=Buffer.from(JSON.stringify({role:'medical',name:'x',exp:Date.now()+1e6})).toString('base64url');
  assert.equal(readSession(req(`${name}=${forged}.${mac}`)),null);
});
test('roles are enforced: a family cannot open medical routes',()=>{
  reset();const c=cookieOf(sessionCookie({role:'family',name:'x',patientId:'demo-ramesh'}));
  assert.throws(()=>requireRole(req(c),['medical']),/role/);
  assert.throws(()=>requireRole(req(),['medical']),/Sign in/);
  assert.equal(requireRole(req(cookieOf(sessionCookie({role:'coordinator',name:'cm'}))),['medical','coordinator']).role,'coordinator');
});
test('signing refuses to run without a secret',()=>{
  reset();delete process.env.SAATHI_SESSION_SECRET;delete process.env.SUPABASE_SECRET_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.throws(()=>sessionCookie({role:'medical',name:'d'}),/SAATHI_SESSION_SECRET/);
});
test('public demo mode needs both a secret and a staff code, then checks the code',()=>{
  reset();assert.equal(publicDemo(),false);assert.doesNotThrow(()=>checkStaffCode(undefined));
  process.env.SAATHI_PUBLIC_DEMO='1';assert.throws(()=>publicDemo(),/SAATHI_STAFF_CODE/);
  process.env.SAATHI_STAFF_CODE='judges-2026';assert.equal(publicDemo(),true);
  assert.throws(()=>checkStaffCode('wrong'),/not correct/);assert.doesNotThrow(()=>checkStaffCode('judges-2026'));
});
test('one-time codes work once and accept phone or email',()=>{
  reset();assert.equal(normalizeContact('+91 98450-12345'),'919845012345');assert.equal(normalizeContact(' Son@Example.com '),'son@example.com');
  assert.throws(()=>normalizeContact('hello'));
  const code=issueCode('son@example.com');assert.throws(()=>checkCode('son@example.com','000000'===code?'111111':'000000'),/not correct/);
  checkCode('son@example.com',code);assert.throws(()=>checkCode('son@example.com',code),/expired/);
});
test.after(()=>{process.env=env;});
