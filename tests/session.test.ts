import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionCookie, readSession, requireRole, publicDemo, normalizePhone } from '../apps/web/lib/session.ts';
import { hashPassword, verifyPassword } from '../apps/web/lib/accounts.ts';

const env={...process.env};
const reset=()=>{process.env={...env,SAATHI_SESSION_SECRET:'x'.repeat(40)};delete process.env.SAATHI_PUBLIC_DEMO;};
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
test('hosted mode needs a dedicated signing secret',()=>{
  reset();assert.equal(publicDemo(),false);
  process.env.SAATHI_PUBLIC_DEMO='1';assert.equal(publicDemo(),true);
  process.env.SAATHI_SESSION_SECRET='short';assert.throws(()=>publicDemo(),/SAATHI_SESSION_SECRET/);
});
test('mobile numbers are stored with the country code',()=>{
  assert.equal(normalizePhone('98450 12345'),'919845012345');assert.equal(normalizePhone('+91 98450-12345'),'919845012345');assert.equal(normalizePhone('+44 7700 900123'),'447700900123');
  assert.throws(()=>normalizePhone('123'));
});
test('passwords are salted scrypt hashes and verify only the right password',async()=>{
  const a=await hashPassword('correct horse'),b=await hashPassword('correct horse');
  assert.match(a,/^scrypt\$/);assert.notEqual(a,b);
  assert.equal(await verifyPassword('correct horse',a),true);assert.equal(await verifyPassword('wrong horse',a),false);assert.equal(await verifyPassword('x',null),false);
});
test.after(()=>{process.env=env;});
