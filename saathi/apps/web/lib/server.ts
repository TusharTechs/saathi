import { resolve } from 'node:path';
import { z } from 'zod';
import { DemoStore, SupabaseStore, WorkflowError } from '../../../packages/workflow/src/index';
const storageMode=process.env.SAATHI_STORAGE??'local';
if(!['local','supabase'].includes(storageMode))throw new Error('Unsupported SAATHI_STORAGE mode');
export const store=storageMode==='supabase'
 ? new SupabaseStore(process.env.NEXT_PUBLIC_SUPABASE_URL??'',process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'')
 : new DemoStore(resolve(process.cwd(),'.saathi-demo'));
export function guard(request:Request,write=false,format:'json'|'multipart'='json'){
  if(process.env.SAATHI_LOCAL_DEMO!=='1') throw new WorkflowError(503,'Local demo is disabled. Start with pnpm dev.');
  const url=new URL(request.url);
  const host=request.headers.get('host');
  if(!host || !['localhost','127.0.0.1'].includes(new URL(`http://${host}`).hostname)) throw new WorkflowError(403,'Loopback access only');
  if(write){
    const origin=request.headers.get('origin');
    if(!origin || ![`http://${host}`,`https://${host}`].includes(origin)) throw new WorkflowError(403,'Same-origin request required');
    const expected=format==='json'?'application/json':'multipart/form-data';
    if(!request.headers.get('content-type')?.startsWith(expected)) throw new WorkflowError(415,format==='json'?'JSON required':'Audio form required');
  }
  if(!['localhost','127.0.0.1'].includes(url.hostname)) throw new WorkflowError(403,'Loopback access only');
}
export async function body(request:Request){
  const reader=request.body?.getReader(); if(!reader) throw new WorkflowError(400,'JSON body required');
  let length=0;const chunks:Uint8Array[]=[];
  while(true){const result=await reader.read(); if(result.done) break;length+=result.value.byteLength;
    if(length>16000){await reader.cancel();throw new WorkflowError(413,'Request exceeds 16 KB');}chunks.push(result.value);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new WorkflowError(400,'Invalid JSON');}
}
export function fail(error:unknown){
  const status=error instanceof WorkflowError?error.code:error instanceof z.ZodError?400:500;
  return Response.json({error:error instanceof WorkflowError?error.message:error instanceof z.ZodError?'Invalid request fields':'Operation failed. Refresh the queue to check its current status.'},{status,headers:{'Cache-Control':'no-store'}});
}
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function boundedBytes(request:Request,limit:number){
 const reader=request.body?.getReader();if(!reader)throw new WorkflowError(400,'Request body required');
 let length=0;const chunks:Uint8Array[]=[];
 while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;
  if(length>limit){await reader.cancel();throw new WorkflowError(413,'Audio form is too large; maximum audio size is 2 MB.');}chunks.push(part.value);}
 return Buffer.concat(chunks);
}
