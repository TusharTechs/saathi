import {z} from 'zod';
import {buttonInput,processReport,type Intake} from '../../workflow/src/intake.ts';
import {type State,type Task,type Action,hashCode,nonce,requestId} from './state.ts';
const user=z.object({id:z.number().int().positive(),is_bot:z.boolean().optional()});
const chat=z.object({id:z.number().int(),type:z.string()});
const message=z.object({message_id:z.number().int(),chat,from:user.optional(),text:z.string().optional(),voice:z.object({file_id:z.string(),duration:z.number().nonnegative().optional(),file_size:z.number().nonnegative().optional()}).optional()});
export const updateSchema=z.object({update_id:z.number().int().nonnegative(),message:message.optional(),callback_query:z.object({id:z.string(),from:user,message:message.optional(),data:z.string().optional()}).optional()});
export type Update=z.infer<typeof updateSchema>;
import {checkinQuestions as questions,parseCheckinAnswer} from '../../workflow/src/checkin.ts';
const send=(chatId:number,text:string,buttons?:{text:string;callback_data:string}[][]):Action=>({method:'sendMessage',payload:{chat_id:chatId,text,...(buttons?{reply_markup:{inline_keyboard:buttons}}:{})},status:'pending'});
const help='You are connected to Saathi (synthetic demo). Tell us what is worrying you in your own words, in English, Hindi or Kannada, or send a voice note of up to 30 seconds. The care team will call you back. If the patient is very sick, go to the nearest hospital or call 108. Send /stop to leave.';
/** Language of a typed message from its script: Devanagari is Hindi, Kannada script is Kannada, otherwise the chat's setting. */
export function scriptLanguage(text:string,fallback:string){const deva=(text.match(/[\u0900-\u097F]/g)??[]).length,kan=(text.match(/[\u0C80-\u0CFF]/g)??[]).length;return kan>deva&&kan>0?'kn-IN':deva>0?'hi-IN':fallback==='unknown'?'en-IN':fallback;}
export function receipt(record:{id:string;report:{evaluation:{tier:string|null};processing?:{extraction:{status:string}}}}){return `Synthetic report saved (${record.id}). Demo tier: ${record.report.evaluation.tier??'needs clarification'}. ${record.report.processing?.extraction.status==='failed'?'Extraction failed; the source and any keyword flags remain in the queue. Use /retry or review it on the dashboard.':record.report.processing?.extraction.status==='pending'?'Extraction is still pending; the source and any keyword flags are saved. Check the dashboard before retrying.':'Review the source wording and observations on the dashboard.'} No clinician has been contacted. This bot is a test tool, not a clinical service.`;}
function prompt(chatId:number,draft:NonNullable<State['chats'][string]['draft']>):Action{
 const q=questions[draft.step]!;const choices=q.choices.map(([text,value])=>({text,callback_data:`q:${draft.nonce}:${draft.step}:${value}`}));
 const rows=[];for(let i=0;i<choices.length;i+=q.choices.length>7?4:1)rows.push(choices.slice(i,i+(q.choices.length>7?4:1)));
 rows.push([{text:'Skip / not known',callback_data:`q:${draft.nonce}:${draft.step}:skip`}]);
 return send(chatId,`Synthetic check-in · ${draft.step+1}/${questions.length}\n${q.text}${q.max!==undefined?` Type a whole number from 0 to ${q.max}, or choose below.`:''}\nUnanswered observations stay unknown. /submit saves now.`,rows);
}
/** Only trust updates fetched from Telegram. A private, paired, consenting chat is required. */
export function planUpdate(state:State,raw:unknown,botId:number,now=Date.now(),channel?:{name:'WhatsApp';namespace:string;externalId:string}){
 const update=updateSchema.parse(raw);if(state.pending)throw Error('Complete the pending Telegram update first.');if(update.update_id<state.offset)return;
 const cb=update.callback_query,m=cb?.message??update.message,from=cb?.from??m?.from;
 const valid=m&&from&&!from.is_bot&&m.chat.type==='private'&&m.chat.id===from.id;
 state.pending={updateId:update.update_id,chatId:valid?m.chat.id:0,actions:[]};
 const p=state.pending;if(!valid)return;
 const chatId=m.chat.id,key=String(chatId),text=update.message?.text?.trim()??'';
 if(cb)p.actions.push({method:'answerCallbackQuery',payload:{callback_query_id:cb.id},status:'pending'});
 const reply=(text:string)=>p.actions.push(send(chatId,text));
 if(text==='/stop'){if(!state.chats[key])return;delete state.chats[key];reply('This chat is unlinked. No more reports will be processed. Previously saved synthetic reports remain in the dashboard.');return;}
 if(text==='/start'){reply('This synthetic demo requires a private patient pairing link. Ask the local Saathi operator for a fresh link, or send the complete /start command from that link. No report has been processed.');return;}
 if(text.startsWith('/start')){
  const code=/^\/start ([A-Za-z0-9_-]{32})$/.exec(text)?.[1],invite=code?state.invites[hashCode(code)]:undefined;
  if(!invite||invite.expires<=now||invite.claimedBy){reply('Ask the local Saathi operator for a fresh single-use synthetic patient link. Links expire after 15 minutes.');return;}
  invite.claimedBy=key;const n=nonce();state.chats[key]={patientId:invite.patientId,language:invite.language,pendingNonce:n,pendingUntil:now+15*60*1000};
  p.actions.push(send(chatId,`Linking ${invite.patientId}. This is a synthetic demo, not a clinical service. Send only invented information. Text/voice goes through ${channel?.name??'Telegram'}; audio is transcribed by Sarvam; transcripts go to Groq and are stored in Supabase. No clinician is contacted. Confirm you understand before sending reports.`,[[{text:'I agree · synthetic reports only',callback_data:`consent:${n}`}]]));return;
 }
 const session=state.chats[key];
 if(cb?.data?.startsWith('consent:')){
  if(session?.pendingNonce&&cb.data===`consent:${session.pendingNonce}`&&(session.pendingUntil??0)>now){session.consentAt=now;delete session.pendingNonce;delete session.pendingUntil;reply(help);}else reply('This consent button expired. Request a fresh patient link.');return;
 }
 if(!session?.consentAt||now-session.consentAt>24*60*60*1000){if(!session)return;reply('A fresh patient link and synthetic-only consent are required before processing. Ask the local Saathi operator.');return;}
 if(text==='/help'||text==='/start'){reply(help);return;}
 if(text.startsWith('/language')){const lang=({'en':'en-IN','hi':'hi-IN','kn':'kn-IN','auto':'unknown'} as Record<string,string>)[text.split(/\s+/)[1]??''];if(!lang){reply('Use /language en, /language hi, /language kn or /language auto.');return;}session.language=lang as typeof session.language;reply(`Report language set to ${session.language}. Button questions remain in English.`);return;}
 if(text==='/cancel'){delete session.draft;reply('Button draft discarded. You can send an invented text or voice report.');return;}
 const identity={requestId:channel?requestId(channel.namespace,channel.externalId,'whatsapp'):requestId(botId,update.update_id),externalId:channel?.externalId??`${botId}:${update.update_id}`,patientId:session.patientId,language:session.language};
 if(text==='/retry'){if(session.lastTask){p.task=structuredClone(session.lastTask);reply('Checking your previous synthetic request using the same request ID.');}else reply('There is no previous report to retry.');return;}
 if(text==='/checkin'){session.draft={nonce:nonce(),step:0,answers:{},requestId:identity.requestId};p.actions.push(prompt(chatId,session.draft));return;}
 const submit=()=>{const draft=session.draft!;p.task={...identity,kind:'buttons',requestId:draft.requestId,externalId:channel?.externalId??`${botId}:checkin:${draft.requestId}`,answers:structuredClone(draft.answers)};delete session.draft;};
 if(text==='/submit'){if(session.draft)submit();else reply('No button draft is active. Use /checkin.');return;}
 const draft=session.draft,answer=cb?.data?new RegExp(`^q:${draft?.nonce}:(\\d{1,2}):(.+)$`).exec(cb.data):undefined;
 const numberReply=draft&&questions[draft.step]?.max!==undefined&&/^\d+$/.test(text)?text:undefined;
 const textReply=draft&&questions[draft.step]?.textInput&&text&&!text.startsWith('/')&&text.length<=4000?text:undefined;
 if(cb||numberReply!==undefined||textReply!==undefined){
  if(!draft||(numberReply===undefined&&textReply===undefined&&(!answer||Number(answer[1])!==draft.step))){reply('That button is no longer current. Use the latest question or /checkin.');return;}
  let value;try{value=parseCheckinAnswer(questions[draft.step]!,numberReply??textReply??answer![2]!);}catch{reply('That answer is outside the allowed choices. Use the latest question or skip.');return;}
  if(value!==undefined)(draft.answers as Record<string,unknown>)[questions[draft.step]!.key]=value;
  const evaluated=processReport(buttonInput({requestId:draft.requestId,patientId:session.patientId,answers:draft.answers},{pack:'adult'}),'buttons');
  draft.step++;if(evaluated.evaluation.tier==='RED'||draft.step===questions.length)submit();else p.actions.push(prompt(chatId,draft));return;
 }
 if(text.startsWith('/')){reply(help);return;}
 if(update.message?.voice){const v=update.message.voice;if((v.duration!==undefined&&(v.duration<1||v.duration>30))||(v.file_size??0)>2*1024*1024){reply('Use a synthetic voice note of at most 30 seconds and 2 MB.');return;}p.task={...identity,language:'unknown',kind:'voice',fileId:v.file_id,duration:v.duration,...(v.file_size!==undefined?{size:v.file_size}:{})};}
 else if(text&&text.length<=4000)p.task={...identity,kind:'text',text,language:scriptLanguage(text,session.language) as typeof session.language};
 else reply('Use an invented text report up to 4,000 characters, a short Telegram voice note or /checkin. Other attachments and edited messages are not processed.');
 if(p.task)session.lastTask=structuredClone(p.task);
}
export function queueResult(state:State,text:string){const p=state.pending;if(!p)throw Error('No pending update.');p.actions.push(send(p.chatId,text));if(p.task&&state.chats[String(p.chatId)])state.chats[String(p.chatId)]!.lastTask=structuredClone(p.task);delete p.task;}
export function finishUpdate(state:State){const p=state.pending;if(!p||p.task||p.actions.some(a=>a.status==='pending'||a.status==='sending'))throw Error('Pending work must be completed first.');state.offset=p.updateId+1;delete state.pending;state.deliveries=state.deliveries.slice(-100);}
export type {Task};
