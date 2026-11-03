import {z} from 'zod';
import {guard,body,store,json} from '../../../../lib/server';
import {pipeline,narrativeFail} from '../../../../lib/narrative';
import {WorkflowError} from '../../../../../../packages/workflow/src/index';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{
  guard(request,true);z.object({}).strict().parse(await body(request));const {id}=await context.params;
  const record=(await store.snapshot()).records.find(r=>r.id===id);if(!record)throw new WorkflowError(404,'Report not found');
  return json(await pipeline().analyze(record));
 }catch(e){return narrativeFail(e);}
}
