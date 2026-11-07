import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {dueReminders,Reminders,ReminderState,doseButton,type Inbound} from '../packages/whatsapp/src/index.ts';
import {demoCase,type CarePlanEntry} from '../packages/workflow/src/index.ts';
import type {Action} from '../packages/telegram/src/state.ts';
const sender='919876543210';
// 08:30 IST on 4 Nov 2026 = 03:00 UTC.
const at=(hhmm:string,date='2026-11-04')=>Date.parse(`${date}T${hhmm}:00+05:30`);
const entry=():CarePlanEntry=>{const plan=demoCase();plan.appointments=[{kind:'opd_visit',date:'2026-11-05',time:'10:00',note:'Palliative OPD review'}];return {plan,checkedInAt:'2026-11-03T14:00:00.000Z'};};
test('welcome, slot and evening-before appointment reminders are due once and list only that slot’s regular medicines',()=>{
 const due=dueReminders(entry(),'demo-ramesh',sender,at('08:30'),new Set());
 assert.match(due[0]!.text,/received .* care plan/);const morning=due[1]!;
 assert.match(morning.text,/morning \(08:00\)/);assert.match(morning.text,/Morphine sustained-release/);assert.doesNotMatch(morning.text,/Bisacodyl|immediate-release/);
 assert.deepEqual(morning.buttons!.map(b=>b.callback_data),['dose:2026-11-04:morning:given','dose:2026-11-04:morning:not_given']);
 assert.ok(morning.buttons!.every(b=>doseButton.test(b.callback_data)&&b.callback_data.length<=64));
 assert.equal(dueReminders(entry(),'demo-ramesh',sender,at('08:30'),new Set(due.map(d=>d.key))).length,0);
 assert.equal(dueReminders(entry(),'demo-ramesh',sender,at('10:30'),new Set([due[0]!.key])).length,0);
 const evening=dueReminders(entry(),'demo-ramesh',sender,at('18:30'),new Set([due[0]!.key]));assert.ok(evening.some(d=>/OPD visit .* tomorrow .* 10:00/.test(d.text)));
});
async function setup(lastInboundMsAgo:number,base=at('08:30')){
 const directory=await mkdtemp(join(tmpdir(),'saathi-rem-')),sent:Action[]=[],logged:string[]=[];
 const store={carePlans:async()=>({'demo-ramesh':entry()}),logDose:async(_p:string,k:string,d:string,s:string,st:string)=>{logged.push(`${k}:${d}:${s}:${st}`);}};
 const state=new ReminderState(directory),rem=new Reminders(state,store,{send:async(a:Action)=>{sent.push(a);}},()=>{},0);
 // Anchor the last family message to the simulated check time, not the real clock.
 await state.transact(s=>{s.lastInbound[sender]=base-lastInboundMsAgo;});
 return {directory,state,rem,sent,logged,chats:{[sender]:{patientId:'demo-ramesh',consentAt:Date.now()}}};
}
test('reminders send only inside the 24-hour window; outside it they are recorded, never sent',async()=>{
 const open=await setup(3600000);try{await open.rem.check(open.chats,at('08:30'));assert.equal(open.sent.length,2);await open.rem.check(open.chats,at('08:31'));assert.equal(open.sent.length,2);}finally{await rm(open.directory,{recursive:true,force:true});}
 const closed=await setup(2*86400000);try{await closed.rem.check(closed.chats,at('08:30'));assert.equal(closed.sent.length,0);assert.ok((await closed.state.snapshot()).sent.every(s=>s.status==='window_closed'));}finally{await rm(closed.directory,{recursive:true,force:true});}
});
test('a demo request sends one slot immediately; Given taps log every scheduled medicine in that slot',async()=>{
 const t=await setup(60000);try{
  await t.state.transact(s=>{s.sent.push({key:'welcome:demo-ramesh:2026-11-03T14:00:00.000Z',at:'x',status:'accepted'});});
  await t.state.requestDemo('demo-ramesh','night');await t.rem.check(t.chats,at('12:00'));
  assert.equal(t.sent.length,1);assert.match(t.sent[0]!.payload.text!,/night \(22:00\)/);assert.match(t.sent[0]!.payload.text!,/Bisacodyl/);assert.doesNotMatch(t.sent[0]!.payload.text!,/Morphine/);
  const tap:Inbound={id:'wamid.TAP',from:sender,timestamp:Math.floor(Date.now()/1000),kind:'button',buttonId:'dose:2026-11-04:night:given'};
  assert.equal(await t.rem.inbound(tap,t.chats),true);assert.deepEqual(t.logged.sort(),['bisacodyl:2026-11-04:night:given']);assert.match(t.sent.at(-1)!.payload.text!,/recorded as given/);
  assert.equal(await t.rem.inbound({...tap,buttonId:'q:n:1:2'},t.chats),false);assert.equal(await t.rem.inbound(tap,{}),false);
 }finally{await rm(t.directory,{recursive:true,force:true});}
});
