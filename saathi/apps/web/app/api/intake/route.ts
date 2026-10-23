import { guard, body, store, json, fail } from '../../../lib/server';
export const runtime='nodejs';
export async function POST(request:Request){try{guard(request,true);const result=await store.submit(await body(request));return json(result,result.duplicate?200:201);}catch(e){return fail(e);}}
