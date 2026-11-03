import {guard,boundedBytes,json} from '../../../lib/server';
import {pipeline,narrativeFail} from '../../../lib/narrative';
import {inspectAudio,MAX_AUDIO_BYTES} from '../../../../../packages/extraction/src/index';
import {WorkflowError} from '../../../../../packages/workflow/src/index';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const session=guard(request,true,'multipart',['medical','family']);
  const bytes=await boundedBytes(request,MAX_AUDIO_BYTES+65536);
  const form=await new Response(new Uint8Array(bytes),{headers:{'Content-Type':request.headers.get('content-type')!}}).formData();
  const file=form.get('audio');if(!(file instanceof File)||!file.size||file.size>MAX_AUDIO_BYTES)throw new WorkflowError(400,'Choose a non-empty audio clip under 2 MB.');
  const audio=new Uint8Array(await file.arrayBuffer());inspectAudio(audio);
  return json(await pipeline().voice({requestId:form.get('requestId'),patientId:session.role==='family'?session.patientId:form.get('patientId'),language:form.get('language'),synthetic:form.get('synthetic')==='true'},audio));
 }catch(e){return narrativeFail(e);}
}
