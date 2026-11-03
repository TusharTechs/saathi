'use client';
import { useCallback, useEffect, useState } from 'react';
import type { RecordEntry } from '../../../../packages/workflow/src/index';
type Queue={records:RecordEntry[];patients:{id:string;name:string}[];storage:'local'|'supabase'|null};
type Score={cases:number;run:number;redExpected:number;redCaught:number;falseRed:number};
type Evaluation={keyword:Score|null;live:Score&{complete:boolean;total:number}};
type Status='context'|'live'|'demo'|'approval'|'progress'|'planned';
const STATUS:Record<Status,string>={context:'Context',live:'Working live',demo:'Working · demo only',approval:'Needs Dr. Krithika’s approval',progress:'In progress',planned:'Not built yet'};
type Live={reports:number;channels:Record<string,number>;open:Record<string,number>;events:number;escalated:number;latest?:RecordEntry;patient?:string;evaluation:Evaluation|null;storage:Queue['storage']};
type Step={chapter:string;title:string;status:Status;what:string;flow?:string[];live?:(l:Live)=>React.ReactNode;cta?:{label:string;href:string}[];say:string;ask?:string;body?:React.ReactNode};
const tier=(r:RecordEntry)=>r.report.evaluation.tier??'PENDING';
const when=(at:string)=>new Date(at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const Stat=({n,label}:{n:React.ReactNode;label:string})=><div className="tour-stat"><strong>{n}</strong><span>{label}</span></div>;
const steps:Step[]=[
 {chapter:'Why Saathi',title:'Families are far away, and the doctor cannot see between visits',status:'context',
  what:'Patients travel to KMC Manipal from across Karnataka. Between visits, the only channel is an unstructured phone call that interrupts OPD and carries no objective history.',
  body:<div className="tour-grid3"><div className="tour-card"><b>Distance</b><p>Each visit costs a day’s wages and exhausts a bedbound patient.</p></div><div className="tour-card"><b>Caregivers</b><p>Families struggle with oral morphine, fentanyl patches and spotting oversedation.</p></div><div className="tour-card"><b>The doctor</b><p>Calls interrupt OPD. Urgent problems surface late.</p></div><div className="tour-stats tour-wide"><Stat n="7M+" label="Indians need palliative care each year (Lancet Commission)"/><Stat n="1–4%" label="of them can access it"/><Stat n="~49%" label="of 911 listed centres had morphine (Pallium India)"/></div></div>,
  say:'This is the problem you described. Everything that follows is built around your protocol, not around the AI.',ask:'Are these still the top three problems? Which one matters most to your team?'},
 {chapter:'Why Saathi',title:'AI listens. The doctor decides.',status:'context',
  what:'The language model only transcribes and fills a fixed check-in form, keeping the family’s exact words. Urgency comes only from deterministic rules written from your protocol.',
  body:<div className="tour-grid2"><div className="tour-card good"><b>The AI does</b><ul><li>Transcribe voice notes</li><li>Fill check-in fields with the exact quote</li><li>Flag unclear answers for a human</li></ul></div><div className="tour-card bad"><b>The AI never</b><ul><li>Decides how urgent something is</li><li>Interprets symptoms, wounds or photos</li><li>Writes medical advice in its own words</li><li>Gives a prognosis or risk score</li></ul></div></div>,
  say:'This keeps us inside the hackathon rules: no diagnosis, no treatment advice, no clinical risk scoring.'},
 {chapter:'For families',title:'A family joins privately, with consent',status:'live',
  what:'The care team creates a private 15-minute link. The family opens it in WhatsApp (or Telegram), sends the prefilled code and agrees to synthetic-only use. Consent lasts 24 hours.',
  flow:['Private pairing link','/start code','Synthetic-only consent','Linked to a patient'],
  live:l=><div className="tour-stats"><Stat n={l.channels.whatsapp??0} label="WhatsApp reports saved"/><Stat n={l.channels.telegram??0} label="Telegram reports saved"/><Stat n={l.channels.web??0} label="Web reports saved"/></div>,
  say:'Messages from anyone who has not paired are discarded without storing their content. /stop unlinks a family immediately.'},
 {chapter:'For families',title:'A two-minute daily check-in',status:'live',
  what:'Sixteen short questions cover all twelve daily topics: pain, rescue doses, drowsiness, breathing and a full-minute count, vomiting, bowels, eating, confusion, swelling, missed doses, concerns and how the caregiver is coping.',
  flow:['Tap buttons','Skip anything unknown','A RED answer saves at once','Report reaches the team'],
  cta:[{label:'Try the check-in',href:'/?view=intake'}],
  say:'Unknown stays unknown. We never fill in a missing answer. If an answer already meets a RED rule, the report is saved immediately instead of waiting for the rest.'},
 {chapter:'For families',title:'Voice notes and typed reports in Kannada, Hindi or English',status:'live',
  what:'A family can simply speak. Sarvam transcribes the voice note; the model fills the check-in fields and must quote the exact words for each one. A keyword safety net runs in parallel, so a model miss cannot drop a RED.',
  flow:['Voice note (≤30 s)','Sarvam transcript','Fields with exact quotes','Keyword safety net','Your rules'],
  cta:[{label:'Open voice and text intake',href:'/?view=intake'}],
  say:'Every extracted field carries the caregiver’s own words. If a quote is not found word for word in the transcript, the field is rejected.'},
 {chapter:'For the care team',title:'Your protocol decides urgency',status:'demo',
  what:'28 rules, 13 RED and 15 AMBER, are stored as data, so your edits are configuration changes rather than code. The engine is a pure function with unit tests for every rule.',
  flow:['Check-in fields','Deterministic rules','RED · AMBER · needs review'],
  cta:[{label:'Open the clinical review desk',href:'/?view=review'}],
  say:'Today the protocol is labelled demo-only and unsigned. Nothing is presented as approved by you until you approve it.',ask:'Can you review and sign the rule register? Should 13–15 breaths per minute be AMBER for adults?'},
 {chapter:'For the care team',title:'One prioritised list',status:'live',
  what:'Every report lands in a single queue ordered RED, AMBER, needs-clarification, then complete, newest first within each group.',
  live:l=><div className="tour-stats"><Stat n={l.open.RED??0} label="Open RED"/><Stat n={l.open.AMBER??0} label="Open AMBER"/><Stat n={l.open.PENDING??0} label="Needs clarification"/><Stat n={l.reports} label="Reports saved in total"/></div>,
  cta:[{label:'Open the care queue',href:'/'}],
  say:'Your team sees what needs attention first, instead of whoever happened to phone first.'},
 {chapter:'For the care team',title:'Every alert shows why',status:'live',
  what:'Each report shows the family’s words, the extracted value, the rule it matched and the protocol version, followed by every human action with a timestamp.',
  flow:['Family’s words','Extracted field','Rule + version','Who responded, when'],
  live:l=>l.latest?<div className="tour-latest"><span className={`pill ${tier(l.latest).toLowerCase()}`}>{tier(l.latest)}</span><div><b>Latest WhatsApp report · {l.patient}</b><p>{when(l.latest.createdAt)} · rules {l.latest.report.evaluation.matched.join(', ')||'none'} · {l.latest.events.length} audit event{l.latest.events.length===1?'':'s'}</p></div></div>:<p className="muted">No WhatsApp report yet.</p>,
  cta:[{label:'Open the care queue',href:'/'}],
  say:'If anyone asks why Saathi raised an alert, the answer is on screen, in the family’s own words.'},
 {chapter:'For the care team',title:'Nobody is left waiting',status:'demo',
  what:'Every new RED, from any channel, goes straight to the on-call doctor’s WhatsApp with the matched rules and an Acknowledge button. Until someone acknowledges, the report escalates every 15 minutes, from doctor 1 to doctor 2 to the coordinator, and every step is written to the audit trail.',
  flow:['RED saved','WhatsApp alert to on-call','Tap Acknowledge','Escalation stops'],
  live:l=><div className="tour-stats"><Stat n={l.escalated} label="Escalation steps recorded"/><Stat n={l.events} label="Audit events in total"/></div>,
  say:'WhatsApp only allows free messages within 24 hours of the doctor’s last message, so the on-call doctor sends /oncall at the start of each shift. If that lapses, Saathi records the missed alert instead of paying for one. The escalation roles are still simulated.',ask:'What call-back time should we promise for RED, and review time for AMBER? Who is first on call?'},
 {chapter:'For the care team',title:'The whole story before the call',status:'live',
  what:'The patient timeline brings every report together with its source words and audit history. A copyable pre-call summary lists the latest observations, what is still unknown and earlier unresolved REDs.',
  cta:[{label:'Open the patient timeline',href:'/?view=patients'}],
  say:'The summary is assembled by rules from saved records. It is not an AI-written assessment.'},
 {chapter:'Standards and safety',title:'ABDM-ready records',status:'demo',
  what:'Any report can be exported as a FHIR R4 bundle: patient, observations with the caregiver’s quotes, the protocol routing and provenance. The ABHA number is simulated and labelled as such, and every resource carries the HL7 test-data label.',
  flow:['Saved report','FHIR R4 bundle','Hospital system (ABDM-registered)'],
  live:l=>l.latest?<a className="tour-button" href={`/api/fhir/${l.latest.id}`} download>Download FHIR for the latest WhatsApp report</a>:<p className="muted">Save a report to export it.</p>,
  say:'Individual developers cannot get ABDM sandbox access. The realistic design is that KMC’s hospital system, already the registered facility, receives these records.',ask:'Is KMC’s hospital system registered with ABDM? Could MAHE apply for sandbox access as an organisation?'},
 {chapter:'Standards and safety',title:'Safety evaluation',status:'progress',
  what:'60 invented caregiver messages, 20 each in English, Hindi and Kannada, labelled with the expected tier. We measure how many expected REDs Saathi catches and how many false alarms it raises.',
  live:l=>{const e=l.evaluation;if(!e)return <p className="muted">Evaluation results are not available.</p>;return <div className="tour-stats">
    {e.keyword&&<Stat n={`${e.keyword.redCaught}/${e.keyword.redExpected}`} label="REDs caught by keywords alone"/>}
    <Stat n={`${e.live.run}/${e.live.total}`} label={e.live.complete?'Model cases completed':'Model cases run so far'}/>
    <Stat n={`${e.live.redCaught}/${e.live.redExpected}`} label={e.live.complete?'REDs caught by the full pipeline':'REDs caught by the full pipeline, so far'}/>
    <Stat n={e.live.falseRed} label="False RED alarms"/></div>;},
  say:'Keywords alone miss most REDs. That is exactly why we combine them with the model and your rules. These labels are engineering drafts until you review them.',ask:'Could you label these 60 cases and add about 20 from your own experience, with details changed?'},
 {chapter:'Standards and safety',title:'Privacy and consent',status:'live',
  what:'Synthetic data only. Webhooks are accepted only with Meta’s signature. Database tables are closed to public access. Voice audio is never saved. Families can leave with /stop and request deletion.',
  cta:[{label:'Open the privacy policy',href:'https://tushartechs.github.io/saathi-privacy/'},{label:'Data deletion page',href:'https://tushartechs.github.io/saathi-privacy/data-deletion.html'}],
  say:'We have not used any real patient data, and the current free tools must not receive it.'},
 {chapter:'For families',title:'Care cards and short videos',status:'approval',
  what:'Draft cards exist for the emergency message, giving opioids and applying a fentanyl patch, constipation, and counting breaths and checking drowsiness. More than 20 videos are shortlisted from Karunashraya (Kannada), NHSRC (Hindi), hospitals and CanSupport. None has been sent to a family.',
  flow:['Check-in saved','Your approved card, word for word','Approved video'],
  cta:[{label:'See the drafts',href:'/?view=review'}],
  say:'Families will only ever receive your approved text. The model never writes advice.',ask:'Can you approve the emergency, opioid/patch, constipation and breath-counting cards, and pick 4–6 videos? Could we record a 2-minute Kannada fentanyl-patch video at KMC?'},
 {chapter:'What it costs',title:'Cost per family',status:'context',
  what:'Estimated running cost at today’s published prices.',
  body:<table className="tour-table"><tbody><tr><td>Button check-in</td><td>₹0</td></tr><tr><td>30-second voice note (Sarvam, ₹30 per audio hour)</td><td>≈ ₹0.25</td></tr><tr><td>Replies within 24 hours of the family’s message</td><td>Free</td></tr><tr><td>Daily reminder started by Saathi</td><td>≈ ₹0.12–0.15</td></tr><tr><td><b>Per family per month</b></td><td><b>≈ ₹4 (buttons) to ₹15 (daily voice)</b></td></tr></tbody></table>,
  say:'For 1,000 families that is roughly ₹15,000 a month, less than the cost of one avoided trip per family per year. At scale, government speech services and hospital-hosted models bring it close to zero.',ask:'Who pays for home follow-up at KMC today? What does a typical trip to Manipal cost a family?'},
 {chapter:'What comes next',title:'Roadmap and the pilot',status:'planned',
  what:'Built next, in order: approved family message on RED, care cards and videos, Hindi and Kannada button text, a hosted dashboard with login. Then medicine chart and reminders, wound photos, children’s pack, PPI worksheet, video consult with NDPS-blocked prescriptions, and the Udupi map.',
  body:<div className="tour-grid3"><div className="tour-card"><b>90-day pilot measures</b><ul><li>Unplanned calls in OPD hours</li><li>Minutes from RED to a doctor</li><li>Trips avoided (km, ₹)</li></ul></div><div className="tour-card"><b>…and</b><ul><li>Doses logged</li><li>Correct patch application</li><li>Caregiver usability score</li></ul></div><div className="tour-card"><b>Before real patients</b><ul><li>Ethics committee approval</li><li>Data hosted in India</li><li>Signed protocol and cards</li></ul></div></div>,
  say:'This week we can produce real evidence without real patients: your labelled evaluation, a short usability test with your staff, and KMC’s baseline numbers.',ask:'Could 5–8 nurses or residents try a scripted check-in this week? Can you share aggregate numbers: patients per month, unplanned calls per week, typical travel distance?'},
];
export default function Tour(){
 const [i,setI]=useState(0),[queue,setQueue]=useState<Queue|null>(null),[evaluation,setEvaluation]=useState<Evaluation|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{
  try{const [q,e]=await Promise.all([fetch('/api/queue',{cache:'no-store'}),fetch('/api/evaluation',{cache:'no-store'})]);
   if(!q.ok)throw Error((await q.json()).error);setQueue(await q.json());if(e.ok)setEvaluation(await e.json());setError('');}
  catch(err){setError(err instanceof Error?err.message:'Saathi data is unavailable.');}
 },[]);
 useEffect(()=>{load();const id=setInterval(load,5000);return ()=>clearInterval(id);},[load]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='ArrowRight')setI(n=>Math.min(n+1,steps.length-1));if(e.key==='ArrowLeft')setI(n=>Math.max(n-1,0));};window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);},[]);
 const records=queue?.records??[],channels:Record<string,number>={},open:Record<string,number>={};
 for(const r of records){const c=r.report.origin?.channel??'web';channels[c]=(channels[c]??0)+1;if(r.status!=='resolved')open[tier(r)]=(open[tier(r)]??0)+1;}
 const latest=records.filter(r=>r.report.origin?.channel==='whatsapp').sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
 const live:Live={reports:records.length,channels,open,events:records.reduce((n,r)=>n+r.events.length,0),escalated:records.reduce((n,r)=>n+r.events.filter(e=>e.type==='escalated').length,0),latest,patient:queue?.patients.find(p=>p.id===latest?.patientId)?.name,evaluation,storage:queue?.storage??null};
 const step=steps[i]!;let chapter='';
 return <div className="tour">
  <aside className="tour-rail">
   <a className="brand" href="/"><span className="brandmark">s</span>saathi<span className="branddot">●</span></a>
   <div className="workspace-label">GUIDED TOUR</div>
   <ol>{steps.map((s,n)=>{const head=s.chapter!==chapter;chapter=s.chapter;return <li key={n}>{head&&<div className="tour-chapter">{s.chapter}</div>}<button className={n===i?'active':''} onClick={()=>setI(n)}><i className={`dot ${s.status}`}/><span>{n+1}. {s.title}</span></button></li>;})}</ol>
   <a className="tour-exit" href="/">← Back to the workspace</a>
  </aside>
  <main className="tour-main">
   <div className="tour-progress" aria-hidden><span style={{width:`${((i+1)/steps.length)*100}%`}}/></div>
   <div className="topbar"><span>Step {i+1} of {steps.length} <span className="slash">/</span> {step.chapter}</span><span className="demo-chip">{live.storage==='supabase'?'LIVE DATA · SYNTHETIC ONLY':'SYNTHETIC DATA ONLY'}</span></div>
   {error&&<div className="message error" role="alert">{error}</div>}
   <article className="tour-stage">
    <span className={`tour-status ${step.status}`}>{STATUS[step.status]}</span>
    <h1>{step.title}</h1><p className="tour-what">{step.what}</p>
    {step.flow&&<div className="tour-flow">{step.flow.map((f,n)=><span key={n}>{n>0&&<em>→</em>}<b>{f}</b></span>)}</div>}
    {step.body}
    {step.live&&<section className="tour-live"><div className="eyebrow">LIVE FROM SAATHI</div>{step.live(live)}</section>}
    {step.cta&&<div className="tour-ctas">{step.cta.map(c=><a key={c.href} className="tour-button" href={c.href} target={c.href.startsWith('http')?'_blank':undefined} rel="noreferrer">{c.label} ↗</a>)}</div>}
    <div className="tour-notes"><div><div className="eyebrow">SAY THIS</div><p>{step.say}</p></div>{step.ask&&<div className="ask"><div className="eyebrow">ASK DR. KRITHIKA</div><p>{step.ask}</p></div>}</div>
   </article>
   <div className="tour-nav"><button disabled={i===0} onClick={()=>setI(i-1)}>← Previous</button><span>Use ← → keys</span><button className="primary" disabled={i===steps.length-1} onClick={()=>setI(i+1)}>Next →</button></div>
  </main>
 </div>;
}
