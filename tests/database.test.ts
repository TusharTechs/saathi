import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const patientA='10000000-0000-4000-8000-000000000001',patientB='10000000-0000-4000-8000-000000000002';
const userA='30000000-0000-4000-8000-000000000001',userB='30000000-0000-4000-8000-000000000002';
const memberA='20000000-0000-4000-8000-000000000001',memberB='20000000-0000-4000-8000-000000000002';
const alertA='60000000-0000-4000-8000-000000000001';
test('Supabase migration, constraints, RLS and transactional status changes',async t=>{
 const db=new PGlite();
 try{
 await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
 grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to authenticated;`);
 await db.exec(await readFile(new URL('../supabase/migrations/202610230001_core.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/202610230002_function_permissions.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/seed/demo.sql',import.meta.url),'utf8'));
 // Repeat seed to prove deterministic IDs are safe on rerun.
 await db.exec(await readFile(new URL('../supabase/seed/demo.sql',import.meta.url),'utf8'));
 await db.exec(`insert into auth.users values('${userA}'),('${userB}');update public.care_team_members set auth_user_id='${userA}' where id='${memberA}';update public.care_team_members set auth_user_id='${userB}' where id='${memberB}';
 insert into public.patient_care_team values('${patientA}','${memberA}'),('${patientB}','${memberB}');
 insert into public.protocol_versions(id,version,pack,rules_json,status) values('70000000-0000-4000-8000-000000000001','test-demo','adult','{}','demo_only');
 insert into public.messages(id,patient_id,channel,external_id,body) values('40000000-0000-4000-8000-000000000001','${patientA}','local','m1','Synthetic W4');
 insert into public.checkins(id,patient_id,message_id,fields_json) values('50000000-0000-4000-8000-000000000001','${patientA}','40000000-0000-4000-8000-000000000001','{}');
 insert into public.alerts(id,patient_id,checkin_id,protocol_version_id,tier,evaluation_status,trace_json) values('${alertA}','${patientA}','50000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','RED','needs_followup','{}');`);
 const auth=async(user:string)=>{await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`);};
 await t.test('assigned clinician sees only assigned patient and records',async()=>{
 await auth(userA);const r=await db.query<{id:string}>('select id from public.patients');assert.deepEqual(r.rows.map(x=>x.id),[patientA]);assert.equal((await db.query('select * from public.alerts')).rows.length,1);
 await auth(userB);assert.equal((await db.query('select * from public.alerts')).rows.length,0);assert.equal((await db.query('select * from public.messages')).rows.length,0);
 });
 await t.test('unassigned clinician cannot transition another patient alert',async()=>{
 await auth(userB);await assert.rejects(db.query('select public.transition_alert($1,$2,$3)',[alertA,'acknowledge',1]),/not accessible/);
 });
 await t.test('direct status and audit writes are forbidden',async()=>{
 await auth(userA);await assert.rejects(db.query("update public.alerts set status='acked'"),/permission denied/);await assert.rejects(db.query('insert into public.alert_events(alert_id,event) values($1,$2)',[alertA,'forged']),/permission denied/);
 });
 await t.test('revision guard and audit append commit together',async()=>{
 await auth(userA);await assert.rejects(db.query('select public.transition_alert($1,$2,$3)',[alertA,'resolve',1]),/Invalid status/);
 await db.query('select public.transition_alert($1,$2,$3)',[alertA,'acknowledge',1]);await assert.rejects(db.query('select public.transition_alert($1,$2,$3)',[alertA,'resolve',1]),/Revision conflict/);
 assert.equal((await db.query('select * from public.alert_events')).rows.length,1);await db.query('select public.transition_alert($1,$2,$3)',[alertA,'resolve',2]);assert.equal((await db.query('select * from public.alert_events')).rows.length,2);
 });
 await t.test('Supabase default function grants are explicitly removed for anon',async()=>{
 await db.exec('reset role');const r=await db.query<{allowed:boolean}>("select has_function_privilege('anon','public.transition_alert(uuid,text,integer)','EXECUTE') or has_function_privilege('anon','public.can_access_patient(uuid)','EXECUTE') as allowed");assert.equal(r.rows[0]!.allowed,false);
 });
 await t.test('anonymous users have no patient access or transition permission',async()=>{
 await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from public.patients'),/permission denied/);await assert.rejects(db.query('select public.transition_alert($1,$2,$3)',[alertA,'acknowledge',1]),/permission denied/);
 });
 await t.test('database rejects cross-patient source linkage',async()=>{
 await db.exec('reset role');await assert.rejects(db.query("insert into public.checkins(patient_id,message_id,fields_json) values($1,$2,'{}')",[patientB,'40000000-0000-4000-8000-000000000001']),/foreign key|unique constraint/);
 });
 await t.test('channel external IDs prevent duplicate ingestion',async()=>{
 await assert.rejects(db.query('insert into public.messages(patient_id,channel,external_id,body) values($1,$2,$3,$4)',[patientA,'local','m1','duplicate']),/unique constraint/);
 });
 await t.test('unsigned content cannot be marked approved',async()=>{
 await assert.rejects(db.query("insert into public.protocol_versions(version,pack,rules_json,status) values('unsigned','adult','{}','approved')"),/check constraint/);
 });
 }finally{await db.close();}
});
