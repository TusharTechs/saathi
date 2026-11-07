import {careContent} from './family-content.ts';
/**
 * Service settings an organisation configures. Call-back targets and family wording were approved by Dr. Krithika S Rao
 * in the clinical review form on 7 Nov 2026 (demo use). Fees are arbitrary placeholders: each organisation sets its own.
 */
export const service={
  callbackMinutes:{RED:30,AMBER:360,GREEN:1440,PENDING:1440} as Record<string,number>,
  callbackTargetsConfirmed:true,
  // RED is routed to the on-call doctor at any time; AMBER and GREEN call-backs are scheduled only in duty hours.
  dutyHours:{start:9*60,end:17*60,days:[1,2,3,4,5,6],label:'9:00–17:00, Monday to Saturday'},
  onCallNumber:'the on-call number on your Saathi leaflet',
  fees:{enabled:true,currency:'INR',byClinician:{duty_doctor:300,specialist:800,nurse:200,psychologist:500} as Record<string,number>,audioCall:300,videoCall:300,followUpWithinDays:15,followUpFactor:0.5},
};
/** Fixed reply once a patient's Saathi follow-up is closed: no reports, reminders or call-backs, only the OPD number. */
export const closedMessage=(name:string)=>`Saathi follow-up for ${name} has been closed by the care team, so reminders and call-backs through Saathi have stopped. For help, please call the palliative care OPD on the number on your hospital card. ${RIDER}`;
export const CLINICIAN_LABEL:Record<string,string>={duty_doctor:'Duty doctor (MBBS)',specialist:'Specialist / consultant',nurse:'Nurse',psychologist:'Psychologist'};
// Family wording below is Dr. Rao's approved text (review form B1-B4, B1-scope, B1-r13), with only typing errors corrected.
export const RIDER='If the patient is very sick, call 108 for an ambulance to take the patient to the nearest hospital, or seek urgent medical help from your local physician.';
export const RED_FAMILY_MESSAGE='The patient’s condition may be critical and cannot be managed through teleconsultation. Please call 108 for an ambulance to take the patient to the nearest hospital, or seek urgent medical help from your local physician now. Our on-call doctor has also been alerted.';
export const END_OF_LIFE_NOTE='Patients receiving end-of-life care at home commonly have these symptoms before death. If this plan has already been discussed with your doctor, follow the prescription and advice given for managing these symptoms, and contact your local physician to assess the patient’s condition.';
export const R13_MESSAGE='We’re sorry this feels so difficult. Please contact your palliative care team or doctor now for urgent support, and let someone you trust stay with you. If you or someone else may be in immediate danger, call emergency services or go to the nearest emergency department now. Do not stay alone while waiting for help. Call 112 for the India national emergency helpline. You can also call Tele-MANAS at 14416 for mental health support. Your doctor has been informed too, and you will receive a call soon.';
export const EMERGENCY_CARD=`1. Your care team has been alerted. A doctor will call you within 30 minutes. You can also call the on-call doctor now: ${service.onCallNumber}.
2. Do not give another extra dose of pain medicine until the doctor speaks to you.
3. Stay with the patient. If they are lying down, turn them gently onto their side.
4. If breathing becomes very slow or stops, or you cannot wake them, call 108 for an ambulance to take the patient to the nearest hospital, or seek urgent medical help from your local physician.
5. Keep the medicine box and this phone with you.`;
/** RED reasons that get the "may be critical" message (B1-scope): breathing, unconscious, seizure, vomiting, severe pain, sudden new symptoms. */
export const CRITICAL_RULES=['R1','R3','R4','R5','R6','R7','R9','R11'];
const hours=(m:number)=>m>=60?`${m/60} hours`:`${m} minutes`;
/** Family-facing replies after a report is saved: fixed approved text only, never generated advice. */
export function familyReplies(tier:string|null,extraction?:string,matched:string[]=[],fields:Record<string,{value:unknown}|undefined>={}):string[]{
  if(tier==='RED'){
    if(matched.includes('R13')&&!matched.some(r=>CRITICAL_RULES.includes(r)))return [R13_MESSAGE];
    if(matched.some(r=>CRITICAL_RULES.includes(r)))return [`${RED_FAMILY_MESSAGE}\n\n${END_OF_LIFE_NOTE}`,EMERGENCY_CARD,...(matched.includes('R13')?[R13_MESSAGE]:[])];
    return [`This needs urgent attention. Our on-call doctor has been alerted and will call you within ${hours(service.callbackMinutes.RED!)}. ${RIDER}`];
  }
  if(extraction&&extraction!=='complete')return [`We received your message. A member of the care team will review it and call you back. ${RIDER}`];
  return [...[tier==='AMBER'?`Thank you. Your concern has been recorded and the care team will call you back within ${hours(service.callbackMinutes.AMBER!)} of working time (${service.dutyHours.label}). ${RIDER}`:`Thank you. Your concern has been recorded and the care team will call you back on the next working day (${service.dutyHours.label}). ${RIDER}`],...careContent(tier,matched,fields)];
}
export const familyReply=(tier:string|null,extraction?:string,matched:string[]=[],fields:Record<string,{value:unknown}|undefined>={})=>familyReplies(tier,extraction,matched,fields).join('\n\n');
/** Greetings that open a conversation instead of becoming a report (shared by WhatsApp and the family chat). */
export const GREETING_PATTERN=/^(hi+|hello|hey|namaste|namaskar|namaskara|good (morning|evening))[\s!.]*$/i;
export const GREETING=`Hello, this is Saathi, the care continuity service of your palliative care team. What is worrying you today? Type it in your own words or send a voice note, and the care team will call you back. ${RIDER}`;
const TZ_OFFSET=330*60000;
const ist=(ms:number)=>new Date(ms+TZ_OFFSET);
const working=(d:Date)=>service.dutyHours.days.includes(d.getUTCDay());
/** Call-back deadline: RED any time; AMBER counts working minutes inside duty hours; GREEN is the end of the next working day. */
export function callbackDue(createdAt:string,tier:string|null){
  const created=Date.parse(createdAt),{start,end}=service.dutyHours;
  if(tier==='RED')return created+service.callbackMinutes.RED!*60000;
  const dayStart=(ms:number)=>{const d=ist(ms);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-TZ_OFFSET;};
  if(tier==='AMBER'){
    let left=service.callbackMinutes.AMBER!,cursor=created;
    for(let i=0;i<14&&left>0;i++){
      const base=dayStart(cursor),open=base+start*60000,close=base+end*60000;
      if(working(ist(base))&&cursor<close){const from=Math.max(cursor,open),used=Math.min(left,(close-from)/60000);if(used>=left)return from+left*60000;left-=used;}
      cursor=base+86400000;
    }
    return cursor;
  }
  let base=dayStart(created)+86400000;for(let i=0;i<14&&!working(ist(base));i++)base+=86400000;return base+end*60000;
}
/** Stable, human-friendly Saathi ID for a patient, shared with the family at registration (FNV-1a, browser-safe). */
export const saathiId=(patientId:string)=>{let h=0x811c9dc5;for(const c of 'saathi-id:'+patientId){h^=c.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0;}return 'SA-'+h.toString(36).toUpperCase().padStart(6,'0').slice(-6);};
