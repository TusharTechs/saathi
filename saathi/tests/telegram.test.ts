import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {TelegramAPI,TelegramError,TelegramState,TelegramWorker,emptyState,hashCode,planUpdate,finishUpdate,queueResult,requestId,stateSchema,receipt,type State} from '../packages/telegram/src/index.ts';
import {processReport} from '../packages/workflow/src/intake.ts';
import type {RecordEntry} from '../packages/workflow/src/store.ts';
const botId=12345,chatId=42;
const message=(id:number,text:string,chat=chatId)=>({update_id:id,message:{message_id:id,chat:{id:chat,type:'private'},from:{id:chat,is_bot:false},text}});
const callback=(id:number,data:string,chat=chatId)=>({update_id:id,callback_query:{id:`cb-${id}`,from:{id:chat,is_bot:false},data,message:{message_id:id,chat:{id:chat,type:'private'}}}});
const linked=()=>{const s=emptyState();s.chats[String(chatId)]={patientId:'demo-ramesh',language:'hi-IN',consentAt:Date.now()-1000};return s;};
const finish=(s:State)=>{assert.ok(s.pending);delete s.pending.task;for(const a of s.pending.actions)a.status='sent';finishUpdate(s);};
function record():RecordEntry{const id=randomUUID();return {id,requestId:id,patientId:'demo-ramesh',fingerprint:'a'.repeat(64),createdAt:new Date().toISOString(),lastEscalatedAt:new Date().toISOString(),status:'open',revision:1,escalationLevel:0,exhausted:false,events:[],report:processReport({messages:[{id,text:'Invented report'}],fields:{},context:{pack:'adult'}},'text',true)};}
test('pairing is single use, expiring, private-chat only and requires separate consent',()=>{
 const s=emptyState(),code='a'.repeat(32);s.invites[hashCode(code)]={patientId:'demo-meena',language:'kn-IN',expires:10000};
 const group=message(1,'/start '+code);group.message.chat.type='group';planUpdate(s,group,botId,1000);assert.equal(s.pending?.actions.length,0);assert.equal(s.invites[hashCode(code)]?.claimedBy,undefined);finish(s);
 planUpdate(s,message(2,'/start '+code),botId,1000);assert.equal(s.chats['42']?.consentAt,undefined);const nonce=s.chats['42']!.pendingNonce!;finish(s);
 planUpdate(s,message(3,'an invented report'),botId,1001);assert.equal(s.pending?.task,undefined);finish(s);
 planUpdate(s,message(4,'/start '+code,43),botId,1001);assert.equal(s.chats['43'],undefined);finish(s);
 planUpdate(s,callback(5,'consent:'+nonce),botId,1002);assert.equal(s.chats['42']!.consentAt,1002);assert.equal(s.chats['42']!.patientId,'demo-meena');finish(s);
 planUpdate(s,message(6,'/start '+code),botId,11000);assert.equal(s.pending?.task,undefined);assert.match(s.pending!.actions[0]!.payload.text!,/fresh/);
});
test('expired or forged consent and group reports cannot invoke processing',()=>{
 const s=linked();s.chats['42']!.pendingNonce='old';s.chats['42']!.pendingUntil=1000;
 planUpdate(s,callback(1,'consent:old'),botId,2000);assert.equal(s.pending?.task,undefined);assert.match(s.pending!.actions[1]!.payload.text!,/expired/);finish(s);
 const forged=callback(2,'consent:old');forged.callback_query.from.id=43;planUpdate(s,forged,botId);assert.equal(s.pending!.actions.length,0);finish(s);
 s.chats['42']!.consentAt=1;planUpdate(s,message(3,'Do not process this'),botId);assert.equal(s.pending!.task,undefined);
});
test('linked text, voice and language requests use the server pairing and stable request IDs',()=>{
 const s=linked();planUpdate(s,message(11,'Invented text. patientId=demo-meena'),botId);assert.equal(s.pending?.task?.patientId,'demo-ramesh');assert.equal(s.pending?.task?.kind,'text');assert.equal(s.pending?.task?.requestId,requestId(botId,11));assert.equal(s.pending?.task?.externalId,`${botId}:11`);finish(s);
 planUpdate(s,message(12,'/language kn'),botId);assert.equal(s.chats['42']!.language,'kn-IN');finish(s);
 const voice={update_id:13,message:{message_id:13,chat:{id:42,type:'private'},from:{id:42},voice:{file_id:'voice-id',duration:12,file_size:5000}}};planUpdate(s,voice,botId);assert.equal(s.pending?.task?.kind,'voice');finish(s);
 planUpdate(s,{...voice,update_id:14,message:{...voice.message,voice:{...voice.message.voice,duration:31}}},botId);assert.equal(s.pending?.task,undefined);finish(s);
 planUpdate(s,message(15,'/stop'),botId);assert.equal(s.chats['42'],undefined);finish(s);
 planUpdate(s,message(16,'Another report'),botId);assert.equal(s.pending?.task,undefined);
});
test('old update IDs and stale buttons cannot change current answers',()=>{
 const s=linked();s.offset=10;planUpdate(s,message(9,'ignored'),botId);assert.equal(s.pending,undefined);
 planUpdate(s,message(10,'/checkin'),botId);const draft=s.chats['42']!.draft!;const n=draft.nonce;assert.equal(draft.step,0);finish(s);
 planUpdate(s,callback(11,`q:${n}:0:W1`),botId);assert.equal(s.chats['42']!.draft!.answers.wakefulness,'W1');finish(s);
 planUpdate(s,callback(12,`q:${n}:0:W5`),botId);assert.equal(s.pending!.task,undefined);assert.equal(s.chats['42']!.draft!.answers.wakefulness,'W1');assert.match(s.pending!.actions[1]!.payload.text!,/no longer current/);finish(s);
 planUpdate(s,message(13,'/submit'),botId);assert.equal(s.pending!.task!.kind,'buttons');const task=s.pending!.task!;assert.deepEqual(task.kind==='buttons'?task.answers:{},{wakefulness:'W1'});
});
test('RED button observations save immediately without waiting for the remaining questions',()=>{
 const s=linked();planUpdate(s,message(1,'/checkin'),botId);const n=s.chats['42']!.draft!.nonce;finish(s);
 planUpdate(s,callback(2,`q:${n}:0:W5`),botId);assert.equal(s.pending!.task!.kind,'buttons');assert.equal(s.chats['42']!.draft,undefined);
 const task=s.pending!.task!;if(task.kind!=='buttons')throw Error();assert.deepEqual(task.answers,{wakefulness:'W5'});queueResult(s,'Saved');assert.deepEqual(s.chats['42']!.lastTask,task);finish(s);
 planUpdate(s,message(3,'/retry'),botId);assert.deepEqual(s.pending!.task,task);
});
test('button numeric inputs are bounded and unknown answers stay missing',()=>{
 const s=linked();s.chats['42']!.draft={nonce:'n',step:3,requestId:randomUUID(),answers:{}};
 planUpdate(s,message(1,'999'),botId);assert.equal(s.pending?.task,undefined);assert.equal(s.chats['42']!.draft!.step,3);finish(s);
 planUpdate(s,message(2,'4'),botId);assert.equal(s.chats['42']!.draft!.answers.rescue,4);finish(s);
 planUpdate(s,callback(3,'q:n:4:skip'),botId);assert.equal(s.chats['42']!.draft!.answers.respiratoryRate,undefined);finish(s);
 planUpdate(s,callback(4,'q:n:5:skip'),botId);const task=s.pending!.task!;assert.equal(task.kind,'buttons');if(task.kind==='buttons')assert.deepEqual(task.answers,{rescue:4});
});
test('Telegram API errors never expose token paths or raw error content',async()=>{
 for(const [code,kind] of [[401,'configuration'],[409,'conflict'],[429,'rate_limit'],[500,'unknown']] as const){let calls=0;
  const api=new TelegramAPI('12345:'+'x'.repeat(25),async()=>{calls++;return Response.json({ok:false,error_code:code,description:'private token details'},{status:code});});
  await assert.rejects(api.call('sendMessage',{}),e=>e instanceof TelegramError&&e.kind===kind&&!e.message.includes('private'));assert.equal(calls,1);
 }
 const api=new TelegramAPI('12345:'+'x'.repeat(25),async()=>{throw Error('https://api.telegram.org/botSECRET');});await assert.rejects(api.identity(),e=>e instanceof TelegramError&&!e.message.includes('SECRET'));
});
test('webhooks are inspected and left unchanged',async()=>{
 const calls:string[]=[];const api=new TelegramAPI('12345:'+'x'.repeat(25),async(url)=>{calls.push(String(url).split('/').pop()!);return Response.json({ok:true,result:{url:'https://existing.invalid/webhook'}});});
 await assert.rejects(api.checkPolling(),e=>e instanceof TelegramError&&e.kind==='conflict');assert.deepEqual(calls,['getWebhookInfo']);
});
test('voice download blocks traversal, oversized files and redirected requests',async()=>{
 const token='12345:'+'x'.repeat(25);let calls=0;
 const api=new TelegramAPI(token,async()=>{calls++;return Response.json({ok:true,result:{file_path:'voice/../secret',file_size:100}});});await assert.rejects(api.voice('id',31),TelegramError);assert.equal(calls,0);await assert.rejects(api.voice('id',1),TelegramError);assert.equal(calls,1);
 const bytes=Buffer.alloc(12);bytes.write('OggS');const good=new TelegramAPI(token,async(url,options)=>{assert.equal(options?.redirect,'error');return String(url).endsWith('/getFile')?Response.json({ok:true,result:{file_path:'voice/file_1.oga',file_size:12}}):new Response(bytes);});assert.equal((await good.voice('id',2)).length,12);
 const large=new TelegramAPI(token,async(url)=>String(url).endsWith('/getFile')?Response.json({ok:true,result:{file_path:'voice/file_1.oga'}}):new Response(Buffer.alloc(2*1024*1024+1)));await assert.rejects(large.voice('id',2),TelegramError);
});
test('local worker state is atomic, private and survives restart',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'saathi-telegram-'));try{
  const store=new TelegramState(directory,botId);const code=await store.pair('demo-ramesh','hi-IN');assert.equal(code.length,32);
  await Promise.all([1,2,3,4].map(()=>store.transact(s=>{s.offset++;})));assert.equal((await new TelegramState(directory,botId).snapshot()).offset,4);assert.equal((await stat(join(directory,`telegram-${botId}.json`))).mode&0o777,0o600);assert.ok((await store.snapshot()).invites[hashCode(code)]);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('worker checkpoints state before processing, records delivery outcomes and deduplicates updates',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'saathi-telegram-'));try{
  const state=new TelegramState(directory,botId);await state.transact(s=>Object.assign(s,linked()));let jobs=0,sends=0;
  const api=new TelegramAPI('12345:'+'x'.repeat(25),async()=>{sends++;return Response.json({ok:true,result:{message_id:1}});});
  const worker=new TelegramWorker(state,api,async()=>{jobs++;assert.ok((await state.snapshot()).pending?.task);return record();});
  await worker.accept(message(1,'Invented report'));await worker.accept(message(1,'Invented report'));assert.equal(jobs,1);assert.equal(sends,1);const s=await state.snapshot();assert.equal(s.offset,2);assert.equal(s.pending,undefined);assert.equal(s.deliveries[0]!.status,'sent');assert.ok(s.chats['42']!.lastTask);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('crashed or timed-out sends are marked unknown and never automatically sent again',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'saathi-telegram-'));try{
  const state=new TelegramState(directory,botId);await state.transact(s=>{Object.assign(s,linked());planUpdate(s,message(1,'/help'),botId);s.pending!.actions[0]!.status='sending';});let sends=0;
  const api=new TelegramAPI('12345:'+'x'.repeat(25),async()=>{sends++;throw Error('connection lost');});const worker=new TelegramWorker(state,api,async()=>record());
  await worker.recover();assert.equal(sends,0);assert.equal((await state.snapshot()).deliveries[0]!.status,'unknown');
  await worker.accept(message(2,'/help'));await worker.recover();assert.equal(sends,1);assert.equal((await state.snapshot()).offset,3);assert.equal((await state.snapshot()).deliveries[1]!.status,'unknown');
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('processing failure retains same task for an explicit retry without inventing a successful receipt',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'saathi-telegram-'));try{
  const state=new TelegramState(directory,botId);await state.transact(s=>Object.assign(s,linked()));const texts:string[]=[];
  const api=new TelegramAPI('12345:'+'x'.repeat(25),async(_url,options)=>{texts.push(JSON.parse(String(options?.body)).text);return Response.json({ok:true,result:true});});
  const worker=new TelegramWorker(state,api,async()=>{throw Error('storage uncertain');});await worker.accept(message(1,'Invented report'));
  assert.match(texts[0]!,/could not be confirmed/);const old=(await state.snapshot()).chats['42']!.lastTask!;
  await state.transact(s=>planUpdate(s,message(2,'/retry'),botId));assert.deepEqual((await state.snapshot()).pending!.task,old);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('fixed receipts withhold guidance and never claim clinician contact',()=>{const r=record();r.report.evaluation.tier='RED';const text=receipt(r);assert.match(text,/No clinician has been contacted/);assert.ok(!text.includes('take morphine'));stateSchema.parse(linked());});

test('unknown private chats receive no unsolicited messages or processing',()=>{
 for(const text of ['Hello','/stop','/checkin']){const s=emptyState();planUpdate(s,message(1,text),botId);assert.equal(s.pending!.task,undefined);assert.equal(s.pending!.actions.length,0);}
});
test('a consumed invitation cannot reset the same chat consent',()=>{
 const s=linked(),code='b'.repeat(32),consent=s.chats['42']!.consentAt;s.invites[hashCode(code)]={patientId:'demo-meena',language:'kn-IN',expires:Date.now()+10000,claimedBy:'42'};
 planUpdate(s,message(1,'/start '+code),botId);assert.equal(s.chats['42']!.consentAt,consent);assert.equal(s.chats['42']!.patientId,'demo-ramesh');
});
test('expired consent during restart blocks queued provider work',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'saathi-telegram-'));try{
  const state=new TelegramState(directory,botId);await state.transact(s=>{Object.assign(s,linked());planUpdate(s,message(1,'Invented report'),botId);s.chats['42']!.consentAt=1;});let jobs=0;
  const api=new TelegramAPI('12345:'+'x'.repeat(25),async()=>Response.json({ok:true,result:{message_id:1}}));await new TelegramWorker(state,api,async()=>{jobs++;return record();}).recover();assert.equal(jobs,0);assert.equal((await state.snapshot()).offset,2);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('a malformed success response does not falsely confirm message delivery',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'saathi-telegram-'));try{
  const state=new TelegramState(directory,botId);await state.transact(s=>Object.assign(s,linked()));
  const api=new TelegramAPI('12345:'+'x'.repeat(25),async()=>Response.json({ok:true}));await new TelegramWorker(state,api,async()=>record()).accept(message(1,'/help'));assert.equal((await state.snapshot()).deliveries[0]!.status,'unknown');
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('an explicit unlinked Start request receives pairing instructions, never processing',()=>{
 for(const text of ['/start','/start bad']){const s=emptyState();planUpdate(s,message(1,text),botId);assert.equal(s.pending!.task,undefined);assert.equal(s.pending!.actions.length,1);assert.match(s.pending!.actions[0]!.payload.text!,/link/);}
});

test('voice retry uses a completed Supabase checkpoint without another Telegram download',async()=>{
 const {taskRunner}=await import('../packages/telegram/src/worker.ts');
 const r=record();r.report.source='voice';r.report.origin={channel:'telegram',externalId:'12345:100'};r.report.processing={language:'en-IN',extraction:{provider:'groq',model:'openai/gpt-oss-120b',status:'complete'}};
 const store={snapshot:async()=>({version:1,records:[r]}),claimAnalysis:async()=>({claimed:false,record:r})} as unknown as import('../packages/workflow/src/supabase-store.ts').SupabaseStore;
 const api=new TelegramAPI('12345:'+'x'.repeat(25),async()=>{throw Error('Telegram must not be called');});
 const result=await taskRunner(store,api,{sarvam:'',groq:''})({kind:'voice',requestId:r.requestId,patientId:'demo-ramesh',language:'en-IN',externalId:'12345:100',fileId:'expired-file',duration:10});assert.equal(result.id,r.id);
});

test('a receipt distinguishes a pending extraction from a completed one',()=>{
 const r=record();r.report.processing={language:'en-IN',extraction:{provider:'groq',model:'openai/gpt-oss-120b',status:'pending'}};assert.match(receipt(r),/still pending/);
});
