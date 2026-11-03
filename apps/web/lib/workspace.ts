import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { simulatedAbha, saathiId, service, type CarePlanEntry } from '../../../packages/workflow/src/index';
import { store } from './server';
import { cloudDocs, cloudKeys } from '../../../packages/whatsapp/src/cloud';
// Caregiver chat bindings give the call buttons a real tester number. They live in Supabase (cloud worker) or local files.
async function pairedNumbers(){
  const numbers:Record<string,string>={};const phone=process.env.WA_PHONE_NUMBER_ID??'';
  const add=(raw:unknown)=>{const chats=(raw as {chats?:Record<string,{patientId?:string;consentAt?:number}>})?.chats??{};for(const [sender,c] of Object.entries(chats))if(c.patientId&&/^\d{8,15}$/.test(sender))numbers[c.patientId]=sender;};
  if(process.env.SAATHI_WORKER_STATE==='supabase'&&/^\d{1,40}$/.test(phone)){try{add(await cloudDocs(process.env).read(cloudKeys(phone).chat));}catch{/* the dashboard still works without call numbers */}return numbers;}
  const root=resolve(process.cwd(),'.saathi-demo');
  let dirs:string[]=[];try{dirs=(await readdir(root)).filter(d=>d.startsWith('whatsapp-'));}catch{return numbers;}
  for(const dir of dirs){
    let files:string[]=[];try{files=(await readdir(join(root,dir))).filter(f=>/^whatsapp-\d+\.json$/.test(f));}catch{continue;}
    for(const f of files){try{add(JSON.parse(await readFile(join(root,dir,f),'utf8')));}catch{/* unreadable worker state is skipped */}}
  }
  return numbers;
}
export async function workspace(){
  const [queue,plans,feeMap,numbers]=await Promise.all([store.queue(),store.carePlans(),store.fees(),pairedNumbers()]);
  const carePlans:Record<string,CarePlanEntry>=plans,fees:Record<string,'due'|'paid'|'waived'>=feeMap;
  const patients=queue.patients.map(p=>({...p,saathiId:saathiId(p.id),abha:simulatedAbha(p.id),whatsapp:numbers[p.id]??null}));
  return {...queue,patients,carePlans,fees,service};
}
