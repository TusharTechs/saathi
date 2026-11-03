import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { simulatedAbha, saathiId, service } from '../../../packages/workflow/src/index';
import { store } from './server';
// The local WhatsApp worker keeps caregiver chat bindings on this computer; they give the call buttons a real tester number.
async function pairedNumbers(){
  const root=resolve(process.cwd(),'.saathi-demo'),numbers:Record<string,string>={};
  let dirs:string[]=[];try{dirs=(await readdir(root)).filter(d=>d.startsWith('whatsapp-'));}catch{return numbers;}
  for(const dir of dirs){
    let files:string[]=[];try{files=(await readdir(join(root,dir))).filter(f=>/^whatsapp-\d+\.json$/.test(f));}catch{continue;}
    for(const file of files)try{
      const state=JSON.parse(await readFile(join(root,dir,file),'utf8')) as {chats?:Record<string,{patientId?:string;consentAt?:number}>};
      for(const [sender,chat] of Object.entries(state.chats??{}))if(chat.patientId&&/^\d{8,15}$/.test(sender))numbers[chat.patientId]=sender;
    }catch{/* Unreadable worker state is skipped; the dashboard still works without call numbers. */}
  }
  return numbers;
}
export async function workspace(){
  const [queue,carePlans,fees,numbers]=await Promise.all([store.queue(),store.carePlans(),store.fees(),pairedNumbers()]);
  const patients=queue.patients.map(p=>({...p,saathiId:saathiId(p.id),abha:simulatedAbha(p.id),whatsapp:numbers[p.id]??null}));
  return {...queue,patients,carePlans,fees,service};
}
