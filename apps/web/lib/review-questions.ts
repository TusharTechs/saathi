import { adultProtocol } from '../../../packages/clinical-content/src/index';
import { RED_FAMILY_MESSAGE, RIDER, service } from '../../../packages/workflow/src/service-config';
import restricted from '../../../packages/clinical-content/src/restricted-drugs.json';
/**
 * Questions for the clinical lead (review pack v3, 3 Nov 2026). Every question offers choices plus an optional
 * details box. Rule questions are generated from the protocol data, so they always match what Saathi runs.
 */
export type Choice=string;
export type Question={id:string;title:string;quote?:string;text?:string;choices:Choice[];multi?:boolean;details?:string;links?:{label:string;href:string}[]};
export type Section={id:string;title:string;intro:string;questions:Question[]};
const APPROVE=['Approve','Approve with small changes (write below)','Change (write below)'];
const CARD=['Approve','Approve with edits (write below)','Remove'];
const RULE=['Approve','Change (write below)','Remove this rule'];
// Plain-language wording of each rule, as shown in review pack v2.
const RULE_TEXT:Record<string,string>={
 "R1": "Patient is very hard to wake or cannot be woken (W5).",
 "R2": "Patient keeps falling asleep while talking or eating (W4).",
 "R3": "Any of: breaths counted over a full minute are 12 or fewer; breathing is very slow or has pauses; or new noisy or rattling breathing while the patient is drowsy (W3–W5).",
 "R4": "Any of: sudden severe breathlessness at rest; blue lips; or face or neck swelling with breathlessness.",
 "R5": "New back pain with leg weakness, or new loss of bladder or bowel control.",
 "R6": "Sudden confusion, or seeing or hearing things that are not there.",
 "R7": "A seizure (fit).",
 "R8": "Any of: heavy bleeding; vomiting blood or coffee-ground material; black stools.",
 "R9": "Vomiting 2 or more times in 24 hours, with a swollen belly and no stool or wind. Is \"repeated\" 2 or more?",
 "R10": "Temperature 38 °C or more, with chemotherapy in the last 6 weeks.",
 "R11": "Sudden pain of 8/10 or more, not helped by the rescue dose.",
 "R12": "A medicine mistake (wrong dose, wrong medicine or double dose).",
 "R13": "Thoughts of self-harm or a crisis, or the caregiver says they are not coping at all.",
 "A1": "3 or more rescue doses in 24 hours (your confirmed rule).",
 "A2": "Pain 7/10 or more despite medicines, or pain 3 or more points above the patient's usual score.",
 "A3": "Vomiting 3 or more times in 24 hours, or unable to keep medicines down.",
 "A4": "No stool for 3 days while on morphine.",
 "A5": "Only sips or mouthfuls, or nothing, for 24 hours or more.",
 "A6": "Newly a little drowsy (W3) within 72 hours of a dose increase.",
 "A7": "New jerking movements.",
 "A8": "Confusion that has come on gradually.",
 "A9": "Wound changes (more bleeding, stronger smell, new discharge or spreading redness), when a wound photo is available. Should a missing photo matter?",
 "A10": "New breathlessness at rest.",
 "A11": "2 or more regular doses missed, or morphine supply for 5 days or fewer.",
 "A12": "Caregiver says they are struggling on 2 check-ins in a row.",
 "A13": "A family question is still unanswered after 2 care-card attempts.",
 "A14": "No check-in for 2 days.",
 "A15": "Breaths counted over a full minute are 13 to 15. Currently switched off, see D2"
};
const yt=(id:string)=>`https://www.youtube.com/watch?v=${id}`;
const VIDEOS:[string,string,string][]=[
 ['C2 Fentanyl patch','Singapore General Hospital · English · 2:57','aPN7DmI_bqY'],
 ['C2 Fentanyl patch','Alexandra Hospital · English · 2:10','qerJ6B0kJ3I'],
 ['C2 Liquid morphine','Cipla Palliative Care · probably Hindi · 5:49','2TilV4mXTtw'],
 ['C2 Liquid morphine','Tan Tock Seng Hospital · English · 2:12','d470Uy_L7eY'],
 ['C12 Counting breaths','Generic nursing clip · English · 2:38','01hB9RoSphc'],
 ['C12 Drowsiness and opioid effects','AIIMS Jodhpur · probably Hindi · 7:55','_DGgPDYq9J4'],
 ['C6 Constipation','Dr Rajasekhar M R · English · 0:58','7sd1qQlyIuM'],
 ['C8 Mouth care','Karunashraya · Kannada · 5:46','5AMHGncd_Tc'],
 ['C8 Mouth care','NHSRC · Hindi · 3:03','vVoG0WFtNTg'],
 ['C13 Pressure care','Karunashraya · Kannada · 12:49','dGknKlhbH9I'],
 ['C13 Pressure care','NHSRC · Hindi · 4:29','o-GSFo6XBVM'],
 ['C10 Breathlessness','Karunashraya · Kannada · 6:50','TvPMJDoe1gQ'],
 ['C10 Breathlessness (handheld fan)','English · 1:59','RY4WajFX6bM'],
 ['C14/C15 Wounds','Karunashraya · Kannada · 5:37','j48q5jD4l6c'],
 ['C14/C15 Wounds','Sri Shankara Cancer Hospital · Hindi · 6:20','FlYNgZCXawI'],
 ['C21/C22 Last days','Karunashraya · Kannada · 13:04','hBTbTrCLSrQ'],
 ['C19 Caregiver self-care','Karunashraya · Kannada · 5:28','r6xga0OY-NQ'],
];
export const SECTIONS:Section[]=[
 {id:'A',title:'Decisions from our call on 3 November',intro:'I wrote these down during our call. Please confirm I understood you correctly.',questions:[
  {id:'A1',title:'What Saathi is',quote:'An extended, out-of-hours support and continuity service. It triages caregiver concerns into a teleconsultation call-back; it does not give treatment by chat.',choices:APPROVE},
  {id:'A2',title:'Check in to Saathi from the hospital record',quote:'At the end of an OPD visit, the doctor clicks "Check in to Saathi" in the hospital system. Saathi receives the patient\'s details, prescription, notes and follow-up plan. For the demo, a dummy hospital page holds one synthetic case.',choices:APPROVE},
  {id:'A3',title:'Reminders',quote:'Morning and evening medicine reminders listed by medicine, refill reminders, OPD appointment reminders and phone follow-up reminders. Families tap "Given" or "Not given" (on WhatsApp or the family web page), which builds the medicine-compliance chart.',choices:APPROVE},
  {id:'A4',title:'What "Acknowledge" means',quote:'Acknowledging a report means it is accepted into the call-back list. It does not close the report. The report closes only after the call, when the doctor writes call notes and the advice given.',choices:APPROVE},
  {id:'A5-red',title:'Call-back time for RED',text:'RED goes to the on-call doctor (junior doctor / PG after 5 pm). Call back within:',choices:['30 minutes','1 hour','2 hours','Other (write below)']},
  {id:'A5-amber',title:'Call-back time for AMBER',text:'The nurse in charge assigns a doctor, nurse or psychologist. You mentioned "6 or 8 hours". Call back within:',choices:['4 hours','6 hours','8 hours','Same working day','Other (write below)']},
  {id:'A5-green',title:'Call-back time for GREEN',text:'Call back within:',choices:['24 hours','Next working day','48 hours','Other (write below)']},
  {id:'A6',title:'Sign-in (changed since review pack v2)',quote:'Doctors, nurses and psychologists see full medical details. Call managers see only counts, urgency, status, patient name and hospital ID, and export a daily PDF. Patients and families sign in with a mobile number or an email address and a password. (One-time codes by SMS or WhatsApp cost about ₹0.12–0.25 each and need paid accounts, so the free demo uses passwords.)',choices:['Approve for the demo','For a real service, one-time codes are a must even if they cost money','Change (write below)']},
  {id:'A7',title:'Fees (optional per organisation)',quote:`A paid service asks for a call-back fee when the family requests a call. Demo: ₹${service.fees.audioCall} for a consultation and half that for a follow-up within ${service.fees.followUpWithinDays} days. NGOs switch fees off. The admin sees a "fee paid" checklist. No payment is collected in the demo.`,choices:['Approve these amounts','Approve, but change the amounts (write below)','Change (write below)']},
  {id:'A8',title:'Prescriptions after a teleconsult (changed since review pack v2)',quote:'After the call the doctor may write a prescription with their registration number. Saathi blocks Schedule X, narcotic and psychotropic (NDPS) drugs and anti-cancer drugs, and signs the prescription electronically. The family sees it on their web page (WhatsApp later). Records are kept for 3 years under the DPDP Act and IT rules.',choices:APPROVE},
  {id:'A9',title:'Demo language and channel',quote:'English replies for the demo; families can write or speak in English, Hindi or Kannada. WhatsApp and a web page for families. Telegram is not needed.',choices:APPROVE},
 ]},
 {id:'B',title:'Messages families receive',intro:'Families only ever receive text you have approved, word for word.',questions:[
  {id:'B1',title:'Message on a RED report (your wording from the call)',quote:RED_FAMILY_MESSAGE,choices:['Approve the wording','Approve with edits (write below)']},
  {id:'B1-scope',title:'Which RED reports should get this message?',choices:['Every RED rule','Only some RED rules (list them below)']},
  {id:'B1-r13',title:'"Caregiver not coping" or self-harm thoughts (rule R13)',text:'Should this RED get the same "go to the nearest hospital" message?',choices:['Same message','A different message (write it below)']},
  {id:'B2',title:'Message on AMBER or GREEN',quote:`Thank you. Your concern has been recorded and the care team will call you back within [6 hours / 24 hours]. ${RIDER}`,choices:CARD},
  {id:'B3',title:'Notice at registration and in every reply',quote:'Saathi is a support service for patients already under our care. It is not an emergency service. If the patient is very sick, go to the nearest hospital or call 108 immediately.',choices:['Approve','Approve with edits (write below)','Wait for the lawyer\'s wording']},
  {id:'B4',title:'Emergency card (older draft)',quote:'1. Your care team has been alerted. A doctor will call you within [N] minutes. 2. Do not give another extra dose of pain medicine until the doctor speaks to you. 3. Stay with the patient; if lying down, turn them gently onto their side. 4. If breathing becomes very slow or stops, or you cannot wake them, call 108 now. 5. Keep the medicine box and this phone with you.',choices:['Keep it, in addition to the RED message','Replace it with the RED message (B1)','Approve with edits (write below)']},
  {id:'B5',title:'Card C6 · Constipation while taking morphine',quote:'1. Morphine almost always causes constipation. 2. Give the laxative every day, even if the patient has passed stool. 3. Offer fluids often. 4. Gentle movement helps. 5. Tell the team if there is no stool for 3 days, or if there is belly pain or vomiting.',choices:CARD},
  {id:'B6',title:'Card C12 · Counting breaths and checking drowsiness',quote:'Counting breaths: wait until the patient is resting quietly. Watch or feel the chest or tummy rise. Count each rise for one full minute by the phone timer. 12 or fewer → the doctor is alerted. Checking drowsiness: call their name and talk to them. If they keep falling asleep while talking or eating, or are hard to wake, the doctor is alerted immediately.',choices:CARD},
  {id:'B7',title:'Card C2 · Giving opioid medicines and applying a fentanyl patch',text:'The full draft (liquid morphine steps and nine fentanyl patch steps) is in the app\'s clinical review desk. Given the guidance not to advise on medicines by WhatsApp, should families receive it?',choices:['Yes, send it to families (after I approve the text)','Only for staff, not families','Remove it']},
 ]},
 {id:'C',title:'Triage rules: when is a report RED or AMBER?',intro:'Saathi applies these rules exactly as written; the AI never decides urgency. Drowsiness levels: W1 awake and talking · W2 sleeping, wakes easily · W3 a little drowsy, stays awake · W4 keeps falling asleep while talking or eating · W5 very hard to wake or cannot be woken.',questions:[
  ...adultProtocol.rules.map(r=>({id:`C-${r.id}`,title:`${r.id} · ${r.tier}`,quote:RULE_TEXT[r.id]??r.label,choices:r.id==='A15'?['Switch on as AMBER','Keep switched off','Change (write below)']:RULE})),
  {id:'C-R9-repeat',title:'R9: what counts as "repeated" vomiting?',choices:['2 or more times in 24 hours','3 or more times in 24 hours','Other (write below)']},
  {id:'C-A9-photo',title:'A9: if no wound photo is available',choices:['A missing photo should not matter','Ask the family for a photo on the call','Other (write below)']},
 ]},
 {id:'D',title:'Questions only you can answer',intro:'',questions:[
  {id:'D1',title:'Is any emergency missing?',text:'Tick any that should be RED or AMBER but are not covered above, and say which in the box.',multi:true,choices:['Uncontrolled agitation or restlessness','Unable to swallow medicines','A fall','Bleeding from a wound','Severe mouth or throat pain stopping eating or drinking','Nothing is missing','Other (write below)']},
  {id:'D3',title:'Safety test (60 invented messages in English, Hindi and Kannada)',text:'Saathi caught 27 of 30 expected REDs. It missed "seeing people who are not there" in Hindi and "I am not coping at all" in Hindi and Kannada. Could you check the test labels and add about 20 cases from your experience, with details changed?',choices:['Yes, I will do it before the finale','Later, after the submission','No']},
  {id:'D4',title:'The dummy hospital case',text:'One synthetic case for the dummy hospital page: name, age, address, diagnosis, current prescription (medicine, dose, morning/evening timing, rescue dose), notes and follow-up plan.',choices:['I have written it below','I will send it on WhatsApp or email','Use Tushar\'s placeholder case for the demo'],details:'Write the case here (any format is fine)'},
  {id:'D5',title:'Videos for families',text:'Tick the videos families may receive. Tap a title to watch it first.',multi:true,choices:[...VIDEOS.map(([card,src])=>`${card} — ${src}`),'None for the demo'],links:VIDEOS.map(([card,src,id])=>({label:`${card} — ${src}`,href:yt(id)}))},
  {id:'D5-record',title:'Record our own short videos?',text:'There is no Hindi or Kannada fentanyl-patch video. Could we record a 2-minute Kannada video at KMC (patch and counting breaths)?',choices:['Yes','Maybe later','No']},
  {id:'D6',title:'Children\'s pack',text:'Adult rules are never applied to children.',choices:['Leave children out of the demo','Include the children\'s pack (GREEN/RED only)']},
 ]},
 {id:'E',title:'New since review pack v2',intro:'',questions:[
  {id:'E1',title:'Drugs blocked on teleconsult prescriptions',text:`Saathi refuses these on teleconsult prescriptions (drafted by Tushar from the Telemedicine Practice Guidelines 2020): ${restricted.categories.map(c=>`${c.label}: ${c.names.join(', ')}`).join('. ')}.`,choices:['Approve the list','Approve, with additions or removals (write below)','Change (write below)']},
  {id:'E2',title:'Automatic nursing replies',text:'You wanted simple nursing advice sent automatically when a family asks a matching question, using only text you write. Please write the question and the exact reply for each.',choices:['I have written them below','I will send them later','No automatic replies for the demo'],details:'For example: Q: "Can I give food through the feeding tube at night?" A: "..."'},
  {id:'E3',title:'Service terms and consent wording',text:'The draft terms page is labelled "draft, awaiting legal review".',choices:['Use the draft for the demo','I will send my lawyer friend\'s wording','Change (write below)'],links:[{label:'Open the draft terms page',href:'/terms'}]},
  {id:'E4',title:'Anything else?',text:'Anything about the app, the demo or the finale presentation.',choices:['All good','I have notes (write below)']},
 ]},
];
export const QUESTION_IDS=SECTIONS.flatMap(s=>s.questions.map(q=>q.id));
