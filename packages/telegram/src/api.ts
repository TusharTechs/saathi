import {z} from 'zod';
import {MAX_AUDIO_BYTES,inspectAudio} from '../../extraction/src/index.ts';
export class TelegramError extends Error {
 constructor(public kind:'configuration'|'conflict'|'rate_limit'|'rejected'|'unknown',message:string){super(message);}
}
const methods=['getMe','getWebhookInfo','getUpdates','getFile','sendMessage','answerCallbackQuery'] as const;
export type Method=typeof methods[number];
/** Telegram tokens occur in URL paths. Never expose URLs, raw errors or provider bodies. */
export class TelegramAPI {
 constructor(private token:string,private transport:typeof fetch=fetch){
  if(!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token))throw new TelegramError('configuration','TELEGRAM_BOT_TOKEN is missing or malformed.');
 }
 async call(method:Method,payload:object={},signal?:AbortSignal):Promise<unknown>{
  if(!methods.includes(method))throw new TelegramError('rejected','Unsupported Telegram operation.');
  let response:Response;
  try{response=await this.transport(`https://api.telegram.org/bot${this.token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(35000)]):AbortSignal.timeout(35000)});}
  catch{throw new TelegramError('unknown','Telegram connection ended without a confirmed result. No automatic send retry was made.');}
  let data:unknown;try{data=await response.json();}catch{throw new TelegramError('unknown','Telegram returned an unreadable result.');}
  const envelope=z.object({ok:z.boolean(),result:z.unknown().optional(),error_code:z.number().optional()}).safeParse(data);
  if(!envelope.success)throw new TelegramError('unknown','Telegram returned an incompatible result.');
  if(!response.ok||!envelope.data.ok){
   const code=envelope.data.error_code??response.status;
   if(code===401||code===404)throw new TelegramError('configuration','Telegram rejected the bot configuration.');
   if(code===409)throw new TelegramError('conflict','Another Telegram poller or webhook is active. Stop this worker and inspect the bot configuration.');
   if(code===429)throw new TelegramError('rate_limit','Telegram rate limit reached. No automatic send retry was made.');
   if(code>=500)throw new TelegramError('unknown','Telegram could not confirm the operation.');
   throw new TelegramError('rejected','Telegram rejected the operation.');
  }
  return envelope.data.result;
 }
 async identity(){return z.object({id:z.number().int().positive(),is_bot:z.literal(true),username:z.string().regex(/^[A-Za-z0-9_]+$/)}).parse(await this.call('getMe'));}
 async checkPolling(){const info=z.object({url:z.string()}).parse(await this.call('getWebhookInfo'));if(info.url)throw new TelegramError('conflict','This bot has a webhook. It was left unchanged; use a separate demo bot or deliberately remove its webhook yourself.');}
 async voice(fileId:string,duration:number,size?:number){
  if(duration<1||duration>30||(size!==undefined&&size>MAX_AUDIO_BYTES))throw new TelegramError('rejected','Use a voice note of at most 30 seconds and 2 MB.');
  const file=z.object({file_path:z.string(),file_size:z.number().optional()}).parse(await this.call('getFile',{file_id:fileId}));
  if((file.file_size??0)>MAX_AUDIO_BYTES||!/^voice\/[A-Za-z0-9_./-]+$/.test(file.file_path)||file.file_path.split('/').includes('..'))throw new TelegramError('rejected','Unsupported or oversized Telegram voice file.');
  let r:Response;try{r=await this.transport(`https://api.telegram.org/file/bot${this.token}/${file.file_path}`,{redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new TelegramError('unknown','Telegram audio download failed.');}
  if(!r.ok||Number(r.headers.get('content-length')??0)>MAX_AUDIO_BYTES)throw new TelegramError('rejected','Telegram audio could not be downloaded within the size limit.');
  const reader=r.body?.getReader();if(!reader)throw new TelegramError('rejected','Telegram audio was empty.');
  const chunks:Uint8Array[]=[];let total=0;
  while(true){const p=await reader.read();if(p.done)break;total+=p.value.length;if(total>MAX_AUDIO_BYTES){await reader.cancel();throw new TelegramError('rejected','Telegram audio exceeds 2 MB.');}chunks.push(p.value);}
  const bytes=Buffer.concat(chunks);inspectAudio(bytes);return bytes;
 }
}
