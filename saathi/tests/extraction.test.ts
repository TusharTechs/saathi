import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {extract,transcribe,inspectAudio,extractionJSONSchema,ProviderError} from '../packages/extraction/src/index.ts';
import {NarrativePipeline,type NarrativeStore} from '../packages/extraction/src/pipeline.ts';
import type {RecordEntry} from '../packages/workflow/src/index.ts';
const id=randomUUID();
const text='He keeps falling asleep while talking. Four extra doses in the last 24 hours.';
const blank=()=>Object.fromEntries(Object.keys(extractionJSONSchema.properties).map(k=>[k,null]));
const facts=()=>({...blank(),wakefulness:{value:'W4',confidence:0.98,quote:'keeps falling asleep while talking'},rescue_doses_24h:{value:4,confidence:0.98,quote:'Four extra doses in the last 24 hours'}});
const response=(value:unknown,finish_reason='stop')=>Response.json({choices:[{finish_reason,message:{content:JSON.stringify(value)}}]});
function wav(seconds=1){const b=Buffer.alloc(44+32000*seconds);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);return b;}
test('extraction accepts only typed observations with verbatim source quotes',async()=>{
 const input=await extract(text,id,'test',async(_url,options)=>{
  const body=JSON.parse(String(options?.body));assert.equal(body.response_format.json_schema.strict,true);assert.equal(body.model,'openai/gpt-oss-120b');return response(facts());
 });assert.equal(input.fields.wakefulness?.value,'W4');assert.equal(input.fields.rescue_doses_24h?.messageId,id);assert.equal(Object.keys(input.fields).length,2);
 for(const bad of [{...facts(),tier:'GREEN'},{...facts(),wakefulness:{value:'W4',confidence:1,quote:'invented quote'}},{...facts(),rescue_doses_24h:{value:'4',confidence:1,quote:'Four'}},{wakefulness:null}]){
  await assert.rejects(extract(text,id,'test',async()=>response(bad)),e=>e instanceof ProviderError&&e.kind==='invalid_response');
 }
 await assert.rejects(extract(text,id,'test',async()=>response(facts(),'length')),ProviderError);
});
test('original Hindi and Kannada evidence remains unchanged',async()=>{
 for(const line of ['बात करते समय बार बार सो जाते हैं','ಮಾತನಾಡುವಾಗ ಮತ್ತೆ ಮತ್ತೆ ನಿದ್ರೆ ಮಾಡುತ್ತಾರೆ']){
  const input=await extract(line,id,'test',async()=>response({...blank(),wakefulness:{value:'W4',confidence:0.95,quote:line}}));assert.equal(input.fields.wakefulness?.quote,line);
 }
});
test('provider failures are sanitized and are never automatically retried',async()=>{
 for(const [status,kind] of [[401,'configuration'],[403,'configuration'],[429,'quota'],[402,'quota'],[500,'unavailable']] as const){
  let calls=0;await assert.rejects(extract(text,id,'test',async()=>{calls++;return new Response('private response',{status});}),e=>e instanceof ProviderError&&e.kind===kind&&!e.message.includes('private'));assert.equal(calls,1);
 }
 await assert.rejects(extract(text,id,'test',async()=>{throw Error('private connection');}),e=>e instanceof ProviderError&&e.kind==='timeout');
 await assert.rejects(extract(text,id,''),e=>e instanceof ProviderError&&e.kind==='configuration');
});
test('audio validation rejects oversized, incomplete and overlong WAV files',()=>{
 assert.deepEqual(inspectAudio(wav()),{mime:'audio/wav',extension:'wav'});
 for(const b of [Buffer.from('not audio at all'),Buffer.alloc(2*1024*1024+1),wav(31),wav().subarray(0,50)])assert.throws(()=>inspectAudio(b),ProviderError);
});
test('Sarvam uses canonical audio type and requires a nonempty transcript',async()=>{
 const spoken=await transcribe(wav(),'hi-IN','test',async(url,options)=>{
  assert.equal(url,'https://api.sarvam.ai/speech-to-text');const f=options?.body as FormData;assert.equal(f.get('model'),'saaras:v4');assert.equal(f.get('mode'),'verbatim');assert.equal((f.get('file') as File).type,'audio/wav');return Response.json({transcript:'नमस्ते',language_code:'hi-IN'});
 });assert.equal(spoken.text,'नमस्ते');
 await assert.rejects(transcribe(wav(),'en-IN','test',async()=>Response.json({transcript:''})),ProviderError);
});
function memoryStore(){
 let record:RecordEntry|undefined,hash='',claimed=false,claims=0;
 const store:NarrativeStore={
  async findRequest(_id,h){if(record&&hash!==h)throw Error('conflict');return record??null;},
  async saveNarrative(requestId,patientId,h,report){hash=h;record={id:randomUUID(),requestId,patientId,fingerprint:h,createdAt:new Date().toISOString(),status:'open',revision:1,escalationLevel:0,lastEscalatedAt:new Date().toISOString(),exhausted:false,events:[],report};return {record,duplicate:false};},
  async claimAnalysis(){assert.ok(record);if(claimed||record.report.processing?.extraction.status==='complete')return {claimed:false,record};claimed=true;claims++;return {claimed:true,lease:randomUUID(),record};},
  async completeAnalysis(_id,_lease,report){assert.ok(record);record={...record,report};claimed=false;return record;},
 };return {store,get:()=>record,claims:()=>claims};
}
test('safety flags are durably checkpointed before extraction; failure retains transcript',async()=>{
 const m=memoryStore();let calls=0;
 const p=new NarrativePipeline(m.store,{sarvam:'',groq:'test'},{speech:transcribe,extract:async()=>{
  calls++;assert.equal(m.get()?.report.evaluation.tier,'RED');assert.equal(m.get()?.report.processing?.extraction.status,'pending');throw new ProviderError('quota','quota');
 }});
 const r=await p.text({requestId:id,patientId:'demo-ramesh',language:'en-IN',synthetic:true,text:'We cannot wake him.'});
 assert.equal(calls,1);assert.equal(r.record.report.evaluation.tier,'RED');assert.equal(r.record.report.processing?.extraction.status,'failed');assert.equal(r.record.report.processing?.extraction.failureCode,'quota');assert.equal(r.record.report.input.messages[0]?.text,'We cannot wake him.');
});
test('completed retry uses checkpoint and never pays for a second transcription or extraction',async()=>{
 const m=memoryStore();let speech=0,model=0;
 const p=new NarrativePipeline(m.store,{sarvam:'test',groq:'test'},{speech:async()=>{speech++;return {text,language:'en-IN',model:'saaras:v4'};},extract:async(t,id)=>{model++;return extract(t,id,'test',async()=>response(facts()));}});
 const args={requestId:id,patientId:'demo-ramesh',language:'en-IN',synthetic:true};
 const a=await p.voice(args,wav());const b=await p.voice(args,wav());assert.equal(a.record.id,b.record.id);assert.equal(speech,1);assert.equal(model,1);assert.equal(b.duplicate,true);assert.equal(a.record.report.evaluation.tier,'RED');assert.equal(a.record.report.needsTextReview,true);
});
test('an active extraction claim prevents a second model call',async()=>{
 const m=memoryStore();let finish!:()=>void;const wait=new Promise<void>(r=>finish=r);let calls=0;
 const p=new NarrativePipeline(m.store,{sarvam:'',groq:'test'},{speech:transcribe,extract:async(t,id)=>{calls++;await wait;return extract(t,id,'test',async()=>response(blank()));}});
 const args={requestId:id,patientId:'demo-ramesh',language:'en-IN',synthetic:true,text:'A synthetic update.'};
 const first=p.text(args);while(!m.claims())await new Promise(r=>setImmediate(r));
 const second=await p.text(args);assert.equal(second.duplicate,true);assert.equal(calls,1);finish();assert.equal((await first).record.report.evaluation.tier,null);
});
