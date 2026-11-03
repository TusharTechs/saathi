import { z } from 'zod';
import { inputSchema, type Input } from '../../shared/src/index.ts';
import { evaluate, type Evaluation } from '../../rules-engine/src/index.ts';
import { scanSafetyNet } from './safety-net.ts';

export const intakeSchema=z.object({
  requestId:z.uuid(),patientId:z.string().min(1).max(80),
  scenario:z.enum(['urgent','review','complete','incomplete']).optional(),
  answers:z.object({
    pain:z.number().int().min(0).max(10).optional(),
    rescue:z.number().int().min(0).max(100).optional(),
    wakefulness:z.enum(['W1','W2','W3','W4','W5']).optional(),
    breathing:z.enum(['normal','breathless_moving','breathless_rest','very_slow_or_pauses','noisy_rattling']).optional(),
    respiratoryRate:z.number().int().min(0).max(120).optional(),
    fullMinute:z.boolean().optional(),
    nausea:z.enum(['none','feels_sick','vomited']).optional(),
    vomitCount:z.number().int().min(0).max(100).optional(),
    vomitAppearance:z.enum(['none','food','green_yellow','blood_or_coffee']).optional(),
    stoolDays:z.number().int().min(0).max(365).optional(),
    intake:z.enum(['usual','less','mouthfuls_sips','nothing']).optional(),
    confusion:z.enum(['no','gradual','sudden','hallucinations']).optional(),
    legSwelling:z.enum(['no','same','more']).optional(),
    missedDoses:z.number().int().min(0).max(100).optional(),
    coping:z.enum(['managing','struggling','not_coping']).optional(),
    concerns:z.string().trim().max(4000).optional(),
  }).strict(),
}).strict();
export type Intake = z.infer<typeof intakeSchema>;
export const originSchema=z.discriminatedUnion('channel',[z.object({channel:z.literal('telegram'),externalId:z.string().regex(/^[0-9]+:(?:[0-9]+|checkin:[0-9a-f-]{36})$/)}).strict(),z.object({channel:z.literal('whatsapp'),externalId:z.string().regex(/^wamid\.[A-Za-z0-9+/=_-]{1,500}$/)}).strict()]);
export type Origin=z.infer<typeof originSchema>;
export const processingSchema=z.object({
 language:z.string().max(30),
 transcription:z.object({provider:z.literal('sarvam'),model:z.literal('saaras:v4')}).optional(),
 extraction:z.object({provider:z.literal('groq'),model:z.literal('openai/gpt-oss-120b'),status:z.enum(['pending','complete','failed']),failureCode:z.string().max(50).optional()}),
}).strict();
export type Processing=z.infer<typeof processingSchema>;
export type Report = {input:Input; evaluation:Evaluation; safetyNet:ReturnType<typeof scanSafetyNet>; source:'buttons'|'synthetic_fixture'|'voice'|'text'; needsTextReview:boolean;processing?:Processing;origin?:Origin};
export function processReport(input: Input, source:Report['source'], needsTextReview=false): Report {
  const parsed=inputSchema.parse(input);
  const evaluation=evaluate(parsed);
  // Structured fixtures use schema keys as text; scan real button/narrative reports only.
  const safetyNet=source==='synthetic_fixture'?[]:scanSafetyNet(parsed.messages);
  if(parsed.context.pack==='adult' && safetyNet.length) {
    evaluation.tier='RED';
    evaluation.matched=[...evaluation.matched,...safetyNet.map(h=>`safety_net:${h.id}:${h.language}`)];
  }
  if(needsTextReview && evaluation.status!=='unsupported_pack') {
    evaluation.status='needs_followup';
    if(evaluation.tier==='GREEN') evaluation.tier=null;
  }
  return {input:parsed,evaluation,safetyNet,source,needsTextReview};
}
export function buttonInput(request:Intake, context:Input['context']):Input {
  const lines: {key:keyof Input['fields'];value:string|number|boolean;quote:string}[]=[];
  const a=request.answers;
  if(a.pain!==undefined) lines.push({key:'pain_now',value:a.pain,quote:`Pain now: ${a.pain}/10`});
  if(a.rescue!==undefined) lines.push({key:'rescue_doses_24h',value:a.rescue,quote:`Extra doses in 24 hours: ${a.rescue}`});
  const wording={W1:'Awake and talking normally',W2:'Sleeping, wakes easily when called',W3:'A little drowsy, wakes easily and stays awake',W4:'Keeps falling asleep while talking or eating',W5:'Very hard to wake, or cannot be woken'};
  if(a.wakefulness) lines.push({key:'wakefulness',value:a.wakefulness,quote:wording[a.wakefulness]});
  const breathing={normal:'Breathing: normal',breathless_moving:'Breathing: breathless when moving',breathless_rest:'Breathing: breathless at rest',very_slow_or_pauses:'Breathing: very slow or long pauses',noisy_rattling:'Breathing: noisy or rattling'};
  if(a.breathing) lines.push({key:'breathing',value:a.breathing,quote:breathing[a.breathing]});
  if(a.respiratoryRate!==undefined) lines.push({key:'resp_rate_per_min',value:a.respiratoryRate,quote:`Counted breaths: ${a.respiratoryRate}`});
  if(a.fullMinute!==undefined) lines.push({key:'resp_count_full_minute',value:a.fullMinute,quote:`Counted for a full minute: ${a.fullMinute?'yes':'no'}`});
  const extra: [keyof typeof a,keyof Input['fields'],string][]=[
    ['nausea','nausea_vomiting','Nausea or vomiting'],['vomitCount','vomit_count_24h','Vomiting episodes in 24 hours'],
    ['vomitAppearance','vomit_appearance','Vomit appearance'],['stoolDays','days_since_stool','Days since last stool'],
    ['intake','intake','Eating and drinking'],['confusion','confusion','Confusion or restlessness'],
    ['legSwelling','leg_swelling','Feet or leg swelling'],['missedDoses','missed_regular_doses','Regular doses missed in 24 hours'],
    ['coping','caregiver_coping','Caregiver coping'],
  ];
  for(const [answer,key,label] of extra){const value=a[answer];if(value!==undefined)lines.push({key,value,quote:`${label}: ${String(value).replaceAll('_',' ')}`});}
  const id=request.requestId;
  return {context, messages:[{id,text:[...lines.map(l=>l.quote),a.concerns].filter(Boolean).join('\n')||'No answers supplied'}],
    fields:Object.fromEntries(lines.map(l=>[l.key,{value:l.value,confidence:1,quote:l.quote,messageId:id}]))};
}
