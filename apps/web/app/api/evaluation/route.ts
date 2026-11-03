import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { guard, json, fail } from '../../../lib/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Row={expectedTier:string;actualTier:string};
const dir=resolve(process.cwd(),'../../output/evaluation');
const read=async(name:string)=>{try{return JSON.parse(await readFile(resolve(dir,name),'utf8')) as {complete?:boolean;createdAt?:string;results:Row[]};}catch{return null;}};
// RED recall over the rows actually run; unrun rows are reported separately, never counted as passes.
const score=(rows:Row[])=>{const red=rows.filter(r=>r.expectedTier==='RED'),run=rows.filter(r=>!['ERROR','NOT_RUN'].includes(r.actualTier));return {cases:rows.length,run:run.length,redExpected:red.length,redCaught:red.filter(r=>r.actualTier==='RED').length,falseRed:rows.filter(r=>r.actualTier==='RED'&&r.expectedTier!=='RED').length};};
export async function GET(request:Request){
  try{
    guard(request);const [keyword,live,partial]=await Promise.all([read('keyword-only.json'),read('live-extraction.json'),read('live-extraction.partial.json')]);
    const liveRows=partial&&(!live?.complete||(partial.results.length>live.results.filter(r=>!['ERROR','NOT_RUN'].includes(r.actualTier)).length))?partial.results:live?.results??[];
    return json({keyword:keyword?score(keyword.results):null,live:{...score(liveRows),complete:Boolean(live?.complete&&liveRows===live.results),total:60}});
  }catch(e){return fail(e);}
}
