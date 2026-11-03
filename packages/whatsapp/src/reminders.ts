import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Action} from '../../telegram/src/state.ts';
import {SLOTS,SLOT_TIME,type CarePlan,type CarePlanEntry,type Slot} from '../../workflow/src/care-plan.ts';
import {RIDER} from '../../workflow/src/service-config.ts';
import {WhatsAppError} from './api.ts';
import type {Inbound} from './store.ts';
/**
 * Medicine, refill and appointment reminders from a checked-in care plan. Saathi only sends free messages
 * inside the 24-hour window after the family's last message; otherwise the reminder is recorded as
 * window_closed. A production service would need Meta-approved utility templates, which are paid.
 */
const DAY=86400000,TZ='Asia/Kolkata';
const istParts=(ms:number)=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,minutes:Number(p.hour)*60+Number(p.minute)};};
const toMinutes=(hhmm:string)=>Number(hhmm.slice(0,2))*60+Number(hhmm.slice(3));
const nice=(d:string)=>new Date(d+'T12:00:00+05:30').toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
const sentSchema=z.object({key:z.string(),at:z.string(),status:z.enum(['sending','accepted','failed','unknown','window_closed'])});
const stateSchema=z.object({version:z.literal(1),lastInbound:z.record(z.string(),z.number()),sent:z.array(sentSchema),demoRequests:z.array(z.object({patientId:z.string(),slot:z.enum(SLOTS)})).default([])});
type State=z.infer<typeof stateSchema>;
import type {Cloud} from '../../workflow/src/cloud-docs.ts';
export class ReminderState {
 constructor(private directory:string,private cloud?:Cloud){}
 async transact<T>(operation:(s:State)=>T):Promise<T>{
  if(this.cloud)return this.cloud.docs.transact(this.cloud.key,raw=>raw==null?{version:1 as const,lastInbound:{},sent:[],demoRequests:[]}:stateSchema.parse(raw),operation,true,s=>{s.sent=s.sent.slice(-1000);return stateSchema.parse(s);});
  await mkdir(this.directory,{recursive:true,mode:0o700});const lock=join(this.directory,'reminders.lock');let acquired=false;
  for(let i=0;i<100;i++){try{await mkdir(lock);acquired=true;break;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw Error('Reminder state lock failed.');await new Promise(r=>setTimeout(r,25));}}
  if(!acquired)throw Error('Reminder state is locked. Stop workers before inspecting a stale lock.');
  const file=join(this.directory,'reminders.json'),temporary=join(this.directory,`reminders-${randomUUID()}.tmp`);
  try{
   let state:State={version:1,lastInbound:{},sent:[],demoRequests:[]};try{state=stateSchema.parse(JSON.parse(await readFile(file,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw Error('Reminder state could not be read. Existing state was preserved.');}
   const result=operation(state);state.sent=state.sent.slice(-1000);await writeFile(temporary,JSON.stringify(stateSchema.parse(state)),{mode:0o600});await rename(temporary,file);return structuredClone(result);
  }finally{await rm(temporary,{force:true});await rm(lock,{recursive:true,force:true});}
 }
 snapshot(){return this.transact(s=>s);}
 /** Asks the running worker to send one slot's medicine reminder now, for a live demonstration. */
 requestDemo(patientId:string,slot:Slot){return this.transact(s=>{s.demoRequests.push({patientId,slot});});}
}
type Due={key:string;sender:string;text:string;buttons?:{text:string;callback_data:string}[]};
/** Pure: which reminders are due now for one patient, given what was already sent. */
export function dueReminders(entry:CarePlanEntry,patientId:string,sender:string,now:number,sentKeys:Set<string>,demo:Slot[]=[]):Due[]{
 const {plan}=entry,{date,minutes}=istParts(now),tomorrow=istParts(now+DAY).date,out:Due[]=[];
 const welcome=`welcome:${patientId}:${entry.checkedInAt}`;
 if(!sentKeys.has(welcome)){
  const times=SLOTS.filter(s=>plan.medications.some(m=>!m.rescue&&m.slots.includes(s))).map(s=>`${s} ${SLOT_TIME[s]}`).join(', ');
  out.push({key:welcome,sender,text:`Saathi has received ${plan.demographics.name}'s care plan from ${plan.hospital.name}. You will get medicine reminders on WhatsApp (${times||'none scheduled'}), plus refill and appointment reminders. Message us any time with a concern and the care team will call you back. ${RIDER}`});
 }
 const slotMessage=(slot:Slot,key:string)=>{
  const meds=plan.medications.filter(m=>!m.rescue&&m.slots.includes(slot));if(!meds.length)return;
  out.push({key,sender,text:[`Saathi medicine reminder · ${slot} (${SLOT_TIME[slot]})`,...meds.map(m=>`• ${m.name} ${m.dose}${m.instructions?` · ${m.instructions}`:''}`),`Tap a button when done. This reminder follows the prescription from ${plan.hospital.consultant}.`].join('\n'),
   buttons:[{text:'All given',callback_data:`dose:${date}:${slot}:given`},{text:'Not given',callback_data:`dose:${date}:${slot}:not_given`}]});
 };
 for(const slot of SLOTS){const at=toMinutes(SLOT_TIME[slot]),key=`dose:${patientId}:${date}:${slot}`;if(minutes>=at&&minutes<at+120&&!sentKeys.has(key))slotMessage(slot,key);}
 for(const slot of demo)slotMessage(slot,`demo:${patientId}:${date}:${slot}:${now}`);
 // Appointment and refill reminders go out the evening before (18:00–21:00 IST).
 if(minutes>=18*60&&minutes<21*60)for(const a of plan.appointments.filter(a=>a.date===tomorrow)){
  const key=`appt:${patientId}:${a.kind}:${a.date}`;if(sentKeys.has(key))continue;
  const what=a.kind==='opd_visit'?`OPD visit at ${plan.hospital.name} tomorrow (${nice(a.date)})${a.time?` at ${a.time}`:''}`:a.kind==='phone_followup'?`phone follow-up call from the care team tomorrow (${nice(a.date)})${a.time?` around ${a.time}`:''}`:`medicine refill due tomorrow (${nice(a.date)})`;
  out.push({key,sender,text:`Saathi reminder: ${what}.${a.note?` ${a.note}.`:''}`});
 }
 return out;
}
export const doseButton=/^dose:(\d{4}-\d{2}-\d{2}):(morning|afternoon|evening|night):(given|not_given)$/;
type Store={carePlans():Promise<Record<string,CarePlanEntry>>;logDose(patientId:string,doseKey:string,dueDate:string,slot:Slot,status:'given'|'not_given',source:'whatsapp'|'web'):Promise<void>};
type Sender={send(action:Action,receivedAt:number):Promise<unknown>};
type Chats=Record<string,{patientId?:string;consentAt?:number}>;
export class Reminders {
 private lastCheck=0;
 constructor(private state:ReminderState,private store:Store,private api:Sender,private log:(event:object)=>void=()=>{},private interval=30000){}
 seen(m:Inbound){return this.state.transact(s=>{s.lastInbound[m.from]=Math.max(s.lastInbound[m.from]??0,m.timestamp*1000);});}
 /** Logs a "Given"/"Not given" tap for every scheduled medicine in that slot and confirms it. Returns false for other messages. */
 async inbound(m:Inbound,chats:Chats){
  const match=m.kind==='button'?doseButton.exec(m.buttonId??''):null,chat=chats[m.from];if(!match||!chat?.patientId)return false;
  const [,date,slot,status]=match as unknown as [string,string,Slot,'given'|'not_given'];
  const plan:CarePlan|undefined=(await this.store.carePlans())[chat.patientId]?.plan;
  const meds=plan?.medications.filter(x=>!x.rescue&&x.slots.includes(slot))??[];
  for(const med of meds)await this.store.logDose(chat.patientId,med.key,date,slot,status,'whatsapp');
  const text=!meds.length?'That reminder no longer matches the current prescription. The care team has the latest plan.':status==='given'?`Thank you. ${slot} medicines recorded as given.`:`Recorded that the ${slot} medicines were not given. If you are unsure what to do, message us your concern and the care team will call you back. ${RIDER}`;
  try{await this.api.send({method:'sendMessage',status:'pending',payload:{chat_id:Number(m.from),text}},m.timestamp*1000);}catch(e){this.log({event:'dose_reply',status:e instanceof WhatsAppError&&e.kind!=='unknown'?'failed':'unknown'});}
  this.log({event:'dose_logged',status,count:meds.length});return true;
 }
 async check(chats:Chats,now=Date.now()){
  if(now-this.lastCheck<this.interval)return;this.lastCheck=now;
  const s=await this.state.transact(x=>{for(const a of x.sent)if(a.status==='sending')a.status='unknown';const demo=x.demoRequests;x.demoRequests=[];return {...x,demo};});
  const plans=await this.store.carePlans(),sentKeys=new Set(s.sent.map(x=>x.key));
  for(const [sender,chat] of Object.entries(chats)){
   const entry=chat.patientId?plans[chat.patientId]:undefined;if(!entry||!chat.consentAt)continue;
   const demo=s.demo.filter(d=>d.patientId===chat.patientId).map(d=>d.slot);
   for(const due of dueReminders(entry,chat.patientId!,sender,now,sentKeys,demo)){
    const last=s.lastInbound[sender]??0,open=now-last<DAY-60000;
    await this.state.transact(x=>{x.sent.push({key:due.key,at:new Date(now).toISOString(),status:open?'sending':'window_closed'});});sentKeys.add(due.key);
    if(!open){this.log({event:'reminder',status:'window_closed'});continue;}
    let status:'accepted'|'failed'|'unknown'='accepted';
    try{await this.api.send({method:'sendMessage',status:'pending',payload:{chat_id:Number(sender),text:due.text,...(due.buttons?{reply_markup:{inline_keyboard:[due.buttons]}}:{})}},last);}catch(e){status=e instanceof WhatsAppError&&e.kind!=='unknown'?'failed':'unknown';}
    await this.state.transact(x=>{const a=x.sent.find(a=>a.key===due.key);if(a)a.status=status;});this.log({event:'reminder',status});
   }
  }
 }
}
