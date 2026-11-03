import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkinQuestions,checkinAnswers} from '../packages/workflow/src/checkin.ts';
import {buttonInput,intakeSchema,processReport} from '../packages/workflow/src/intake.ts';
import {DemoStore,patients} from '../packages/workflow/src/store.ts';
import {patientHistory,preCallSummary} from '../packages/workflow/src/timeline.ts';
import {emptyState,planUpdate,finishUpdate,type State} from '../packages/telegram/src/index.ts';
const finish=(s:State)=>{for(const a of s.pending!.actions)a.status='sent';finishUpdate(s);};
test('extended check-in retains exact evidence and never fills skipped observations',()=>{
 const answers=checkinAnswers({nausea:'vomited',vomitCount:'3',vomitAppearance:'blood_or_coffee',stoolDays:'4',intake:'less',confusion:'sudden',legSwelling:'more',missedDoses:'2',coping:'struggling'});
 const input=buttonInput({requestId:randomUUID(),patientId:'demo-ramesh',answers},{pack:'adult'}),report=processReport(input,'buttons');
 for(const field of Object.values(input.fields)){assert.ok(input.messages[0]!.text.includes(field!.quote));assert.equal(field!.confidence,1);}
 for(const key of ['R6','R8','A3','A11'])assert.ok(report.evaluation.matched.includes(key),key);
 assert.equal(input.fields.nausea_vomiting?.value,'vomited');assert.equal(input.fields.leg_swelling?.value,'more');assert.equal(input.fields.wakefulness,undefined);assert.equal(input.context.on_morphine,undefined);
 assert.deepEqual(checkinAnswers({}),{});assert.throws(()=>checkinAnswers({stoolDays:'3+'}));assert.throws(()=>checkinAnswers({missedDoses:'-1'}));assert.throws(()=>intakeSchema.parse({requestId:randomUUID(),patientId:'demo-ramesh',answers:{confusion:'maybe'}}));
});
test('all daily topics complete through chat, including two-digit steps and source text',()=>{
 const s=emptyState();s.chats['42']={patientId:'demo-ramesh',language:'en-IN',consentAt:Date.now()};
 const message=(id:number,text:string)=>({update_id:id,message:{message_id:id,chat:{id:42,type:'private'},from:{id:42},text}});
 planUpdate(s,message(1,'/checkin'),1);finish(s);
 const values=['W1','normal','2','0','18','yes','none','0','none','1','usual','no','no','0','Invented concern about transport','managing'];
 assert.equal(values.length,checkinQuestions.length);
 for(let step=0;step<values.length;step++){
  const draft:NonNullable<State['chats'][string]['draft']>=s.chats['42']!.draft!;const id=step+2;assert.equal(draft.step,step);
  const update=checkinQuestions[step]!.textInput?message(id,values[step]!):{update_id:id,callback_query:{id:String(id),from:{id:42},data:`q:${draft.nonce}:${step}:${values[step]}`,message:{message_id:id,chat:{id:42,type:'private'}}}};
  planUpdate(s,update,1);if(step<values.length-1){assert.equal(s.pending!.task,undefined);finish(s);}
 }
 const task=s.pending!.task!;assert.equal(task.kind,'buttons');if(task.kind!=='buttons')throw Error();assert.equal(task.answers.coping,'managing');assert.equal(task.answers.concerns,values[14]);assert.equal(task.answers.legSwelling,'no');assert.equal(s.chats['42']!.draft,undefined);
});
test('later RED answers submit immediately without waiting for remaining topics',()=>{
 const s=emptyState();s.chats['42']={patientId:'demo-ramesh',language:'en-IN',consentAt:Date.now(),draft:{nonce:'n',step:11,requestId:randomUUID(),answers:{}}};
 planUpdate(s,{update_id:1,callback_query:{id:'c',from:{id:42},data:'q:n:11:sudden',message:{message_id:1,chat:{id:42,type:'private'}}}},1);
 assert.equal(s.pending?.task?.kind,'buttons');assert.equal(s.chats['42']!.draft,undefined);
});
test('timeline and summary isolate patients, retain earlier unresolved RED and avoid carrying older facts forward',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-history-'));try{
  let at=new Date('2026-10-23T10:00:00Z');const store=new DemoStore(dir,()=>at);
  const submit=(patientId:string,answers:object)=>store.submit({patientId,requestId:randomUUID(),answers});
  const old=(await submit('demo-ramesh',{wakefulness:'W4',rescue:4})).record;
  at=new Date('2026-10-24T10:00:00Z');const latest=(await submit('demo-ramesh',{pain:2})).record;await submit('demo-meena',{concerns:'PATIENT_SECRET_OTHER'});
  const records=(await store.snapshot()).records,copy=JSON.stringify(records);const history=patientHistory(records,'demo-ramesh');
  assert.equal(history.length,2);assert.equal(history[0]!.id,latest.id);assert.equal(history[1]!.id,old.id);assert.equal(JSON.stringify(records),copy);
  const summary=preCallSummary(patients[0]!,records);assert.ok(summary.includes(old.id));assert.ok(summary.includes(latest.id));assert.ok(!summary.includes('PATIENT_SECRET_OTHER'));assert.ok(!summary.includes('rescue_doses_24h: 4'));assert.ok(summary.includes('pain_now: 2'));assert.ok(summary.includes('24 Oct 2026'));assert.ok(summary.includes('IST'));assert.match(preCallSummary(patients[1]!,records),/No reports saved/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('automatic escalation checks serialize ticks and recover from a failed iteration',async()=>{
 const {runEscalations,escalationStatus}=await import('../packages/workflow/src/escalation.ts');
 const controller=new AbortController(),outcomes:unknown[]=[];let calls=0,waiting=0;
 await runEscalations({tick:async()=>{calls++;if(calls===1)throw Error('private provider details');return {changed:1};}},controller.signal,r=>outcomes.push(r),async()=>{waiting++;if(waiting===2)controller.abort();});
 assert.equal(calls,2);assert.deepEqual(outcomes,[{ok:false},{ok:true,changed:1}]);
 const red={status:'open',report:{evaluation:{tier:'RED'}},exhausted:false,escalationLevel:0,lastEscalatedAt:'2026-10-23T10:00:00Z'};
 assert.match(escalationStatus(red,Date.parse('2026-10-23T10:15:00Z')),/overdue/);assert.match(escalationStatus({...red,status:'acked'}),/stopped/);assert.match(escalationStatus({...red,exhausted:true}),/exhausted/);
});
