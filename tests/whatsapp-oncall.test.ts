import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {OnCallState,OnCallAlerts,WhatsAppError,WhatsAppAPI,WhatsAppWorker,channelNumber,isOnCallMessage,type Inbound,type WhatsAppStore} from '../packages/whatsapp/src/index.ts';
import {TelegramState} from '../packages/telegram/src/state.ts';
import type {Action} from '../packages/telegram/src/state.ts';
import type {RecordEntry} from '../packages/workflow/src/index.ts';
const doctor='918888888888',family='919876543210',sec=()=>Math.floor(Date.now()/1000);
const msg=(over:Partial<Inbound>):Inbound=>({id:'wamid.'+randomUUID().replaceAll('-',''),from:doctor,timestamp:sec(),kind:'text',...over});
const record=(tier:'RED'|'AMBER',createdAt:string,status:RecordEntry['status']='open'):RecordEntry=>({id:randomUUID(),patientId:'demo-ramesh',requestId:randomUUID(),fingerprint:'f',createdAt,status,revision:1,escalationLevel:0,lastEscalatedAt:createdAt,exhausted:false,events:[],
 report:{source:'buttons',needsTextReview:false,safetyNet:[],input:{context:{pack:'adult'},messages:[],fields:{}},origin:{channel:'whatsapp',externalId:'wamid.X'},evaluation:{protocolVersion:'v',mode:'demo_only',tier,status:'complete',matched:['R3'],unknownRuleIds:[],followupFields:[],traces:[{ruleId:'R3',label:'Breathing 12 or fewer per minute',outcome:true,evidence:[]}]}} as unknown as RecordEntry['report']});
async function setup(records:RecordEntry[]){
 const directory=await mkdtemp(join(tmpdir(),'saathi-oncall-')),sent:{action:Action;receivedAt:number}[]=[],transitions:string[]=[];let failSend:Error|undefined;
 const store={queue:async()=>({records,patients:[{id:'demo-ramesh',name:'Synthetic Ramesh K.'}]}),transition:async(id:string,_a:'acknowledge',revision:number)=>{transitions.push(`${id}@${revision}`);const r=records.find(x=>x.id===id)!;r.status='acked';return r;}};
 const api={send:async(action:Action,receivedAt:number)=>{if(failSend)throw failSend;sent.push({action,receivedAt});}};
 const state=new OnCallState(directory),alerts=new OnCallAlerts(state,store,api,()=>{},0);
 return {directory,state,alerts,sent,transitions,fail:(e?:Error)=>{failSend=e;},done:()=>rm(directory,{recursive:true,force:true})};
}
test('only on-call commands and Acknowledge taps are treated as on-call messages',()=>{
 assert.ok(isOnCallMessage(msg({text:'/oncall'})));assert.ok(isOnCallMessage(msg({text:'/oncall '+'a'.repeat(32)})));assert.ok(isOnCallMessage(msg({text:'/offcall'})));
 assert.ok(isOnCallMessage(msg({kind:'button',buttonId:'ack:'+randomUUID()})));
 assert.equal(isOnCallMessage(msg({text:'Invented report'})),false);assert.equal(isOnCallMessage(msg({kind:'button',buttonId:'q:n:2:1'})),false);
});
test('a single-use private link registers the on-call phone; family messages still reach the check-in flow',async()=>{
 const t=await setup([]);try{
  const code=await t.state.invite();
  assert.equal(await t.alerts.inbound(msg({text:'/oncall '+code})),true);assert.match(t.sent[0]!.action.payload.text!,/now the Saathi demo on-call contact/);
  assert.equal((await t.state.snapshot()).sender,doctor);
  assert.equal(await t.alerts.inbound(msg({from:'917777777777',text:'/oncall '+code})),true);assert.match(t.sent[1]!.action.payload.text!,/expired or was already used/);assert.equal((await t.state.snapshot()).sender,doctor);
  assert.equal(await t.alerts.inbound(msg({from:family,text:'Invented report'})),false);
  assert.equal(await t.alerts.inbound(msg({from:'917777777777',text:'/oncall'})),true);assert.match(t.sent[2]!.action.payload.text!,/not registered/);
  assert.equal(await t.alerts.inbound(msg({text:'/offcall'})),true);assert.equal((await t.state.snapshot()).sender,undefined);
 }finally{await t.done();}
});
test('each new open RED is alerted once inside the 24-hour window, with an Acknowledge button',async()=>{
 const before=record('RED',new Date(Date.now()-3600000).toISOString()),red=record('RED',new Date(Date.now()+1000).toISOString()),amber=record('AMBER',new Date(Date.now()+1000).toISOString());
 const t=await setup([before,red,amber]);try{
  await t.alerts.inbound(msg({text:'/oncall '+await t.state.invite()}));t.sent.length=0;
  await t.alerts.check();await t.alerts.check();
  assert.equal(t.sent.length,1);const a=t.sent[0]!.action;
  assert.match(a.payload.text!,/RED · synthetic data/);assert.match(a.payload.text!,/Synthetic Ramesh K\./);assert.match(a.payload.text!,/R3 Breathing/);
  assert.deepEqual(a.payload.reply_markup!.inline_keyboard[0],[{text:'Acknowledge',callback_data:`ack:${red.id}`}]);
  assert.deepEqual((await t.state.snapshot()).alerts.map(x=>[x.id,x.status]),[[red.id,'accepted']]);
 }finally{await t.done();}
});
test('an expired window records the alert as window_closed and never sends; a crashed send is not repeated',async()=>{
 const red=record('RED',new Date().toISOString()),second=record('RED',new Date().toISOString());
 const t=await setup([red]);try{
  await t.state.transact(s=>{Object.assign(s,{sender:doctor,registeredAt:Date.now()-2*86400000,lastInboundAt:Date.now()-86400000-1000});});
  await t.alerts.check();assert.equal(t.sent.length,0);assert.equal((await t.state.snapshot()).alerts[0]!.status,'window_closed');
  await t.state.transact(s=>{s.lastInboundAt=Date.now();s.alerts.push({id:second.id,at:new Date().toISOString(),status:'sending'});});
  await t.alerts.check();assert.equal(t.sent.length,0);assert.equal((await t.state.snapshot()).alerts.find(a=>a.id===second.id)!.status,'unknown');
 }finally{await t.done();}
});
test('send failures are recorded without retry',async()=>{
 const red=record('RED',new Date(Date.now()+1000).toISOString()),t=await setup([red]);try{
  await t.alerts.inbound(msg({text:'/oncall '+await t.state.invite()}));t.fail(new WhatsAppError('rejected','x'));
  await t.alerts.check();await t.alerts.check();assert.equal((await t.state.snapshot()).alerts[0]!.status,'failed');
 }finally{await t.done();}
});
test('only the registered on-call phone can acknowledge, and only open reports change',async()=>{
 const red=record('RED',new Date().toISOString()),t=await setup([red]);try{
  await t.alerts.inbound(msg({text:'/oncall '+await t.state.invite()}));
  await t.alerts.inbound(msg({from:family,kind:'button',buttonId:`ack:${red.id}`}));assert.deepEqual(t.transitions,[]);assert.match(t.sent.at(-1)!.action.payload.text!,/Only the registered/);
  await t.alerts.inbound(msg({kind:'button',buttonId:`ack:${red.id}`}));assert.deepEqual(t.transitions,[`${red.id}@1`]);assert.match(t.sent.at(-1)!.action.payload.text!,/Acknowledged in Saathi for Synthetic Ramesh K\./);
  await t.alerts.inbound(msg({kind:'button',buttonId:`ack:${red.id}`}));assert.equal(t.transitions.length,1);assert.match(t.sent.at(-1)!.action.payload.text!,/already acknowledged/);
 }finally{await t.done();}
});
test('the worker consumes on-call messages, advances the inbox and never plans them as family reports',async()=>{
 const t=await setup([]);try{
  const code=await t.state.invite(),phone='1234567890',state=new TelegramState(t.directory,channelNumber(phone),'whatsapp'),completed:number[]=[];let served=false;
  const store={complete:async(_p:string,o:number)=>{completed.push(o);},binding:async()=>{},next:async()=>served?null:(served=true,{id:7,message:msg({text:'/oncall '+code})})} as unknown as WhatsAppStore;
  const api=new WhatsAppAPI(phone,'test','v26.0',async()=>{throw Error('family flow must not send');});
  const worker=new WhatsAppWorker(state,store,api,async()=>{throw Error('must not process');},()=>{},t.alerts);
  assert.equal(await worker.once(),true);const snap=await state.snapshot();assert.equal(snap.offset,8);assert.equal(snap.pending,undefined);assert.ok(completed.includes(8));
  assert.equal((await t.state.snapshot()).sender,doctor);assert.equal(await worker.once(),false);
 }finally{await t.done();}
});
