/** Live synthetic integration check: calls configured providers through the local app. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const base='http://127.0.0.1:3000';
const examples=[
 {language:'en-IN',text:'This is an invented test. He keeps falling asleep while talking. I gave four extra doses in the last 24 hours.'},
 {language:'hi-IN',text:'यह एक काल्पनिक परीक्षण है। बात करते करते सो जाते हैं। पिछले 24 घंटों में चार अतिरिक्त खुराक दी हैं।'},
 {language:'kn-IN',text:'ಇದು ಕಾಲ್ಪನಿಕ ಪರೀಕ್ಷೆ. ಮಾತನಾಡುವಾಗ ನಿದ್ರೆ ಮಾಡುತ್ತಾರೆ. ಕಳೆದ 24 ಗಂಟೆಗಳಲ್ಲಿ ನಾಲ್ಕು ಹೆಚ್ಚುವರಿ ಡೋಸ್ ಕೊಟ್ಟಿದ್ದೇನೆ.'},
];
async function verify(path:string,body:FormData|string){
 const r=await fetch(base+path,{method:'POST',headers:typeof body==='string'?{Origin:base,'Content-Type':'application/json'}:{Origin:base},body,signal:AbortSignal.timeout(90000)});
 const d=await r.json();assert.equal(r.status,200,d.error);const report=d.record.report;
 assert.equal(report.processing.extraction.status,'complete');assert.equal(report.evaluation.tier,'RED');assert.ok(report.evaluation.matched.includes('R2'));assert.ok(report.evaluation.matched.includes('A1'));
 assert.equal(report.input.fields.wakefulness.value,'W4');assert.equal(report.input.fields.rescue_doses_24h.value,4);
 assert.equal(report.needsTextReview,true);
 for(const f of Object.values(report.input.fields) as {quote:string;messageId:string}[])assert.ok(report.input.messages.some((m:{id:string;text:string})=>m.id===f.messageId&&m.text.includes(f.quote)));
 console.log(JSON.stringify({reportId:d.record.id,language:report.processing.language,source:report.source,status:report.processing.extraction.status,tier:report.evaluation.tier}));
 return d.record.id;
}
for(const example of examples){
 const payload=JSON.stringify({requestId:randomUUID(),patientId:'demo-ramesh',synthetic:true,...example});
 const id=await verify('/api/narrative',payload);assert.equal(await verify('/api/narrative',payload),id);
}
if(process.env.SAATHI_EVAL_AUDIO){
 const form=new FormData();for(const [k,v] of Object.entries({requestId:randomUUID(),patientId:'demo-meena',language:'en-IN',synthetic:'true'}))form.set(k,v);
 form.set('audio',new Blob([await readFile(process.env.SAATHI_EVAL_AUDIO)],{type:'audio/wav'}),'synthetic.wav');await verify('/api/voice',form);
}
