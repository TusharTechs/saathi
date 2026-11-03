import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {familyReply,RED_FAMILY_MESSAGE,GREETING} from '../packages/workflow/src/service-config.ts';
import {WhatsAppAPI,WhatsAppWorker,channelNumber,isGreeting,type WhatsAppStore,type Inbound} from '../packages/whatsapp/src/index.ts';
import {TelegramState} from '../packages/telegram/src/state.ts';
const sender='919876543210',phone='1234567890',now=()=>Math.floor(Date.now()/1000);
test('family replies are fixed: Dr. Rao’s RED wording, a call-back time otherwise, no promise when extraction is incomplete',()=>{
 assert.equal(familyReply('RED'),RED_FAMILY_MESSAGE);assert.match(RED_FAMILY_MESSAGE,/nearest hospital/);
 assert.match(familyReply('AMBER'),/within 6 hours/);assert.match(familyReply('GREEN'),/within 24 hours/);assert.match(familyReply(null),/within 24 hours/);
 assert.doesNotMatch(familyReply(null,'failed'),/within/);for(const t of ['AMBER','GREEN',null])assert.match(familyReply(t),/nearest hospital or call 108/);
});
test('greetings are recognised without swallowing real reports',()=>{
 const m=(text:string):Inbound=>({id:'wamid.X',from:sender,timestamp:now(),kind:'text',text});
 for(const t of ['Hi','hii!','Hello','namaste','Good morning'])assert.ok(isGreeting(m(t)),t);
 for(const t of ['Hi, he cannot wake up','hello he is breathing slowly','/start'])assert.equal(isGreeting(m(t)),false,t);
});
test('a consented family’s Hi gets the greeting and creates no report; an unconsented Hi is left to the pairing flow',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'saathi-family-'));try{
  const state=new TelegramState(directory,channelNumber(phone),'whatsapp'),sent:string[]=[];let id=0;const queue:Inbound[]=[{id:'wamid.HI',from:sender,timestamp:now(),kind:'text',text:'Hi'}];
  await state.transact(s=>{s.chats[sender]={patientId:'demo-ramesh',language:'en-IN',consentAt:Date.now()};});
  const store={complete:async()=>{},binding:async()=>{},next:async()=>{const m=queue.shift();return m?{id:++id,message:m}:null;}} as unknown as WhatsAppStore;
  const api=new WhatsAppAPI(phone,'test','v26.0',async(_u,o)=>{sent.push(JSON.parse(String(o?.body)).text.body);return Response.json({messages:[{id:'wamid.OUT'}]});});
  const worker=new WhatsAppWorker(state,store,api,async()=>{throw Error('a greeting must not become a report');});
  assert.equal(await worker.once(),true);assert.deepEqual(sent,[GREETING]);assert.equal((await state.snapshot()).offset,2);
 }finally{await rm(directory,{recursive:true,force:true});}
});
