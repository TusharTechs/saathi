import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {webhook,normalize} from '../supabase/functions/whatsapp-webhook/handler.ts';
import {WhatsAppAPI,WhatsAppError,planWhatsApp,channelNumber,WhatsAppWorker,type WhatsAppStore} from '../packages/whatsapp/src/index.ts';
import {TelegramState,emptyState,hashCode,type Action} from '../packages/telegram/src/state.ts';
const phone='1234567890',sender='919876543210',secret='s'.repeat(32),verify='v'.repeat(64),now=()=>Math.floor(Date.now()/1000);
const envelope=(messages:unknown[],phoneId=phone)=>({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:phoneId},messages}}]}]});
const msg=(id='wamid.TEST',text='Invented text')=>({id,from:sender,timestamp:String(now()),type:'text',text:{body:text}});
const signed=(body:string)=>new Request('https://example.invalid/webhook',{method:'POST',headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',secret).update(body).digest('hex')},body});
const action=(buttons=0):Action=>({method:'sendMessage',status:'pending',payload:{chat_id:Number(sender),text:'Synthetic test only',...(buttons?{reply_markup:{inline_keyboard:[Array.from({length:buttons},(_,i)=>({text:'Choice '+i,callback_data:'q:n:2:'+i}))]}}:{})}});
test('webhook verification uses the separate verification token and returns plaintext challenge',async()=>{
 const handler=webhook({appSecret:secret,verifyToken:verify,phoneId:phone},async()=>{throw Error('must not enqueue');});
 const r=await handler(new Request(`https://example.invalid/?hub.mode=subscribe&hub.verify_token=${verify}&hub.challenge=12345`));assert.equal(r.status,200);assert.equal(await r.text(),'12345');
 assert.equal((await handler(new Request('https://example.invalid/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345'))).status,403);
 assert.equal((await webhook({appSecret:'',verifyToken:verify,phoneId:phone},async()=>{})(signed('{}'))).status,503);
});
test('raw-byte signatures are verified before JSON parsing or durable writes',async()=>{
 let calls=0;const handler=webhook({appSecret:secret,verifyToken:verify,phoneId:phone},async messages=>{calls++;assert.equal(messages[0]?.text,'काल्पनिक परीक्षण');});
 const body=JSON.stringify(envelope([msg('wamid.UNICODE','काल्पनिक परीक्षण')]));assert.equal((await handler(signed(body))).status,200);assert.equal(calls,1);
 const altered=signed(body);const header=altered.headers.get('x-hub-signature-256')!;
 assert.equal((await handler(new Request('https://example.invalid',{method:'POST',headers:{'x-hub-signature-256':header},body:body+' '}))).status,403);
 assert.equal((await handler(new Request('https://example.invalid',{method:'POST',body:'not json'}))).status,403);assert.equal(calls,1);
 assert.equal((await handler(signed('not json'))).status,400);
});
test('webhook waits for durability, rejects large payloads, and ignores other phone numbers and status callbacks',async()=>{
 let calls=0;const handler=webhook({appSecret:secret,verifyToken:verify,phoneId:phone},async()=>{calls++;throw Error('private storage detail');});
 assert.equal((await handler(signed(JSON.stringify(envelope([msg()]))))).status,503);
 assert.equal((await handler(signed(JSON.stringify(envelope([msg()],'999'))))).status,200);assert.equal(calls,1);
 const status=envelope([]);assert.equal((await handler(signed(JSON.stringify(status)))).status,200);
 assert.equal((await handler(signed('x'.repeat(262145)))).status,413);assert.equal(calls,1);
});
test('normalization accepts text, audio and known interactive replies, without copying contacts or profile data',()=>{
 const payload=envelope([msg(),{...msg('wamid.AUDIO'),type:'audio',audio:{id:'777'}},{...msg('wamid.BUTTON'),type:'interactive',interactive:{type:'button_reply',button_reply:{id:'consent:n',title:'untrusted'}}},{...msg('wamid.PHOTO'),type:'image',image:{id:'9'}}]);
 const messages=normalize(payload,phone);assert.deepEqual(messages.map(m=>m.kind),['text','voice','button']);assert.equal(messages[1]?.mediaId,'777');assert.equal(messages[2]?.buttonId,'consent:n');assert.equal('title' in messages[2]!,false);
});
test('WhatsApp preserves the common pairing, consent and button semantics with WhatsApp-specific provenance',()=>{
 const s=emptyState(),code='a'.repeat(32);s.invites[hashCode(code)]={patientId:'demo-ramesh',language:'en-IN',expires:Date.now()+10000};
 const incoming=(id:string,text:string)=>({id,from:sender,timestamp:now(),kind:'text' as const,text});
 planWhatsApp(s,1,incoming('wamid.START','/start '+code),phone);const nonce=s.chats[sender]!.pendingNonce!;assert.match(s.pending!.actions[0]!.payload.text!,/through WhatsApp/);assert.equal(s.pending!.receivedAt,now()*1000);delete s.pending;
 planWhatsApp(s,2,{id:'wamid.CONSENT',from:sender,timestamp:now(),kind:'button',buttonId:'consent:'+nonce},phone);assert.ok(s.chats[sender]!.consentAt);assert.equal(s.pending!.actions.length,1);delete s.pending;
 planWhatsApp(s,3,incoming('wamid.TEXT','Invented report'),phone);const task=s.pending!.task!;assert.equal(task.externalId,'wamid.TEXT');assert.equal(task.patientId,'demo-ramesh');delete s.pending;
 const other=structuredClone(s);planWhatsApp(s,4,incoming('wamid.TEXT','Invented report'),phone);planWhatsApp(other,400,incoming('wamid.TEXT','Invented report'),phone);assert.equal(s.pending!.task!.requestId,other.pending!.task!.requestId);
});
test('voice without a fabricated duration can reach STT, and numeric pain /skip follow the draft',()=>{
 const s=emptyState();s.chats[sender]={patientId:'demo-ramesh',language:'en-IN',consentAt:Date.now()};
 planWhatsApp(s,1,{id:'wamid.VOICE',from:sender,timestamp:now(),kind:'voice',mediaId:'789'},phone);assert.equal(s.pending!.task?.kind,'voice');delete s.pending;
 s.chats[sender]!.draft={nonce:'n',step:2,answers:{},requestId:randomUUID()};
 planWhatsApp(s,2,{id:'wamid.PAIN',from:sender,timestamp:now(),kind:'text',text:'7'},phone);assert.equal(s.chats[sender]!.draft!.answers.pain,7);delete s.pending;
 planWhatsApp(s,3,{id:'wamid.SKIP',from:sender,timestamp:now(),kind:'text',text:'/skip'},phone);assert.equal(s.chats[sender]!.draft!.answers.rescue,undefined);assert.equal(s.chats[sender]!.draft!.step,4);
});
test('Meta sends are scoped to the correct phone and recent inbound window, with no retry',async()=>{
 let calls=0;const api=new WhatsAppAPI(phone,'private-token','v26.0',async(url,options)=>{calls++;assert.equal(String(url),`https://graph.facebook.com/v26.0/${phone}/messages`);assert.equal(options?.redirect,'error');return Response.json({messages:[{id:'wamid.OUT'}]});});
 assert.equal(await api.send(action(),Date.now()),'wamid.OUT');await assert.rejects(api.send(action(),Date.now()-86400001),WhatsAppError);assert.equal(calls,1);
 let failures=0;const failed=new WhatsAppAPI(phone,'private-token','v26.0',async()=>{failures++;throw Error('private-token');});await assert.rejects(failed.send(action(),Date.now()),e=>e instanceof WhatsAppError&&!e.message.includes('private-token'));assert.equal(failures,1);
});
test('interactive choices respect reply-button/list limits and use numeric input for 12 pain choices',async()=>{
 const payloads:Record<string,unknown>[]=[];const api=new WhatsAppAPI(phone,'test','v26.0',async(_url,options)=>{payloads.push(JSON.parse(String(options?.body)));return Response.json({messages:[{id:'wamid.OUT'}]});});
 for(const n of [1,6,12])await api.send(action(n),Date.now());assert.equal((payloads[0]!.interactive as {type:string}).type,'button');assert.equal((payloads[1]!.interactive as {type:string}).type,'list');assert.equal(payloads[2]!.type,'text');assert.match((payloads[2]!.text as {body:string}).body,/number from 0 to 10/);
});
test('media uses a strict Meta host allowlist, verifies hash/size, and rejects credential forwarding to other hosts',async()=>{
 const bytes=Buffer.alloc(12);bytes.write('OggS');const hash=createHash('sha256').update(bytes).digest('hex');let calls=0;
 const good=new WhatsAppAPI(phone,'test','v26.0',async(url,options)=>{calls++;assert.equal(options?.redirect,'error');return String(url).includes('graph.facebook.com')?Response.json({url:'https://lookaside.fbsbx.com/whatsapp_business/attachments/?x=1',file_size:12,sha256:hash}):new Response(bytes);});assert.equal((await good.voice('789')).length,12);assert.equal(calls,2);
 let badCalls=0;const bad=new WhatsAppAPI(phone,'test','v26.0',async()=>{badCalls++;return Response.json({url:'https://lookaside.fbsbx.com.evil.invalid/file',file_size:12,sha256:hash});});await assert.rejects(bad.voice('789'),WhatsAppError);assert.equal(badCalls,1);
 const mismatch=new WhatsAppAPI(phone,'test','v26.0',async(url)=>String(url).includes('graph.facebook.com')?Response.json({url:'https://lookaside.fbsbx.com/file',file_size:12,sha256:'bad'}):new Response(bytes));await assert.rejects(mismatch.voice('789'),WhatsAppError);
});
test('worker mirrors consent before sending, clears processed payloads and does not resend crashed actions',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'saathi-wa-'));try{
  const state=new TelegramState(directory,channelNumber(phone),'whatsapp');await state.transact(s=>{s.chats[sender]={patientId:'demo-ramesh',language:'en-IN',consentAt:Date.now()};planWhatsApp(s,1,{id:'wamid.HELP',from:sender,timestamp:now(),kind:'text',text:'/help'},phone);s.pending!.actions[0]!.status='sending';});
  const operations:string[]=[];const store={binding:async()=>{operations.push('binding');},complete:async()=>{operations.push('complete');}} as unknown as WhatsAppStore;
  const api=new WhatsAppAPI(phone,'test','v26.0',async()=>{throw Error('must not resend');});const worker=new WhatsAppWorker(state,store,api,async()=>{throw Error('must not process');});await worker.recover();assert.deepEqual(operations,['binding','complete']);assert.equal((await state.snapshot()).offset,2);assert.equal((await state.snapshot()).deliveries[0]!.status,'unknown');
 }finally{await rm(directory,{recursive:true,force:true});}
});
