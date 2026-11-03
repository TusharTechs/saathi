import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DemoStore, buttonInput, processReport, scanSafetyNet } from '../packages/workflow/src/index.ts';
async function setup(now=new Date('2026-10-23T10:00:00Z')){
 const directory=await mkdtemp(join(tmpdir(),'saathi-test-'));
 let clock=now;
 return {store:new DemoStore(directory,()=>clock),directory,advance:(minutes:number)=>{clock=new Date(clock.getTime()+minutes*60000);},cleanup:()=>rm(directory,{recursive:true,force:true})};
}
const request=(scenario:'urgent'|'review'|'complete'|'incomplete'='urgent')=>({requestId:randomUUID(),patientId:'demo-ramesh',scenario,answers:{}});
test('persistent report submission retains rule trace across store instances',async()=>{const f=await setup();try{
 const {record}=await f.store.submit(request());const restored=await new DemoStore(f.directory).snapshot();
 assert.equal(restored.records[0]!.id,record.id);assert.equal(record.report.evaluation.tier,'RED');assert.ok(record.report.evaluation.matched.includes('R2'));assert.ok(record.report.evaluation.matched.includes('A1'));assert.equal(record.events.length,1);
}finally{await f.cleanup();}});
test('duplicate concurrent submissions create one report and one audit event',async()=>{const f=await setup();try{
 const payload=request();const [a,b]=await Promise.all([f.store.submit(payload),new DemoStore(f.directory).submit(payload)]);
 assert.equal(a.record.id,b.record.id);assert.equal(a.duplicate||b.duplicate,true);assert.equal((await f.store.snapshot()).records.length,1);
 await assert.rejects(f.store.submit({...payload,scenario:'review'}),/different answers/);
}finally{await f.cleanup();}});
test('state machine rejects stale revision and resolving before acknowledgement',async()=>{const f=await setup();try{
 const {record}=await f.store.submit(request());await assert.rejects(f.store.transition(record.id,'resolve',1),/Acknowledge/);
 const acknowledged=await f.store.transition(record.id,'acknowledge',1);assert.equal(acknowledged.status,'acked');
 await assert.rejects(f.store.transition(record.id,'resolve',1),/changed/);
 const resolved=await f.store.transition(record.id,'resolve',2);assert.equal(resolved.status,'resolved');assert.equal(resolved.events.length,3);
}finally{await f.cleanup();}});
test('concurrent acknowledgement has one winner and one audit event',async()=>{const f=await setup();try{
 const {record}=await f.store.submit(request());const attempts=await Promise.allSettled([f.store.transition(record.id,'acknowledge',1),new DemoStore(f.directory).transition(record.id,'acknowledge',1)]);
 assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1);assert.equal((await f.store.snapshot()).records[0]!.events.length,2);
}finally{await f.cleanup();}});
test('escalation waits for boundary, traverses chain and exhausts exactly once',async()=>{const f=await setup();try{
 await f.store.submit(request());f.advance(14);assert.equal((await f.store.tick()).changed,0);
 f.advance(1);assert.equal((await f.store.tick()).changed,1);assert.equal((await f.store.snapshot()).records[0]!.escalationLevel,1);
 assert.equal((await f.store.tick()).changed,0);f.advance(15);await f.store.tick();f.advance(15);await f.store.tick();
 const r=(await f.store.snapshot()).records[0]!;assert.equal(r.exhausted,true);assert.equal(r.status,'open');assert.equal(r.events.length,4);
 f.advance(60);assert.equal((await f.store.tick()).changed,0);
}finally{await f.cleanup();}});
test('acknowledged RED and open AMBER never escalate',async()=>{const f=await setup();try{
 const a=await f.store.submit(request());await f.store.transition(a.record.id,'acknowledge',1);await f.store.submit(request('review'));f.advance(20);assert.equal((await f.store.tick()).changed,0);
}finally{await f.cleanup();}});
test('malformed intake and mixed fixtures are rejected without writes',async()=>{const f=await setup();try{
 await assert.rejects(f.store.submit({...request(),patientId:'not-a-patient'}));
 await assert.rejects(f.store.submit({...request(),answers:{pain:2}}));
 await assert.rejects(f.store.submit({...request(),answers:{pain:12}}));
 assert.equal((await f.store.snapshot()).records.length,0);
}finally{await f.cleanup();}});
test('corrupted store is preserved, not replaced with empty state',async()=>{const f=await setup();try{
 await writeFile(join(f.directory,'queue.json'),'bad-json');await assert.rejects(f.store.submit(request()),/preserved/);assert.equal(await readFile(join(f.directory,'queue.json'),'utf8'),'bad-json');
}finally{await f.cleanup();}});
test('blank button answers produce unknowns, not baseline negatives',()=>{
 const i=buttonInput({requestId:randomUUID(),patientId:'demo-ramesh',answers:{}},{pack:'adult'});
 assert.deepEqual(i.fields,{});assert.equal(processReport(i,'buttons').evaluation.tier,null);
});
test('button selection is its own source evidence',()=>{
 const i=buttonInput({requestId:randomUUID(),patientId:'demo-ramesh',answers:{wakefulness:'W5'}},{pack:'adult'});
 assert.equal(i.fields.wakefulness!.quote,'Very hard to wake, or cannot be woken');assert.equal(processReport(i,'buttons').evaluation.tier,'RED');
});
for(const [language,text] of [['en','There is heavy bleeding.'],['hi','खून की उल्टी हो रही है'],['kn','ರಕ್ತ ವಾಂತಿ ಆಗುತ್ತಿದೆ']] as const) test(`draft ${language} safety net retains exact source`,()=>{
 const hits=scanSafetyNet([{id:'m',text}]);assert.ok(hits.length>0);assert.equal(hits[0]!.language,language);assert.equal(hits[0]!.sourceText,text);
});
test('negated phrase still conservatively raises RED and records ambiguity',()=>{
 const i=buttonInput({requestId:randomUUID(),patientId:'demo-ramesh',answers:{concerns:'He has no seizure today.'}},{pack:'adult'});
 const r=processReport(i,'buttons',true);assert.equal(r.evaluation.tier,'RED');assert.equal(r.safetyNet[0]!.possibleNegation,true);
});
test('unknown free text requires human review without inventing an extraction',()=>{
 const i=buttonInput({requestId:randomUUID(),patientId:'demo-ramesh',answers:{concerns:'Something has changed.'}},{pack:'adult'});
 const r=processReport(i,'buttons',true);assert.equal(r.evaluation.tier,null);assert.deepEqual(r.input.fields,{});assert.equal(r.needsTextReview,true);
});
test('fixture complete is GREEN and incomplete is pending',async()=>{const f=await setup();try{
 assert.equal((await f.store.submit(request('complete'))).record.report.evaluation.tier,'GREEN');assert.equal((await f.store.submit(request('incomplete'))).record.report.evaluation.tier,null);
}finally{await f.cleanup();}});
