import {createHash} from 'node:crypto';
import {z} from 'zod';
import {inspectAudio,MAX_AUDIO_BYTES} from '../../extraction/src/index.ts';
import type {Action} from '../../telegram/src/state.ts';
export class WhatsAppError extends Error {constructor(public kind:'configuration'|'rejected'|'unknown',message:string){super(message);}}
export class WhatsAppAPI {
 constructor(public phoneId:string,private token:string,private version='v26.0',private transport:typeof fetch=fetch){
  if(!/^\d{1,40}$/.test(phoneId)||!token||!/^v\d{2}\.0$/.test(version))throw new WhatsAppError('configuration','Configure WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN and a supported WA_GRAPH_VERSION.');
 }
 private async graph(path:string,payload?:object){
  let r:Response;try{r=await this.transport(`https://graph.facebook.com/${this.version}/${path}`,{method:payload?'POST':'GET',headers:{Authorization:`Bearer ${this.token}`,...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new WhatsAppError('unknown','Meta did not confirm the request. No automatic send retry was made.');}
  if(!r.ok)throw new WhatsAppError(r.status>=500?'unknown':r.status===401||r.status===403?'configuration':'rejected','Meta rejected or could not confirm the request. Response details were withheld.');
  try{return await r.json() as unknown;}catch{throw new WhatsAppError('unknown','Meta returned an unreadable response.');}
 }
 async check(){const result=z.object({id:z.string(),display_phone_number:z.string()}).parse(await this.graph(`${this.phoneId}?fields=id,display_phone_number`));if(result.id!==this.phoneId)throw new WhatsAppError('configuration','Meta returned a different phone ID.');return result;}
 async send(action:Action,receivedAt:number){
  if(action.method!=='sendMessage')return;
  if(!Number.isFinite(receivedAt)||Date.now()-receivedAt>=24*60*60*1000||receivedAt>Date.now()+300000)throw new WhatsAppError('rejected','The 24-hour reply window expired. No template or paid fallback was sent.');
  const to=String(action.payload.chat_id);if(!/^\d{8,15}$/.test(to))throw new WhatsAppError('rejected','Invalid test recipient.');
  const body=action.payload.text??'',buttons=action.payload.reply_markup?.inline_keyboard.flat()??[];
  let message:object={type:'text',text:{body}};
  if(buttons.length&&buttons.length<=3)message={type:'interactive',interactive:{type:'button',body:{text:body},action:{buttons:buttons.map(b=>({type:'reply',reply:{id:b.callback_data,title:b.text.includes('synthetic reports only')?'Agree synthetic only':b.text.slice(0,20)}}))}}};
  else if(buttons.length<=10&&buttons.length)message={type:'interactive',interactive:{type:'list',body:{text:body},action:{button:'Choose an answer',sections:[{title:'Synthetic check-in',rows:buttons.map(b=>({id:b.callback_data,title:b.text.slice(0,24),description:b.text.slice(0,72)}))}]}}};
  else if(buttons.length>10)message={type:'text',text:{body:body+'\nType a number from 0 to 10, or send /skip.'}};
  const result=z.object({messages:z.array(z.object({id:z.string().min(1)})).min(1)}).parse(await this.graph(`${this.phoneId}/messages`,{messaging_product:'whatsapp',recipient_type:'individual',to,...message}));return result.messages[0]!.id;
 }
 async voice(mediaId:string){
  if(!/^\d{1,40}$/.test(mediaId))throw new WhatsAppError('rejected','Invalid media ID.');
  const meta=z.object({url:z.url(),file_size:z.number().positive().max(MAX_AUDIO_BYTES),sha256:z.string().min(1)}).parse(await this.graph(mediaId));
  const url=new URL(meta.url);if(url.protocol!=='https:'||url.hostname!=='lookaside.fbsbx.com'||url.port||url.username||url.password)throw new WhatsAppError('rejected','Unsupported Meta media host. Credentials were not forwarded.');
  let r:Response;try{r=await this.transport(url,{headers:{Authorization:`Bearer ${this.token}`},redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new WhatsAppError('unknown','Audio download was not confirmed.');}
  if(!r.ok||Number(r.headers.get('content-length')??0)>MAX_AUDIO_BYTES)throw new WhatsAppError('rejected','Audio exceeds 2 MB or is unavailable.');
  const reader=r.body?.getReader();if(!reader)throw new WhatsAppError('rejected','Empty audio.');let total=0;const chunks:Uint8Array[]=[];
  try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>MAX_AUDIO_BYTES){await reader.cancel();throw new WhatsAppError('rejected','Audio exceeds 2 MB.');}chunks.push(part.value);}}catch(e){if(e instanceof WhatsAppError)throw e;throw new WhatsAppError('unknown','Audio download was interrupted.');}
  const bytes=Buffer.concat(chunks),hash=createHash('sha256').update(bytes);const hex=hash.digest('hex'),base64=Buffer.from(hex,'hex').toString('base64');
  if(total!==meta.file_size||(meta.sha256!==hex&&meta.sha256!==base64))throw new WhatsAppError('rejected','Audio integrity validation failed.');inspectAudio(bytes);return bytes;
 }
}
