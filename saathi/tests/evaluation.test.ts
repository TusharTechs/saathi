import {test} from 'node:test';
import assert from 'node:assert/strict';
import {corpus} from '../eval/corpus.ts';
import {metrics,score,type EvalResult} from '../eval/metrics.ts';
import {processReport} from '../packages/workflow/src/intake.ts';

test('evaluation labels have equal language coverage and valid provisional rule inputs',()=>{
 assert.equal(corpus.length,60);assert.equal(new Set(corpus.map(c=>c.id)).size,60);
 for(const lang of ['en','hi','kn'])assert.equal(corpus.filter(c=>c.language===lang).length,20);
 for(const c of corpus){
  const fields=Object.fromEntries(Object.entries(c.expectedFields).map(([k,value])=>[k,{value,confidence:1,quote:c.text,messageId:c.id}]));
  const r=processReport({context:{pack:'adult'},messages:[{id:c.id,text:c.text}],fields},'synthetic_fixture',true);
  assert.equal(r.evaluation.tier??'PENDING',c.expectedTier,c.id);
 }
});
test('failed and unrun urgent cases remain in recall denominator; no fabricated field score',()=>{
 const item=corpus[0]!,base=score(item,{fields:{wakefulness:{value:'W5'}}},'RED',['R1'],100);
 const rows:EvalResult[]=[base,{...base,id:'error',actualTier:'ERROR',correctFields:0,latencyMs:50},{...base,id:'notrun',actualTier:'NOT_RUN',correctFields:0,latencyMs:0}];
 const m=metrics(rows);assert.equal(m.redRecall,1/3);assert.equal(m.redPrecision,1);assert.equal(m.fieldAccuracy,1/3);assert.equal(m.errors,1);assert.equal(m.notRun,1);assert.equal(m.medianLatencyMs,75);assert.equal(metrics([]).redRecall,null);assert.equal(metrics([]).redPrecision,null);
});

test('review-card text is an exact copy from the handoff with approval unset',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../docs/02-CLINICAL-PROTOCOL.md',import.meta.url),'utf8');
 const drafts=JSON.parse(await readFile(new URL('../packages/clinical-content/src/review-cards.json',import.meta.url),'utf8'));
 assert.deepEqual(drafts.cards.map((c:{id:string})=>c.id),['C-URG','C2','C6','C12']);
 for(const card of drafts.cards){assert.equal(card.status,'draft');assert.equal(card.approved_by,null);assert.equal(card.approved_at,null);assert.ok(source.includes(card.text));}
});
