export const ESCALATION_INTERVAL_MS=15*60*1000;
export const ESCALATION_POLL_MS=30*1000;
export function escalationStatus(record:{status:string;report:{evaluation:{tier:string|null}};exhausted:boolean;escalationLevel:number;lastEscalatedAt:string},now=Date.now()){
 if(record.report.evaluation.tier!=='RED')return 'Escalation applies to RED demo reports only.';
 if(record.status!=='open')return 'Escalation stopped after acknowledgement.';
 if(record.exhausted)return 'Demo contact chain exhausted; report remains open. No notification sent.';
 const remaining=Math.ceil((Date.parse(record.lastEscalatedAt)+ESCALATION_INTERVAL_MS-now)/60000);
 return `Demo contact ${record.escalationLevel+1} of 3 · ${remaining<=0?'next check overdue':`next check in ${remaining} min`}. No notification sent.`;
}
/** No parallel ticks or catch-up burst. Failed ticks wait for the next normal interval. */
export async function runEscalations(store:{tick:()=>Promise<{changed:number}>},signal:AbortSignal,report:(result:{ok:boolean;changed?:number})=>void,wait:(signal:AbortSignal)=>Promise<void>=signal=>new Promise(resolve=>{
 const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve();};
 const timer=setTimeout(done,ESCALATION_POLL_MS);signal.addEventListener('abort',done,{once:true});if(signal.aborted)done();
})){
 while(!signal.aborted){try{const result=await store.tick();report({ok:true,changed:result.changed});}catch{report({ok:false});}if(!signal.aborted)await wait(signal);}
}
