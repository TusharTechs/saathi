import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {webhook} from '../supabase/functions/whatsapp-webhook/handler.ts';
import {TelegramState} from '../packages/telegram/src/state.ts';
import {WhatsAppAPI,WhatsAppStore,WhatsAppWorker,runWhatsAppTask,channelNumber} from '../packages/whatsapp/src/index.ts';
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
  for(const file of ['supabase/migrations/202610230001_core.sql','supabase/migrations/202610230002_function_permissions.sql','supabase/seed/demo.sql','supabase/migrations/202610230003_demo_storage.sql','supabase/migrations/202610230004_conflict_responses.sql','supabase/migrations/202610230005_narrative_analysis.sql','supabase/migrations/202610230006_telegram_origin.sql','supabase/migrations/202610230007_whatsapp_intake.sql','supabase/migrations/202611030008_whatsapp_oncall.sql','supabase/migrations/202611030009_teleconsult.sql','supabase/migrations/202611040010_accounts_and_cloud_worker.sql','supabase/migrations/202611040011_login_expected_phone.sql','supabase/migrations/202611040012_prescriptions_assignments_updates.sql','supabase/migrations/202611040013_clinical_review_form.sql','supabase/migrations/202611070014_staff_type.sql']) await db.exec(await readFile(new URL(file,root),'utf8'));
  await t.test('anonymous and authenticated roles cannot call any service-only RPC',async()=>{
   for(const role of ['anon','authenticated']){
    await db.exec(`set role ${role}`);
    for(const sql of ['select public.saathi_demo_queue()','select public.saathi_demo_tick()',`select public.saathi_demo_record('${randomUUID()}')`])await assert.rejects(db.query(sql),/permission denied/);
    await db.exec('reset role');
   }
   const r=await db.query<{allowed:boolean}>("select bool_or(has_function_privilege('anon',oid,'EXECUTE') or has_function_privilege('authenticated',oid,'EXECUTE')) as allowed from pg_proc where proname like 'saathi_demo_%' or proname='saathi_telegram_submit' or proname like 'saathi_wa_%'");assert.equal(r.rows[0]!.allowed,false);
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
  await t.test('teleconsult: calls close only after acknowledgement with notes; care plans, doses and fees persist',async()=>{
   const fresh=(await submit(randomUUID(),'f'.repeat(64))).record;
   await assert.rejects(rpc('select public.saathi_demo_close($1,$2,$3,$4) as data',[fresh.id,fresh.revision,'Spoke to family','']),/Acknowledge the report/);
   const ack=await rpc<RecordEntry>('select public.saathi_demo_transition($1,$2,$3) as data',[fresh.id,'acknowledge',fresh.revision]);
   await assert.rejects(rpc('select public.saathi_demo_close($1,$2,$3,$4) as data',[fresh.id,ack.revision,'  ','']),/Call notes are required/);
   const closed=await rpc<RecordEntry>('select public.saathi_demo_close($1,$2,$3,$4) as data',[fresh.id,ack.revision,'Invented call: family advised','Go to nearest hospital']);
   assert.equal(closed.status,'resolved');assert.match(closed.events.find(e=>e.type==='resolved')!.details,/Call notes: Invented call: family advised Advice given: Go to nearest hospital/);
   const plan={hospitalId:'KMC-DEMO-0001',medications:[{key:'morphine_oral',name:'Invented medicine'}]};
   const saved=await rpc<{plan:typeof plan}>('select public.saathi_demo_checkin($1,$2::jsonb) as data',['demo-ramesh',JSON.stringify(plan)]);assert.deepEqual(saved.plan,plan);
   assert.deepEqual((await rpc<Record<string,{plan:unknown}>>('select public.saathi_demo_care_plans() as data'))['demo-ramesh']!.plan,plan);
   await assert.rejects(rpc('select public.saathi_demo_checkin($1,$2::jsonb) as data',['demo-nobody','{}']),/Synthetic patient not found/);
   const today=new Date().toISOString().slice(0,10);
   await rpc('select public.saathi_demo_log_dose($1,$2,$3::date,$4,$5,$6) as data',['demo-ramesh','morphine_oral',today,'morning','not_given','whatsapp']);
   await rpc('select public.saathi_demo_log_dose($1,$2,$3::date,$4,$5,$6) as data',['demo-ramesh','morphine_oral',today,'morning','given','whatsapp']);
   const doses=await rpc<{status:string}[]>('select public.saathi_demo_dose_logs($1) as data',['demo-ramesh']);assert.equal(doses.length,1);assert.equal(doses[0]!.status,'given');
   await assert.rejects(rpc('select public.saathi_demo_log_dose($1,$2,$3::date,$4,$5,$6) as data',['demo-ramesh','x','2000-01-01','morning','given','web']),/out of range/);
   await rpc('select public.saathi_demo_set_fee($1,$2) as data',[fresh.id,'paid']);assert.equal((await rpc<Record<string,string>>('select public.saathi_demo_fees() as data'))[fresh.id],'paid');
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
  await t.test('narrative pipeline keeps the care-plan pain baseline through the database lease, so pain 7 is AMBER',async()=>{
   const {NarrativePipeline}=await import('../packages/extraction/src/pipeline.ts');const {extract,extractionJSONSchema}=await import('../packages/extraction/src/index.ts');const {demoCase}=await import('../packages/workflow/src/demo-case.ts');
   const transport:typeof fetch=async(url,options)=>{
    const name=String(url).split('/').pop()!;const entries=Object.entries(JSON.parse(String(options?.body)) as Record<string,unknown>);
    return Response.json(await rpc(`select public.${name}(${entries.map(([key],i)=>`${key}=>$${i+1}`).join(',')}) as data`,entries.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v)));
   };
   const store=new SupabaseStore('https://example.supabase.co','sb_secret_test',transport);await store.checkin('demo-ramesh',demoCase());
   const said='His pain is 7 out of 10 even after his medicines.',blank=Object.fromEntries(Object.keys(extractionJSONSchema.properties).map(k=>[k,null]));
   const content=JSON.stringify({...blank,pain_now:{value:7,confidence:0.97,quote:'pain is 7 out of 10'},pain_despite_medicines:{value:true,confidence:0.92,quote:'even after his medicines'}});
   const p=new NarrativePipeline(store,{sarvam:'',groq:'test'},{speech:async()=>{throw Error('unused');},extract:(t,id)=>extract(t,id,'test',async()=>Response.json({choices:[{finish_reason:'stop',message:{content}}]}))});
   const r=await p.text({requestId:randomUUID(),patientId:'demo-ramesh',language:'en-IN',synthetic:true,text:said});
   assert.equal(r.record.report.processing?.extraction.status,'complete');assert.equal(r.record.report.input.context.usual_pain_score,3);
   assert.equal(r.record.report.evaluation.tier,'AMBER');assert.ok(r.record.report.evaluation.matched.includes('A2'));
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
  await t.test('Telegram provenance, channel and external message ID persist atomically and cannot change',async()=>{
   const request=randomUUID(),origin={channel:'telegram',externalId:'12345:11'};
   const input={messages:[{id:request,text:'A synthetic report.'}],fields:{},context:{pack:'adult' as const}};
   const pending={...processReport(input,'text',true),origin,processing:{language:'en-IN',extraction:{provider:'groq',model:'openai/gpt-oss-120b',status:'pending'}}};
   const call=(p:unknown=pending)=>rpc<{record:RecordEntry;duplicate:boolean}>('select public.saathi_telegram_submit($1,$2,$3,$4::jsonb,$5::jsonb) as data',[request,'demo-ramesh',fingerprint,JSON.stringify(p),JSON.stringify(adultProtocol)]);
   const saved=await call();assert.deepEqual(saved.record.report.origin,origin);assert.equal((await call()).duplicate,true);
   const m=await db.query<{channel:string;external_id:string}>("select channel,external_id from public.messages where external_id='12345:11'");assert.deepEqual(m.rows,[{channel:'telegram',external_id:'12345:11'}]);
   await assert.rejects(call({...pending,origin:{...origin,externalId:'12345:12'}}),/origin conflict/);
   await assert.rejects(call({...pending,origin:{channel:'local',externalId:'12345:11'}}),/Invalid Telegram/);
   const before=(await db.query<{n:number}>('select count(*)::int as n from public.alerts')).rows[0]!.n;
   await assert.rejects(rpc('select public.saathi_telegram_submit($1,$2,$3,$4::jsonb,$5::jsonb) as data',[randomUUID(),'demo-ramesh',fingerprint,JSON.stringify(pending),JSON.stringify(adultProtocol)]),/unique constraint/);
   assert.equal((await db.query<{n:number}>('select count(*)::int as n from public.alerts')).rows[0]!.n,before);
   const c=await rpc<{lease:string}>('select public.saathi_demo_claim_analysis($1) as data',[saved.record.id]);
   const complete={...pending,processing:{...pending.processing,extraction:{...pending.processing.extraction,status:'complete'}}};
   await assert.rejects(rpc('select public.saathi_demo_complete_analysis($1,$2,$3::jsonb) as data',[saved.record.id,c.lease,JSON.stringify({...complete,origin:{...origin,externalId:'12345:12'}})]),/Invalid analysis/);
   const done=await rpc<RecordEntry>('select public.saathi_demo_complete_analysis($1,$2,$3::jsonb) as data',[saved.record.id,c.lease,JSON.stringify(complete)]);assert.deepEqual(done.report.origin,origin);assert.equal(done.report.evaluation.tier,null);
  });
  await t.test('WhatsApp inbox requires pairing/consent, deduplicates and erases processed raw payloads',async()=>{
   const phone='123456789',sender='919876543210',stamp=Math.floor(Date.now()/1000);
   const m={id:'wamid.ONE',from:sender,timestamp:stamp,kind:'text',text:'Invented report'};
   const enqueue=(messages:unknown[])=>rpc<{accepted:number}>('select public.saathi_wa_enqueue($1,$2::jsonb) as data',[phone,JSON.stringify(messages)]);
   assert.equal((await enqueue([m])).accepted,0);
   assert.equal((await enqueue([{...m,id:'wamid.START',text:'/start '+'a'.repeat(32)}])).accepted,1);
   await rpc("select public.saathi_wa_binding($1,$2,false,now()+interval '15 minutes') as data",[phone,sender]);
   assert.equal((await enqueue([m])).accepted,0);assert.equal((await enqueue([{id:'wamid.UNCONSENTED_VOICE',from:sender,timestamp:stamp,kind:'voice',mediaId:'123'}])).accepted,0);
   assert.equal((await enqueue([{...m,id:'wamid.CONSENT',kind:'button',buttonId:'consent:n'}])).accepted,1);
   await rpc("select public.saathi_wa_binding($1,$2,true,now()+interval '24 hours') as data",[phone,sender]);
   assert.equal((await enqueue([m,{...m,id:'wamid.OTHER',from:'919999999999'}])).accepted,1);assert.equal((await enqueue([m])).accepted,0);
   assert.equal((await enqueue([{...m,id:'wamid.OLD',timestamp:stamp-86401},{...m,id:'wamid.FUTURE',timestamp:stamp+600}])).accepted,0);
   const first=await rpc<{id:number;message:unknown}>('select public.saathi_wa_next($1,0) as data',[phone]);assert.ok(first.id>0);
   await rpc('select public.saathi_wa_complete($1,9999999) as data',[phone]);assert.equal(await rpc('select public.saathi_wa_next($1,0) as data',[phone]),null);
   await rpc('select public.saathi_wa_binding($1,$2,false,null) as data',[phone,sender]);assert.equal((await enqueue([{...m,id:'wamid.STOPPED'}])).accepted,0);
   // On-call phones are unpaired: only on-call commands and well-formed Acknowledge taps are retained.
   const doctor={...m,from:'918888888888'};
   assert.equal((await enqueue([{...doctor,id:'wamid.ONCALL',text:'/oncall '+'b'.repeat(32)},{...doctor,id:'wamid.RENEW',text:'/oncall'},{...doctor,id:'wamid.OFF',text:'/offcall'},{...doctor,id:'wamid.ACK',kind:'button',buttonId:'ack:'+randomUUID()}])).accepted,4);
   assert.equal((await enqueue([{...doctor,id:'wamid.DOCTOR_TEXT',text:'Invented report'},{...doctor,id:'wamid.BAD_ACK',kind:'button',buttonId:'ack:not-a-report'},{...doctor,id:'wamid.ONCALL_EXTRA',text:'/oncall now please'}])).accepted,0);
  });
  await t.test('WhatsApp report provenance reaches the shared message/check-in transaction',async()=>{
   const request=randomUUID(),origin={channel:'whatsapp',externalId:'wamid.SYNTHETIC'};
   const r={...processReport(buttonInput({requestId:request,patientId:'demo-ramesh',answers:{wakefulness:'W4'}},{pack:'adult'}),'buttons'),origin};
   const saved=await rpc<{record:RecordEntry}>('select public.saathi_wa_submit($1,$2,$3,$4::jsonb,$5::jsonb) as data',[request,'demo-ramesh',fingerprint,JSON.stringify(r),JSON.stringify(adultProtocol)]);assert.deepEqual(saved.record.report.origin,origin);assert.equal(saved.record.report.evaluation.tier,'RED');
   const rows=await db.query<{channel:string}>("select channel from public.messages where external_id='wamid.SYNTHETIC'");assert.equal(rows.rows[0]!.channel,'whatsapp');
  });
  await t.test('signed webhook through consent, live inbox worker and button protocol persists one WhatsApp report',async()=>{
   const phone='222222222',sender='919111222333',secret='e'.repeat(32),directory=await mkdtemp(join(tmpdir(),'saathi-wa-e2e-'));
   try{
    const transport:typeof fetch=async(url,options)=>{
     const name=String(url).split('/').pop()!;assert.match(name,/^saathi_[a-z_]+$/);const args=JSON.parse(String(options?.body)) as Record<string,unknown>;const entries=Object.entries(args);for(const [key] of entries)assert.match(key,/^[a-z_]+$/);
     const sql=`select public.${name}(${entries.map(([key],i)=>`${key}=>$${i+1}`).join(',')}) as data`;
     return Response.json(await rpc(sql,entries.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v)));
    };
    const store=new WhatsAppStore('https://example.supabase.co','sb_secret_test',transport),state=new TelegramState(directory,channelNumber(phone),'whatsapp');let apiCalls=0;
    const api=new WhatsAppAPI(phone,'fake','v26.0',async(url)=>{assert.ok(String(url).endsWith(`/${phone}/messages`));apiCalls++;return Response.json({messages:[{id:'wamid.RECEIPT'+apiCalls}]});});
    const worker=new WhatsAppWorker(state,store,api,runWhatsAppTask(store,api,{sarvam:'',groq:''}));
    const handler=webhook({appSecret:secret,verifyToken:'v'.repeat(64),phoneId:phone},messages=>rpc('select public.saathi_wa_enqueue($1,$2::jsonb) as data',[phone,JSON.stringify(messages)]));let step=0;
    const receive=async(kind:'text'|'button',value:string)=>{
     step++;const m={id:'wamid.E2E'+step,from:sender,timestamp:String(Math.floor(Date.now()/1000)),type:kind==='text'?'text':'interactive',...(kind==='text'?{text:{body:value}}:{interactive:{type:'button_reply',button_reply:{id:value}}})};
     const body=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:phone},messages:[m]}}]}]});
     const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',secret).update(body).digest('hex')},body}));assert.equal(response.status,200);assert.equal(await worker.once(),true);
    };
    const code=await state.pair('demo-ramesh','en-IN');await receive('text','/start '+code);const consent=(await state.snapshot()).chats[sender]!.pendingNonce!;await receive('button','consent:'+consent);await receive('text','/checkin');const n=(await state.snapshot()).chats[sender]!.draft!.nonce;
    await receive('button',`q:${n}:0:W1`);await receive('button',`q:${n}:1:normal`);await receive('text','2');await receive('text','4');await receive('text','12');await receive('button',`q:${n}:5:yes`);
    const report=(await store.queue()).records.find(r=>r.report.origin?.externalId==='wamid.E2E9');assert.ok(report);assert.equal(report.report.origin?.channel,'whatsapp');assert.equal(report.report.evaluation.tier,'RED');assert.ok(report.report.evaluation.matched.includes('R3'));assert.ok(report.report.evaluation.matched.includes('A1'));
    assert.equal((await state.snapshot()).deliveries.length,apiCalls);assert.ok((await state.snapshot()).deliveries.every(d=>d.status==='accepted'));
    const pending=await db.query<{n:number}>("select count(*)::int as n from public.wa_demo_inbox where phone_id=$1 and payload is not null",[phone]);assert.equal(pending.rows[0]!.n,0);
    assert.equal(await worker.once(),false);
   }finally{await rm(directory,{recursive:true,force:true});}
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
  await t.test('accounts, WhatsApp login challenges, worker state, leases and named actors',async()=>{
   const acct=await rpc<{id:string;role:string}>("select public.saathi_account_create('family','Asha','Son@Example.com',null,'scrypt$a$b','demo-ramesh','demo-org') as data");assert.equal(acct.role,'family');
   const found=await rpc<{id:string;email:string;patientKey:string}>("select public.saathi_account_find('son@example.com',null) as data");assert.equal(found.id,acct.id);assert.equal(found.patientKey,'demo-ramesh');
   await assert.rejects(db.query("select public.saathi_account_create('medical','Dup','son@example.com',null,'scrypt$a$b',null,'demo-org')"),/duplicate key|unique/);
   await assert.rejects(db.query("select public.saathi_account_create('medical','NoPw','x@y.in',null,null,null,'demo-org')"),/check constraint/);
   await assert.rejects(db.query("select public.saathi_account_create('family','Ghost',null,'919800000000',null,'not-a-patient','demo-org')"),/not found/);
   const challenge=await rpc<string>("select public.saathi_login_challenge('482913',600,'919845012345') as data");
   assert.equal(await rpc<number>(`select public.saathi_wa_login('[{"kind":"text","from":"919800000009","text":"LOGIN 482913"}]'::jsonb) as data`),0,'a code sent from another number does not verify');
   assert.equal((await rpc<{mismatch:boolean}>(`select public.saathi_login_status('${challenge}') as data`)).mismatch,true);
   assert.equal((await rpc<{verified:boolean}>(`select public.saathi_login_status('${challenge}') as data`)).verified,false);
   assert.equal(await rpc<number>(`select public.saathi_wa_login('[{"kind":"text","from":"919845012345","text":"login 000000"},{"kind":"text","from":"919845012345","text":" LOGIN 482913 "}]'::jsonb) as data`),1);
   assert.equal(await rpc<number>(`select public.saathi_wa_login('[{"kind":"text","from":"919800000001","text":"LOGIN 482913"}]'::jsonb) as data`),0,'a verified code cannot be taken over');
   const status=await rpc<{verified:boolean;phone:string}>(`select public.saathi_login_status('${challenge}') as data`);assert.equal(status.phone,'919845012345');
   assert.equal(await rpc<string>(`select public.saathi_login_consume('${challenge}') as data`),'919845012345');
   assert.equal(await rpc<string|null>(`select public.saathi_login_consume('${challenge}') as data`),null,'a challenge signs in once');
   assert.equal(await rpc<boolean>(`select public.saathi_worker_put('wa:state','{"n":1}'::jsonb,0) as data`),true);
   assert.equal(await rpc<boolean>(`select public.saathi_worker_put('wa:state','{"n":2}'::jsonb,0) as data`),false);
   const doc=await rpc<{doc:{n:number};version:number}>("select public.saathi_worker_get('wa:state') as data");assert.equal(doc.version,1);
   assert.equal(await rpc<boolean>(`select public.saathi_worker_put('wa:state','{"n":2}'::jsonb,1) as data`),true);
   assert.equal(await rpc<boolean>(`select public.saathi_worker_put('wa:state','{"n":3}'::jsonb,1) as data`),false,'a stale writer is refused');
   const a=randomUUID(),b=randomUUID();
   assert.equal(await rpc<boolean>(`select public.saathi_worker_acquire('wa','${a}',60) as data`),true);
   assert.equal(await rpc<boolean>(`select public.saathi_worker_acquire('wa','${b}',60) as data`),false);
   await db.query(`select public.saathi_worker_release('wa','${a}')`);
   assert.equal(await rpc<boolean>(`select public.saathi_worker_acquire('wa','${b}',60) as data`),true);
   const fresh=(await submit(randomUUID(),createHash('sha256').update('named-actor').digest('hex'))).record;
   const acked=await rpc<RecordEntry>(`select public.saathi_demo_transition_as('${fresh.id}','acknowledge',1,'Dr. Judge') as data`);
   assert.equal(acked.events.at(-1)!.actor,'Dr. Judge');
   const closed=await rpc<RecordEntry>(`select public.saathi_demo_close_as('${fresh.id}',2,'Spoke to the son','Go to hospital','Dr. Judge') as data`);
   assert.equal(closed.status,'resolved');assert.match(closed.events.at(-1)!.details,/Call completed by Dr\. Judge/);
  });
  await t.test('assignments, family updates and prescriptions',async()=>{
   const rec=(await submit(randomUUID(),createHash('sha256').update('assign-me').digest('hex'))).record;
   await db.query(`select public.saathi_demo_assign('${rec.id}','nurse','Coordinator A')`);
   await db.query(`select public.saathi_demo_assign('${rec.id}','psychologist','Coordinator B')`);
   const map=await rpc<Record<string,{assignee:string;by:string}>>('select public.saathi_demo_assignments() as data');assert.equal(map[rec.id]!.assignee,'psychologist');assert.equal(map[rec.id]!.by,'Coordinator B');
   await assert.rejects(db.query(`select public.saathi_demo_assign('${rec.id}','surgeon','X')`),/check constraint/);
   await db.query(`select public.saathi_demo_care_event('demo-ramesh','pain',6,null,'web')`);
   await db.query(`select public.saathi_demo_care_event('demo-ramesh','discharged',null,'District hospital','web')`);
   await assert.rejects(db.query(`select public.saathi_demo_care_event('demo-ramesh','pain',11,null,'web')`),/check constraint/);
   await assert.rejects(db.query(`select public.saathi_demo_care_event('demo-ramesh','pain',null,null,'web')`),/check constraint/);
   const ev=await rpc<{kind:string;value:number|null}[]>(`select public.saathi_demo_care_events('demo-ramesh') as data`);assert.deepEqual(ev.map(e=>[e.kind,e.value]),[['pain',6],['discharged',null]]);
   const id=randomUUID(),sig='a'.repeat(43);
   await db.query(`select public.saathi_demo_prescribe('demo-ramesh','${rec.id}','Dr. Judge','KMC-1','[{"medicine":"Ondansetron","dose":"4 mg","frequency":"BD","days":3,"instructions":""}]'::jsonb,null,'${sig}','${id}',now())`);
   const rx=await rpc<{id:string;items:unknown[]}[]>(`select public.saathi_demo_prescriptions('demo-ramesh') as data`);assert.equal(rx[0]!.id,id);
   await assert.rejects(db.query(`select public.saathi_demo_prescribe('demo-meena','${rec.id}','Dr. Judge','KMC-1','[{"medicine":"X"}]'::jsonb,null,'${sig}','${randomUUID()}',now())`),/does not belong/);
   await assert.rejects(db.query(`select public.saathi_demo_prescribe('demo-ramesh',null,'Dr. Judge','KMC-1','[]'::jsonb,null,'${sig}','${randomUUID()}',now())`),/check constraint/);
  });
  await t.test('clinical review form autosaves and keeps every submission',async()=>{
   await db.query(`select public.saathi_review_save('clinical-lead','Dr. K','{"A1":{"choice":"Approve"}}'::jsonb,false)`);
   let cur=await rpc<{answers:Record<string,unknown>;submittedAt:string|null}>(`select public.saathi_review_get('clinical-lead') as data`);assert.equal(cur.submittedAt,null);
   await db.query(`select public.saathi_review_save('clinical-lead','Dr. K','{"A1":{"choice":"Approve"},"D2":{"choice":"Yes, AMBER","details":"13-15"}}'::jsonb,true)`);
   await db.query(`select public.saathi_review_save('clinical-lead','Dr. K','{"A1":{"choice":"Change (write below)"}}'::jsonb,false)`);
   cur=await rpc(`select public.saathi_review_get('clinical-lead') as data`);assert.ok(cur.submittedAt);assert.deepEqual(Object.keys(cur.answers),['A1']);
   const all=await rpc<{submissions:unknown[]}>('select public.saathi_review_all() as data');assert.equal(all.submissions.length,1,'drafts are not submissions');
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
test('button reports carry the usual pain score and morphine status from the care plan',async()=>{
 const {demoCase}=await import('../packages/workflow/src/demo-case.ts');const {planContext}=await import('../packages/workflow/src/care-plan.ts');
 assert.deepEqual(planContext(demoCase()),{pack:'adult',usual_pain_score:3,on_morphine:true});assert.deepEqual(planContext(),{pack:'adult'});
 let sent:typeof report|undefined;
 const transport:typeof fetch=async(url,options)=>{
  const name=String(url).split('/').pop();
  if(name==='saathi_demo_care_plans')return Response.json({'demo-ramesh':{plan:demoCase(),checkedInAt:'2026-11-07T10:00:00+00:00'}});
  sent=JSON.parse(String(options?.body)).p_report;
  return Response.json({record:{id:randomUUID(),patientId:'demo-ramesh',requestId,fingerprint,createdAt:'2026-11-07T10:00:00+00:00',status:'open',revision:1,escalationLevel:0,lastEscalatedAt:'2026-11-07T10:00:00+00:00',exhausted:false,report:sent,events:[]},duplicate:false});
 };
 await new SupabaseStore('https://testproject.supabase.co','sb_secret_test',transport).submit({requestId:randomUUID(),patientId:'demo-ramesh',answers:{pain:7}});
 assert.equal(sent?.input.context.usual_pain_score,3);assert.equal(sent?.evaluation.tier,'AMBER');assert.ok(sent?.evaluation.matched.includes('A2'));
 // A failed care-plan lookup must not block the report; the baseline simply stays unknown.
 const down:typeof fetch=async(url,options)=>String(url).endsWith('saathi_demo_care_plans')?Response.json({},{status:500}):transport(url,options);
 await new SupabaseStore('https://testproject.supabase.co','sb_secret_test',down).submit({requestId:randomUUID(),patientId:'demo-ramesh',answers:{pain:7}});
 assert.deepEqual(sent?.input.context,{pack:'adult'});assert.ok(!sent?.evaluation.matched.includes('A2'));
});
