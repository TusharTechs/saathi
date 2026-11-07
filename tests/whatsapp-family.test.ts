import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {familyReply,familyReplies,callbackDue,RED_FAMILY_MESSAGE,R13_MESSAGE,EMERGENCY_CARD,GREETING} from '../packages/workflow/src/service-config.ts';
import {WhatsAppAPI,WhatsAppWorker,channelNumber,isGreeting,type WhatsAppStore,type Inbound} from '../packages/whatsapp/src/index.ts';
import {TelegramState} from '../packages/telegram/src/state.ts';
const sender='919876543210',phone='1234567890',now=()=>Math.floor(Date.now()/1000);
test('family replies are Dr. Rao’s approved text: critical REDs, R13, other REDs, AMBER and GREEN',()=>{
 const critical=familyReplies('RED',undefined,['R3']);assert.equal(critical.length,2);assert.match(critical[0]!,/may be critical/);assert.match(critical[0]!,/end-of-life care/);assert.equal(critical[1],EMERGENCY_CARD);
 assert.deepEqual(familyReplies('RED',undefined,['R13']),[R13_MESSAGE]);assert.match(R13_MESSAGE,/Tele-MANAS at 14416/);
 assert.match(familyReply('RED',undefined,['R12']),/within 30 minutes/);assert.doesNotMatch(familyReply('RED',undefined,['R12']),/may be critical/);
 assert.match(familyReply('AMBER'),/within 6 hours of working time/);assert.match(familyReply('GREEN'),/next working day/);
 assert.doesNotMatch(familyReply(null,'failed'),/within/);for(const t of ['AMBER','GREEN',null])assert.match(familyReply(t),/108 for an ambulance/);
 assert.match(RED_FAMILY_MESSAGE,/local physician/);
});
test('call-backs: RED in 30 minutes any time; AMBER counts duty hours; GREEN is the next working day',()=>{
 const due=(at:string,t:string)=>new Date(callbackDue(at,t)).toISOString();
 assert.equal(due('2026-11-07T02:00:00+05:30','RED'),'2026-11-06T21:00:00.000Z');
 assert.equal(due('2026-11-06T10:00:00+05:30','AMBER'),new Date('2026-11-06T16:00:00+05:30').toISOString());
 assert.equal(due('2026-11-06T20:00:00+05:30','AMBER'),new Date('2026-11-07T15:00:00+05:30').toISOString());
 assert.equal(due('2026-11-07T15:00:00+05:30','AMBER'),new Date('2026-11-09T13:00:00+05:30').toISOString());
 assert.equal(due('2026-11-07T02:00:00+05:30','GREEN'),new Date('2026-11-09T17:00:00+05:30').toISOString());
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
test('cards and hospice videos go only with non-urgent reports, chosen by rule, never with RED',async()=>{
 const {careContent,VIDEOS,C6}=await import('../packages/workflow/src/family-content.ts');
 assert.deepEqual(careContent('RED',['R3','A9']),[]);assert.deepEqual(careContent('AMBER',['A4']),[C6]);
 assert.match(careContent('AMBER',['A9']).join(),/Wound dressing \(Karunashraya Hospice, Bengaluru, Kannada\): https:\/\/www\.youtube\.com\/watch\?v=j48q5jD4l6c/);
 assert.match(familyReplies('GREEN',undefined,[],{breathing:{value:'breathless_moving'}}).join(),/St Nicholas Hospice Care/);
 for(const v of Object.values(VIDEOS))assert.match(v.source,/Hospice/);
 assert.ok(!careContent('AMBER',['A1','A2','A3','A5','A6','A7','A8','A11','A13','A14','A16']).some(t=>/last days/i.test(t)));
});
test('a closed patient’s WhatsApp message gets only the OPD message and creates no report',async()=>{
 const {closedMessage}=await import('../packages/workflow/src/service-config.ts');
 const directory=await mkdtemp(join(tmpdir(),'saathi-closed-'));try{
  const state=new TelegramState(directory,channelNumber(phone),'whatsapp'),sent:string[]=[];const queue:Inbound[]=[{id:'wamid.C',from:sender,timestamp:now(),kind:'text',text:'He is very sleepy'}];
  await state.transact(s=>{s.chats[sender]={patientId:'demo-ramesh',language:'en-IN',consentAt:Date.now()};});
  const plan={demographics:{name:'Arjun Mehta'},closure:{reason:'transferred',note:'',closedAt:'x',closedBy:'Dr'}};
  const store={complete:async()=>{},binding:async()=>{},carePlans:async()=>({'demo-ramesh':{plan,checkedInAt:'x'}}),next:async()=>{const m=queue.shift();return m?{id:1,message:m}:null;}} as unknown as WhatsAppStore;
  const api=new WhatsAppAPI(phone,'test','v26.0',async(_u,o)=>{sent.push(JSON.parse(String(o?.body)).text.body);return Response.json({messages:[{id:'wamid.OUT'}]});});
  const worker=new WhatsAppWorker(state,store,api,async()=>{throw Error('a closed patient must not be triaged');});
  assert.equal(await worker.once(),true);assert.deepEqual(sent,[closedMessage('Arjun Mehta')]);assert.match(sent[0]!,/OPD/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
