import {guard,body,json} from '../../../lib/server';
import {pipeline,narrativeFail,assertActive} from '../../../lib/narrative';
export const runtime='nodejs';
export async function POST(request:Request){try{const session=guard(request,true,'json',['medical','family']);const input=await body(request);
 if(session.role==='family')await assertActive(session.patientId!);
 // A signed-in family can only report for their own patient.
 return json(await pipeline().text(session.role==='family'?{...input,patientId:session.patientId}:input));}catch(e){return narrativeFail(e);}}
