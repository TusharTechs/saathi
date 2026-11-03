import type {EvalCase} from './corpus.ts';
export type EvalResult={id:string;language:string;expectedTier:string;actualTier:string;latencyMs:number;correctFields:number;totalFields:number;error?:string;matched:string[]};
export function metrics(rows:EvalResult[]){
 const red=rows.filter(r=>r.expectedTier==='RED'),predicted=rows.filter(r=>r.actualTier==='RED'),tp=red.filter(r=>r.actualTier==='RED').length;
 const confusion:Record<string,Record<string,number>>={};
 for(const r of rows){confusion[r.expectedTier]??={};confusion[r.expectedTier]![r.actualTier]=(confusion[r.expectedTier]![r.actualTier]??0)+1;}
 const latencies=rows.filter(r=>r.actualTier!=='NOT_RUN').map(r=>r.latencyMs).sort((a,b)=>a-b),totalFields=rows.reduce((n,r)=>n+r.totalFields,0);
 return {cases:rows.length,errors:rows.filter(r=>r.actualTier==='ERROR').length,notRun:rows.filter(r=>r.actualTier==='NOT_RUN').length,redRecall:red.length?tp/red.length:null,redPrecision:predicted.length?tp/predicted.length:null,fieldAccuracy:totalFields?rows.reduce((n,r)=>n+r.correctFields,0)/totalFields:null,medianLatencyMs:latencies.length?(latencies[Math.floor((latencies.length-1)/2)]!+latencies[Math.floor(latencies.length/2)]!)/2:null,confusion};
}
export function score(item:EvalCase,input:{fields:Record<string,{value:unknown}|undefined>},actualTier:string,matched:string[],latencyMs:number):EvalResult{
 const expected=Object.entries(item.expectedFields);
 return {id:item.id,language:item.language,expectedTier:item.expectedTier,actualTier,matched,latencyMs,totalFields:expected.length,correctFields:expected.filter(([key,value])=>input.fields[key]?.value===value).length};
}
