import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { body, json, fail } from '../../../lib/server';
import { SupabaseStore, WorkflowError } from '../../../../../packages/workflow/src/index';
import { QUESTION_IDS } from '../../../lib/review-questions';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/**
 * The clinical lead's review form. Her private link carries SAATHI_REVIEW_TOKEN (no login, as she prefers minimal
 * involvement); Tushar reads every response with SAATHI_REVIEW_ADMIN_TOKEN. Answers autosave; Submit keeps a copy.
 */
const REVIEWER='clinical-lead';
const same=(given:string|null,secret:string|undefined)=>Boolean(secret&&secret.length>=16&&given)&&timingSafeEqual(createHash('sha256').update(given!).digest(),createHash('sha256').update(secret!).digest());
const db=()=>{if((process.env.SAATHI_STORAGE??'local')!=='supabase')throw new WorkflowError(503,'The review form needs Supabase storage.');return new SupabaseStore(process.env.NEXT_PUBLIC_SUPABASE_URL??'',process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'');};
const ids=new Set(QUESTION_IDS);
const answer=z.object({choice:z.union([z.string().max(300),z.array(z.string().max(300)).max(30)]).optional(),details:z.string().max(4000).optional()}).strict();
const schema=z.object({k:z.string().max(200),name:z.string().trim().max(80).default(''),answers:z.record(z.string().max(40),answer).refine(a=>Object.keys(a).every(k=>ids.has(k)),'Unknown question'),submit:z.boolean().default(false)}).strict();
export async function GET(request:Request){
  try{
    const url=new URL(request.url);
    if(same(url.searchParams.get('admin'),process.env.SAATHI_REVIEW_ADMIN_TOKEN))return json(await db().reviewAll());
    if(!same(url.searchParams.get('k'),process.env.SAATHI_REVIEW_TOKEN))return json({error:'This review link is not valid. Please ask Tushar for the link.'},403);
    return json(await db().reviewGet(REVIEWER)??{name:null,answers:{},updatedAt:null,submittedAt:null});
  }catch(e){return fail(e);}
}
export async function PUT(request:Request){
  try{
    const origin=request.headers.get('origin'),host=request.headers.get('host');
    if(!origin||!host||![`https://${host}`,`http://${host}`].includes(origin))return json({error:'Same-origin request required'},403);
    const input=schema.parse(await body(request,64000));
    if(!same(input.k,process.env.SAATHI_REVIEW_TOKEN))return json({error:'This review link is not valid.'},403);
    return json(await db().reviewSave(REVIEWER,input.name,input.answers,input.submit));
  }catch(e){return fail(e);}
}
