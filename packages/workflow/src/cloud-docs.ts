import {z} from 'zod';
import {SupabaseStore} from './supabase-store.ts';
/**
 * Small JSON documents in Supabase with optimistic versions (migration 010). They replace the WhatsApp worker's
 * JSON files so the worker can run as a serverless function, with no computer left on.
 */
export class CloudDocs extends SupabaseStore {
 async transact<S,T>(key:string,load:(raw:unknown)=>S,operation:(state:S)=>T,write=true,save:(state:S)=>unknown=s=>s):Promise<T>{
  for(let attempt=0;attempt<8;attempt++){
   const current=z.object({doc:z.unknown(),version:z.number()}).nullable().parse(await this.rpc('saathi_worker_get',{p_key:key}));
   const state=load(current?.doc??undefined),result=operation(state);
   if(!write)return structuredClone(result);
   if(await this.rpc('saathi_worker_put',{p_key:key,p_doc:save(state),p_version:current?.version??0})===true)return structuredClone(result);
   // Someone else wrote first: re-read and re-apply the operation.
   await new Promise(r=>setTimeout(r,40+Math.random()*120));
  }
  throw Error('Worker state is busy. Try again.');
 }
 async read(key:string){return z.object({doc:z.unknown(),version:z.number()}).nullable().parse(await this.rpc('saathi_worker_get',{p_key:key}))?.doc;}
 /** Writes a document only if it does not exist yet (used to move local worker state to the cloud once). */
 async seed(key:string,doc:unknown){return (await this.rpc('saathi_worker_put',{p_key:key,p_doc:doc,p_version:0}))===true;}
 async acquire(name:string,holder:string,seconds:number){return (await this.rpc('saathi_worker_acquire',{p_name:name,p_holder:holder,p_seconds:seconds}))===true;}
 async release(name:string,holder:string){await this.rpc('saathi_worker_release',{p_name:name,p_holder:holder});}
}
export type Cloud={docs:CloudDocs;key:string};
