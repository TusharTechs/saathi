import {loadEnvFile} from 'node:process';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {corpus} from './corpus.ts';
import {metrics,score,type EvalResult} from './metrics.ts';
import {extract,ProviderError} from '../packages/extraction/src/index.ts';
import {processReport} from '../packages/workflow/src/intake.ts';
const live=process.argv.includes('--live'),mode=live?'live-extraction':'keyword-only';
if(live){try{loadEnvFile(new URL('../apps/web/env.local',import.meta.url));}catch{throw Error('Save apps/web/env.local before a live evaluation.');}if(!process.env.GROQ_API_KEY)throw Error('GROQ_API_KEY is missing.');}
// Free-tier pacing: --delay-ms waits between live calls; --quota-retries waits 65 s and retries after a 429.
const flag=(name:string,fallback:number)=>{const v=process.argv.find(a=>a.startsWith(`--${name}=`));return v?Math.max(0,Number(v.split('=')[1])||0):fallback;};
const delayMs=live?flag('delay-ms',0):0,quotaRetries=live?flag('quota-retries',0):0,sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const corpusSha256=createHash('sha256').update(JSON.stringify(corpus)).digest('hex'),target=new URL('../output/evaluation/',import.meta.url),checkpoint=new URL(`${mode}.partial.json`,target);
// Completed live results are checkpointed so a stopped run resumes without re-calling the provider.
const saved=new Map<string,EvalResult>();
if(live&&process.argv.includes('--resume'))try{const c=JSON.parse(await readFile(checkpoint,'utf8')) as {corpusSha256:string;results:EvalResult[]};if(c.corpusSha256===corpusSha256)for(const r of c.results)saved.set(r.id,r);}catch{/* No checkpoint yet. */}
const results:EvalResult[]=[];let stopped=false,calls=0;
for(const item of corpus){
 const previous=saved.get(item.id);if(previous){results.push(previous);continue;}
 if(stopped){results.push({...score(item,{fields:{}},'NOT_RUN',[],0),error:'stopped_after_provider_failure'});continue;}
 for(let attempt=0;;attempt++){
  if(live&&calls++)await sleep(delayMs);
  const start=performance.now();
  try{
   const input=live?await extract(item.text,item.id,process.env.GROQ_API_KEY!):{context:{pack:'adult' as const},messages:[{id:item.id,text:item.text}],fields:{}};
   const report=processReport(input,'text',true);results.push(score(item,input,report.evaluation.tier??'PENDING',report.evaluation.matched,Math.round(performance.now()-start)));
  }catch(error){
   const kind=error instanceof ProviderError?error.kind:'evaluation_failed';
   if(kind==='quota'&&attempt<quotaRetries){console.log(`${item.id}: rate limited, waiting 65 s (retry ${attempt+1}/${quotaRetries})`);await sleep(65000);continue;}
   results.push({...score(item,{fields:{}},'ERROR',[],Math.round(performance.now()-start)),error:kind});if(['configuration','quota','unavailable','timeout'].includes(kind))stopped=true;
  }
  break;
 }
 console.log(`${results.length}/${corpus.length} ${item.id}: ${results.at(-1)!.actualTier}`);
 if(live){await mkdir(target,{recursive:true});await writeFile(checkpoint,JSON.stringify({corpusSha256,results:results.filter(r=>r.actualTier!=='ERROR'&&r.actualTier!=='NOT_RUN')}));}
}
const complete=!results.some(r=>r.actualTier==='ERROR'||r.actualTier==='NOT_RUN');
const summary={complete,mode,createdAt:new Date().toISOString(),corpusSha256,labels:'engineering_authored_not_clinician_validated',scope:'Text only. No STT, no real patients, no database writes or outbound messages. Confidence calibration, extra-field correctness and translation quality are not scored.',overall:metrics(results),byLanguage:Object.fromEntries(['en','hi','kn'].map(lang=>[lang,metrics(results.filter(r=>r.language===lang))])),results};
await mkdir(target,{recursive:true});await writeFile(new URL(`${mode}.json`,target),JSON.stringify(summary,null,2));
const pct=(value:number|null)=>value===null?'n/a':`${(value*100).toFixed(1)}%`;
const lines=[`# Saathi text evaluation · ${mode}${complete?'':' · INCOMPLETE'}`,``,summary.createdAt,``,complete?'Run completed.':'INCOMPLETE: live model performance cannot be established from this run. Recall and field scores below count unrun cases as unsuccessful coverage; they are not estimates of completed model performance.',``,summary.labels,``,summary.scope,``,`Corpus: ${corpus.length} authored examples, 20 per language. The keyword-only baseline deliberately performs no extraction. Live mode calls Groq once per example${quotaRetries?`, retrying only after a provider rate limit (up to ${quotaRetries} waits of 65 s) and pausing ${delayMs} ms between calls`:', with no automatic retries'}. Provider failures and unrun cases remain in the recall/field denominators.`,``,`| Language | Cases | RED recall | RED precision | Labelled-field accuracy | Errors / not run |`,`|---|---:|---:|---:|---:|---:|`,...Object.entries({overall:summary.overall,...summary.byLanguage}).map(([lang,m])=>`| ${lang} | ${m.cases} | ${pct(m.redRecall)} | ${pct(m.redPrecision)} | ${pct(m.fieldAccuracy)} | ${m.errors} / ${m.notRun} |`),``,`Overall median latency: ${summary.overall.medianLatencyMs??'n/a'} ms. This includes failed attempts; it is not end-to-end voice latency.`,``,`Confusion matrix (expected → actual):`,`\`\`\`json`,JSON.stringify(summary.overall.confusion,null,2),`\`\`\``,``,`## Mismatches`,...results.filter(r=>r.actualTier!==r.expectedTier||r.correctFields!==r.totalFields).map(r=>`- ${r.id}: expected ${r.expectedTier}, got ${r.actualTier}; fields ${r.correctFields}/${r.totalFields}${r.error?`; ${r.error}`:''}`),``,`Finite synthetic results do not establish clinical safety. Negated and historical keyword matches intentionally remain conservative RED false alarms until reviewed. Full ~200-example clinician-reviewed and ~30-clip STT evaluation from the build plan is still outstanding.`,``,`Corpus SHA-256: ${summary.corpusSha256}`];
await writeFile(new URL(`${mode}.md`,target),lines.join('\n')+'\n');console.log(JSON.stringify(summary.overall));if(results.some(r=>r.actualTier==='ERROR'||r.actualTier==='NOT_RUN'))process.exitCode=1;
