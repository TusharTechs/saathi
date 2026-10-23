import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {intakeSchema} from '../../workflow/src/intake.ts';
const language=z.enum(['en-IN','hi-IN','kn-IN','unknown']);
export const patient=z.enum(['demo-ramesh','demo-lakshmi','demo-fatima','demo-suresh','demo-meena']);
const binding=z.object({patientId:patient,language});
const taskSchema=z.discriminatedUnion('kind',[
 binding.extend({kind:z.literal('text'),requestId:z.uuid(),externalId:z.string(),text:z.string().max(4000)}),
 binding.extend({kind:z.literal('voice'),requestId:z.uuid(),externalId:z.string(),fileId:z.string(),duration:z.number(),size:z.number().optional()}),
 binding.extend({kind:z.literal('buttons'),requestId:z.uuid(),externalId:z.string(),answers:intakeSchema.shape.answers}),
]);
const button=z.object({text:z.string(),callback_data:z.string().max(64)});
export const actionSchema=z.object({method:z.enum(['sendMessage','answerCallbackQuery']),payload:z.object({chat_id:z.number().optional(),text:z.string().optional(),callback_query_id:z.string().optional(),reply_markup:z.object({inline_keyboard:z.array(z.array(button))}).optional()}),status:z.enum(['pending','sending','sent','failed','unknown'])});
export const stateSchema=z.object({version:z.literal(1),offset:z.number().int().nonnegative(),
 invites:z.record(z.string(),binding.extend({expires:z.number(),claimedBy:z.string().optional()})),
 chats:z.record(z.string(),binding.extend({consentAt:z.number().optional(),pendingNonce:z.string().optional(),pendingUntil:z.number().optional(),lastTask:taskSchema.optional(),draft:z.object({nonce:z.string(),step:z.number().int(),answers:intakeSchema.shape.answers,requestId:z.uuid()}).optional()})),
 pending:z.object({updateId:z.number().int(),chatId:z.number(),actions:z.array(actionSchema),task:taskSchema.optional()}).optional(),
 deliveries:z.array(z.object({updateId:z.number(),at:z.string(),status:z.enum(['sent','failed','unknown']),kind:z.string()})),
});
export type State=z.infer<typeof stateSchema>;
export type Task=z.infer<typeof taskSchema>;
export type Action=z.infer<typeof actionSchema>;
export const emptyState=():State=>({version:1,offset:0,invites:{},chats:{},deliveries:[]});
export const hashCode=(code:string)=>createHash('sha256').update(code).digest('hex');
export const nonce=()=>randomBytes(9).toString('base64url');
export function requestId(botId:number,updateId:number){const h=createHash('sha256').update(`saathi:telegram:${botId}:${updateId}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
/** Local single-host worker sessions, consent, cursor and outbox. No bot token is stored here. */
export class TelegramState {
 constructor(public directory:string,public botId:number){}
 async transact<T>(operation:(state:State)=>T,write=true):Promise<T>{
  await mkdir(this.directory,{recursive:true,mode:0o700});const lock=join(this.directory,`telegram-${this.botId}.transaction.lock`);let acquired=false;
  for(let i=0;i<100;i++){try{await mkdir(lock);acquired=true;break;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw Error('Telegram state lock failed.');await new Promise(r=>setTimeout(r,25));}}
  if(!acquired)throw Error('Telegram state is locked. Stop workers before inspecting a stale transaction lock.');
  const file=join(this.directory,`telegram-${this.botId}.json`),temporary=join(this.directory,`telegram-${randomUUID()}.tmp`);
  try{
   let state=emptyState();try{state=stateSchema.parse(JSON.parse(await readFile(file,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw Error('Telegram state could not be read. Existing state was preserved.');}
   const result=operation(state);if(write){stateSchema.parse(state);await writeFile(temporary,JSON.stringify(state),{mode:0o600});await rename(temporary,file);}return structuredClone(result);
  }finally{await rm(temporary,{force:true});await rm(lock,{recursive:true,force:true});}
 }
 snapshot(){return this.transact(s=>s,false);}
 async pair(patientId:z.infer<typeof patient>,language:z.infer<typeof binding>['language'],now=Date.now()){
  patient.parse(patientId);const code=randomBytes(24).toString('base64url');
  await this.transact(s=>{s.invites=Object.fromEntries(Object.entries(s.invites).filter(([,v])=>v.expires>now));s.invites[hashCode(code)]={patientId,language,expires:now+15*60*1000};});return code;
 }
}
