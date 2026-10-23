import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {adultProtocol} from '../packages/clinical-content/src/index.ts';
import {processReport,buttonInput, SupabaseStore, type RecordEntry} from '../packages/workflow/src/index.ts';
import {fixtureInput} from '../packages/workflow/src/fixtures.ts';
const root=new URL('../',import.meta.url);
const requestId=randomUUID();
const report=processReport(fixtureInput({requestId,patientId:'demo-ramesh',scenario:'urgent',answers:{}}),'synthetic_fixture');
const fingerprint=createHash('sha256').update('test-request').digest('hex');
test('Supabase service-only storage transactions and grants',async t=>{
 const db=new PGlite();
 const rpc=async<T>(sql:string,args:unknown[]=[])=>{const r=await db.query<{data:T}>(sql,args);return r.rows[0]!.data;};
 const submit=(id=requestId,hash=fingerprint,r:unknown=report,patient='demo-ramesh')=>rpc<{record:RecordEntry;duplicate:boolean}>('select public.saathi_demo_submit($1::uuid,$2,$3,$4::jsonb,$5::jsonb) as data',[id,patient,hash,JSON.stringify(r),JSON.stringify(adultProtocol)]);
 try{
  await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema public,auth to anon,authenticated,service_role;
   alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
  for(const file of ['supabase/migrations/202610230001_core.sql','supabase/migrations/202610230002_function_permissions.sql','supabase/seed/demo.sql','supabase/migrations/202610230003_demo_storage.sql','supabase/migrations/202610230004_conflict_responses.sql','supabase/migrations/202610230005_narrative_analysis.sql']) await db.exec(await readFile(new URL(file,root),'utf8'));
  await t.test('anonymous and authenticated roles cannot call any service-only RPC',async()=>{
   for(const role of ['anon','authenticated']){
    await db.exec(`set role ${role}`);
    for(const sql of ['select public.saathi_demo_queue()','select public.saathi_demo_tick()',`select public.saathi_demo_record('${randomUUID()}')`])await assert.rejects(db.query(sql),/permission denied/);
    await db.exec('reset role');
   }
   const r=await db.query<{allowed:boolean}>("select bool_or(has_function_privilege('anon',oid,'EXECUTE') or has_function_privilege('authenticated',oid,'EXECUTE')) as allowed from pg_proc where proname like 'saathi_demo_%'");assert.equal(r.rows[0]!.allowed,false);
  });
  await db.exec('set role service_role');
  await t.test('queue reads seeded patients from the database',async()=>{
   const q=await rpc<{patients:{id:string}[];storage:string;records:RecordEntry[]}>('select public.saathi_demo_queue() as data');assert.equal(q.storage,'supabase');assert.equal(q.patients.length,5);assert.ok(q.patients.some(p=>p.id==='demo-ramesh'));assert.equal(q.records.length,0);
  });
  let record:RecordEntry;
  await t.test('message, check-in, evaluation and audit are persisted together',async()=>{
   const r=await submit();record=r.record;assert.equal(r.duplicate,false);assert.equal(record.report.evaluation.tier,'RED');assert.equal(record.report.input.messages[0]!.id,requestId);assert.deepEqual(record.report.evaluation.matched,['R2','A1']);assert.equal(record.events.length,1);
   for(const table of ['messages','checkins','alerts','alert_events'])assert.equal((await db.query<{n:number}>(`select count(*)::int as n from public.${table}`)).rows[0]!.n,1);
  });
  await t.test('retry returns the same report without duplicate events; conflicting key fails',async()=>{
   const a=await submit();assert.equal(a.duplicate,true);assert.equal(a.record.id,record.id);assert.equal(a.record.events.length,1);
   await assert.rejects(submit(requestId,'f'.repeat(64)),/Request ID conflict/);
   await assert.rejects(submit(requestId,fingerprint,report,'demo-meena'),/Request ID conflict/);
  });
  await t.test('late insert failure rolls back all earlier inserts',async()=>{
   const invalid={...report,evaluation:{...report.evaluation,tier:'PURPLE'}};
   await assert.rejects(submit(randomUUID(),fingerprint,invalid),/check constraint/);
   assert.equal((await db.query<{n:number}>('select count(*)::int as n from public.messages')).rows[0]!.n,1);
  });
  await t.test('unknown patient and unsigned-mode violation fail without writes',async()=>{
   await assert.rejects(submit(randomUUID(),fingerprint,report,'not-a-patient'),/Unknown synthetic/);
   await assert.rejects(submit(randomUUID(),fingerprint,{...report,evaluation:{...report.evaluation,mode:'production'}}),/Invalid demo report/);
  });
  await t.test('database escalation only progresses at interval and exhausts once',async()=>{
   assert.equal((await rpc<{changed:number}>('select public.saathi_demo_tick() as data')).changed,0);
   for(let i=1;i<=3;i++){
    await db.query("update public.alerts set last_escalated_at=now()-interval '16 minutes' where id=$1",[record.id]);
    assert.equal((await rpc<{changed:number}>('select public.saathi_demo_tick() as data')).changed,1);
    assert.equal((await rpc<{changed:number}>('select public.saathi_demo_tick() as data')).changed,0);
   }
   const r=await rpc<RecordEntry>('select public.saathi_demo_record($1) as data',[record.id]);assert.equal(r.escalationLevel,2);assert.equal(r.exhausted,true);assert.equal(r.events.length,4);assert.equal(r.status,'open');
  });
  await t.test('acknowledge/resolve require latest revision and append one event each',async()=>{
   const latest=await rpc<RecordEntry>('select public.saathi_demo_record($1) as data',[record.id]);
   await assert.rejects(rpc('select public.saathi_demo_transition($1,$2,$3) as data',[record.id,'resolve',latest.revision]),/Invalid status/);
   const ack=await rpc<RecordEntry>('select public.saathi_demo_transition($1,$2,$3) as data',[record.id,'acknowledge',latest.revision]);assert.equal(ack.status,'acked');
   await assert.rejects(rpc('select public.saathi_demo_transition($1,$2,$3) as data',[record.id,'resolve',latest.revision]),/Revision conflict/);
   const done=await rpc<RecordEntry>('select public.saathi_demo_transition($1,$2,$3) as data',[record.id,'resolve',ack.revision]);assert.equal(done.status,'resolved');assert.equal(done.events.length,6);
  });
  await t.test('narrative leases, immutable evidence, reopening and check-in fields are atomic',async()=>{
   const request=randomUUID(),text='He dozes off in the middle of conversations.';
   const input={messages:[{id:request,text}],fields:{},context:{pack:'adult' as const}};
   const pending={...processReport(input,'text',true),processing:{language:'en-IN',extraction:{provider:'groq' as const,model:'openai/gpt-oss-120b' as const,status:'pending' as const}}};
   let r=(await submit(request,fingerprint,pending)).record;
   assert.equal(r.report.evaluation.tier,null);
   const claim=()=>rpc<{claimed:boolean;lease:string;record:RecordEntry}>('select public.saathi_demo_claim_analysis($1) as data',[r.id]);
   const lease=await claim();assert.equal(lease.claimed,true);assert.equal((await claim()).claimed,false);
   r=await rpc<RecordEntry>('select public.saathi_demo_transition($1,$2,$3) as data',[r.id,'acknowledge',lease.record.revision]);
   r=await rpc<RecordEntry>('select public.saathi_demo_transition($1,$2,$3) as data',[r.id,'resolve',r.revision]);
   const complete={...processReport({...input,fields:{wakefulness:{value:'W4' as const,confidence:1,quote:'dozes off in the middle of conversations',messageId:request}}},'text',true),processing:{...pending.processing,extraction:{...pending.processing.extraction,status:'complete'}}};
   const finish=(token:string|null,report:unknown=complete)=>rpc<RecordEntry>('select public.saathi_demo_complete_analysis($1,$2,$3::jsonb) as data',[r.id,token,JSON.stringify(report)]);
   await assert.rejects(finish(null),/lease conflict/);await assert.rejects(finish(randomUUID()),/lease conflict/);
   await assert.rejects(finish(lease.lease,{...complete,input:{...input,messages:[{id:request,text:'Changed source'}]}}),/Invalid analysis/);
   r=await finish(lease.lease);assert.equal(r.status,'open');assert.equal(r.report.evaluation.tier,'RED');assert.ok(r.events.some(e=>e.type==='reopened'));assert.equal((await claim()).claimed,false);
   const fields=await db.query<{fields:unknown}>('select fields_json as fields from public.checkins where id=(select checkin_id from public.alerts where id=$1)',[r.id]);assert.deepEqual(fields.rows[0]!.fields,complete.input.fields);
   await assert.rejects(finish(lease.lease),/lease conflict/);
   await assert.rejects(rpc('select public.saathi_demo_lookup($1,$2) as data',[request,'e'.repeat(64)]),/Request ID conflict/);
  });
  await t.test('failed extraction can retry but cannot remove independent RED flags',async()=>{
   const request=randomUUID(),input={messages:[{id:request,text:'We cannot wake him.'}],fields:{},context:{pack:'adult' as const}};
   const pending={...processReport(input,'text',true),processing:{language:'en-IN',extraction:{provider:'groq' as const,model:'openai/gpt-oss-120b' as const,status:'pending' as const}}};
   const r=(await submit(request,fingerprint,pending)).record;
   const claim=()=>rpc<{claimed:boolean;lease:string;record:RecordEntry}>('select public.saathi_demo_claim_analysis($1) as data',[r.id]);
   let c=await claim();
   await db.query("update public.alerts set analysis_lease_until=now()-interval '1 second' where id=$1",[r.id]);
   const failed={...pending,evaluation:{...pending.evaluation,tier:null,matched:[]},processing:{...pending.processing,extraction:{...pending.processing.extraction,status:'failed'}}};
   await assert.rejects(rpc('select public.saathi_demo_complete_analysis($1,$2,$3::jsonb) as data',[r.id,c.lease,JSON.stringify(failed)]),/lease conflict/);
   c=await claim();assert.equal(c.claimed,true);
   const saved=await rpc<RecordEntry>('select public.saathi_demo_complete_analysis($1,$2,$3::jsonb) as data',[r.id,c.lease,JSON.stringify(failed)]);
   assert.equal(saved.report.evaluation.tier,'RED');assert.ok(saved.report.evaluation.matched.some(x=>x.startsWith('safety_net:')));assert.equal(saved.report.processing?.extraction.status,'failed');
   assert.equal((await claim()).claimed,true);
  });
  await t.test('local history imports once, retaining IDs, timestamps and acknowledgement',async()=>{
   const localId=randomUUID(),localRequest=randomUUID();
   const importedReport=processReport(buttonInput({requestId:localRequest,patientId:'demo-meena',answers:{wakefulness:'W4'}},{pack:'adult'}),'buttons');
   const local={id:localId,patientId:'demo-meena',requestId:localRequest,fingerprint,createdAt:'2026-10-23T10:00:00Z',status:'acked',revision:2,escalationLevel:0,lastEscalatedAt:'2026-10-23T10:00:00Z',exhausted:false,report:importedReport,
    events:[{id:randomUUID(),at:'2026-10-23T10:00:00Z',type:'created',actor:'Demo system',details:'Original creation'},
    {id:randomUUID(),at:'2026-10-23T10:01:00Z',type:'acknowledged',actor:'Demo doctor 1',details:'Original acknowledgement'}]};
   const call=()=>rpc<{record:RecordEntry;duplicate:boolean}>('select public.saathi_demo_import($1::jsonb,$2::jsonb) as data',[JSON.stringify(local),JSON.stringify(adultProtocol)]);
   const first=await call();assert.equal(first.record.id,localId);assert.equal(first.record.status,'acked');assert.equal(first.record.revision,2);assert.equal(Date.parse(first.record.createdAt),Date.parse(local.createdAt));assert.equal(first.record.events.length,3);assert.equal(first.record.events[0]!.id,local.events[0]!.id);assert.equal(first.record.events[2]!.type,'imported');
   const retry=await call();assert.equal(retry.duplicate,true);assert.equal(retry.record.events.length,3);
  });
 }finally{await db.close();}
});
test('Supabase adapter preserves idempotency payload, uses server apikey and parses timestamps',async()=>{
 let seen:Record<string,unknown>|undefined;
 const fixture:RecordEntry={id:randomUUID(),patientId:'demo-ramesh',requestId,fingerprint,createdAt:'2026-10-23T10:00:00+00:00',status:'open',revision:1,escalationLevel:0,lastEscalatedAt:'2026-10-23T10:00:00+00:00',exhausted:false,report,events:[]};
 const transport:typeof fetch=async(url,options)=>{
  assert.ok(String(url).endsWith('/rest/v1/rpc/saathi_demo_submit'));
  assert.equal(new Headers(options?.headers).get('apikey'),'sb_secret_test');assert.equal(new Headers(options?.headers).has('Authorization'),false);
  seen=JSON.parse(String(options?.body));return Response.json({record:fixture,duplicate:false});
 };
 const store=new SupabaseStore('https://testproject.supabase.co','sb_secret_test',transport);
 const r=await store.submit({requestId,patientId:'demo-ramesh',scenario:'urgent',answers:{}});assert.equal(r.record.id,fixture.id);assert.equal(seen?.p_request_id,requestId);assert.equal((seen?.p_report as typeof report).evaluation.mode,'demo_only');
});
test('Supabase outage never silently falls back to local data',async()=>{
 const store=new SupabaseStore('https://testproject.supabase.co','sb_secret_test',async()=>{throw new Error('private details');});
 await assert.rejects(store.queue(),e=>e instanceof Error&&e.message.includes('retry with the same request ID')&&!e.message.includes('private details'));
});
test('Supabase RPC revision conflicts become HTTP 409 without leaking response content',async()=>{
 const store=new SupabaseStore('https://testproject.supabase.co','sb_secret_test',async()=>Response.json({code:'40001',message:'private details'},{status:400}));
 await assert.rejects(store.transition(randomUUID(),'acknowledge',1),e=>e instanceof Error&&'code' in e&&e.code===409&&!e.message.includes('private details'));
});

test('explicit PostgREST PT409 conflicts retain HTTP 409',async()=>{
 const store=new SupabaseStore('https://testproject.supabase.co','sb_secret_test',async()=>Response.json({code:'PT409',message:'private details'},{status:409}));
 await assert.rejects(store.transition(randomUUID(),'resolve',1),e=>e instanceof Error&&'code' in e&&e.code===409&&!e.message.includes('private details'));
});
