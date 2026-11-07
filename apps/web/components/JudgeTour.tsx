'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { service, RED_FAMILY_MESSAGE, GREETING } from '../../../packages/workflow/src/service-config';
export type TourView='queue'|'intake'|'patients'|'review';
type Score={run:number;redExpected:number;redCaught:number;falseRed:number};
type Step={target?:string;view?:TourView;title:string;body:React.ReactNode;cta?:{label:string;href:string};needsReport?:boolean;missing?:string};
const h=(m:number)=>m>=120?`${m/60} h`:`${m} min`;
const cb=service.callbackMinutes;

/** A fictional guide doctor. She is not Dr. Rao and never speaks for her. */
function Guide(){
  return <svg viewBox="0 0 64 64" className="guide-face" aria-hidden="true">
    <circle cx="32" cy="32" r="32" fill="#e7efe6"/>
    <path d="M14 64c1-13 8-19 18-19s17 6 18 19z" fill="#fff" stroke="#c9d6c8"/>
    <path d="M26 46l6 9 6-9" fill="#d9e6f2"/>
    <path d="M22 50c0 8 4 10 7 10" fill="none" stroke="#214f46" strokeWidth="2" strokeLinecap="round"/><circle cx="30" cy="60" r="2.4" fill="#214f46"/>
    <circle cx="32" cy="30" r="12" fill="#c98f6b"/>
    <path d="M19 31c-1-11 6-17 13-17s14 5 13 17c-3-6-8-8-13-8s-10 2-13 8z" fill="#2e2621"/>
    <circle cx="27.5" cy="31" r="1.4" fill="#2e2621"/><circle cx="36.5" cy="31" r="1.4" fill="#2e2621"/>
    <path d="M28 36c2.5 2 5.5 2 8 0" fill="none" stroke="#7a4a36" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>;
}

function Chat(){
  return <div className="tour-chat" aria-label="Example WhatsApp conversation">
    <p className="in">Saathi · Morning medicines (08:00): Tab. Morphine SR 10 mg (example prescription). <span className="chip">All given</span><span className="chip">Not given</span></p>
    <p className="out">Hi</p>
    <p className="in">{GREETING.split('. ')[0]}. What is worrying you today?</p>
    <p className="out">🎤 Voice note · “He is very sleepy, I gave the extra dose four times”</p>
    <p className="in urgent">{RED_FAMILY_MESSAGE.split('. ').slice(0,2).join('. ')}.</p>
  </div>;
}

const steps:Step[]=[
  {title:'Hello, I’m Dr. Asha, your guide',body:<>
    <p>I’m a fictional doctor who will walk you through Saathi in about two minutes. Everything here is synthetic data.</p>
    <p><b>Saathi is a care continuity service</b> for families caring for a palliative-care patient at home. It sorts their concerns into teleconsultation call-backs, so the care team calls the sickest patients first and never loses a patient after discharge.</p>
    <p className="tour-motto">AI listens. The doctor decides.</p>
    <p className="muted">Use Next or the → key. Press Esc to skip the tour at any time.</p></>},
  {target:'emr-link',title:'It starts at the hospital',body:<>
    <p>At the end of an OPD visit the doctor presses <b>Check in to Saathi</b> in the hospital record. Saathi receives the demographics, the prescription with dose times and the follow-up plan.</p>
    <p>Only patients who consented in OPD are checked in. Real hospital data never leaves the hospital in this demo: we use a dummy hospital page instead.</p></>,cta:{label:'Open the demo hospital EMR ↗',href:'/emr'}},
  {title:'At home, the family just uses WhatsApp',body:<>
    <Chat/>
    <p>Families get itemised medicine reminders and tap <b>Given</b> or <b>Not given</b>, plus refill and appointment reminders. The family web page does the same, and also takes a daily pain score and news of any hospital admission or discharge. When worried, they say “Hi” and describe the problem in their own words or a voice note. A web page with one-time-code sign-in does the same for relatives abroad.</p>
    <p className="muted">Every reply is fixed, pre-written text. Saathi never writes medical advice.</p></>},
  {target:'day-bar',view:'queue',title:'Every concern lands in one queue',body:<p>Pick any date to see that day’s reports: how many came in, how urgent they were and how many calls are closed. Open calls from earlier days are carried forward, so nothing is lost.</p>},
  {target:'urgent',view:'queue',needsReport:true,missing:'There is no open RED report right now. Load an example to see one.',title:'RED concerns go to the top',body:<>
    <p><b>Needs immediate review</b> holds concerns that matched a RED rule. The on-call doctor also gets a WhatsApp alert at once, and the family is told to seek urgent care.</p>
    <p>Within each urgency the <b>oldest comes first</b>, so families are called back in the order they asked. A new RED also <b>flashes a banner</b>, beeps and blinks the browser tab for whoever is watching the dashboard.</p></>},
  {target:'callback',view:'queue',title:'Everything else becomes a call-back',body:<>
    <p>AMBER and GREEN concerns are called back on the next working day. <b>Acknowledge</b> means “accepted into the call-back list”, not “closed”.</p>
    <p>Each row counts down to its target: RED {h(cb.RED!)}, AMBER {h(cb.AMBER!)}, GREEN {h(cb.GREEN!)} (still to be confirmed by our clinical lead).</p></>,missing:'No AMBER or GREEN calls are open on this day. The same countdown appears on every open report.'},
  {target:'demographics',view:'queue',needsReport:true,title:'Who the patient is, at a glance',body:<p>Name, age, hospital ID, health ID (ABHA, simulated in the demo), Saathi ID, phone, caregiver and address, straight from the hospital check-in. The on-call doctor no longer phones back with no history in hand.</p>},
  {target:'call-buttons',view:'queue',needsReport:true,title:'Call in one tap, history in a second tab',body:<p>Phone call, or a WhatsApp voice or video call. <b>Patient timeline</b> opens a read-only record in a second tab, with the daily pain-score chart and a medicine-compliance chart built from the family’s reminder taps, so the report and the call buttons stay visible.</p>},
  {target:'evidence',view:'queue',needsReport:true,title:'The family’s words, then the rule',body:<>
    <p>The language model only <b>transcribes and fills fixed fields</b>, and must quote the family’s exact words for each one. It never decides urgency.</p>
    <p>Urgency comes from <b>deterministic rules</b> written from the clinical protocol and stored as data. A keyword safety net runs alongside the model, so a model miss cannot drop a RED.</p></>},
  {target:'family-message',view:'queue',title:'What a RED family receives',body:<p>On every RED the family immediately receives this fixed message, in our clinical lead’s words (awaiting her written sign-off). It tells them teleconsultation is not enough and to go to the nearest hospital.</p>,missing:'This report is not RED, so no urgent-care message was sent. AMBER and GREEN families are told when to expect the call-back.'},
  {target:'actions',view:'queue',needsReport:true,title:'Acknowledge, call, close',body:<p>The clinician acknowledges the report, calls the family, then records the <b>call notes and the advice given</b> and closes it. Questions are clarified on the phone, not by a chatbot. You can try it here: it is all synthetic.</p>},
  {target:'assign',view:'queue',title:'The right person calls back',body:<p>For AMBER and GREEN calls, the nurse in charge or call manager assigns the call-back to a <b>doctor, nurse or psychologist</b>, based on the need. RED calls go straight to the on-call doctor.</p>,missing:'This report is RED, so it goes to the on-call doctor. AMBER and GREEN reports show “Assign the call-back to: Doctor · Nurse · Psychologist” here.'},
  {target:'prescription',view:'queue',title:'A prescription after the call, within the law',body:<p>After the teleconsult the doctor can write a prescription. Saathi never suggests a medicine; it <b>blocks narcotic, psychotropic, Schedule X and anti-cancer drugs</b>, as the 2020 Telemedicine Practice Guidelines require, and signs the prescription so any later change is detectable. The family sees it on their page.</p>,missing:'Prescriptions open after the report is acknowledged. Acknowledge a report to see the form.'},
  {target:'fee',view:'queue',title:'Optional teleconsult fees',body:<p>Paid home-care services can track a call-back fee (for example ₹{service.fees.audioCall}, half for a follow-up within {service.fees.followUpWithinDays} days). NGOs switch fees off. The demo collects no payment.</p>,missing:'Fees are switched off for this organisation.'},
  {target:'call-log',view:'queue',needsReport:true,title:'Every step is on the record',body:<p>The call log keeps when the report arrived, what matched, who acknowledged it and when, the call notes and when it closed. Any report exports as a FHIR R4 record for the hospital system.</p>},
  {target:'voice',view:'intake',title:'Staff can report for a family',body:<p>When a family phones in, staff can type the concern or upload a voice recording here. It goes through exactly the same transcription, rules and queue.</p>},
  {target:'review',view:'review',title:'The protocol belongs to the doctors',body:<p>Rules, care cards and thresholds are data, so the palliative-care team edits them without code. Anything not yet signed is labelled <b>draft</b>, and nothing is presented as clinically approved until it is.</p>},
  {target:'coord-link',view:'queue',title:'Three separate logins',body:<>
    <p><b>Medical staff</b> see everything you have seen. A <b>call manager</b> sees only daily counts, status, missed calls and fees, with no clinical details, and can export a daily PDF report. <b>Families</b> see only their own patient.</p><p>Anyone can create an account with a mobile number or, for relatives abroad, an email address, each with a password. Staff join their organisation with an invite code; families link to their patient with the Saathi ID from the OPD leaflet.</p></>,cta:{label:'Open the call manager report ↗',href:'/coordinator'}},
  {title:'Who it is for, and who pays',body:<>
    <p>India has only about 120–130 MD palliative-medicine specialists, yet care has to continue across hospital, home and hospice. The same gap exists across low- and middle-income countries.</p>
    <ul className="tour-list">
      <li><b>Home-care organisations</b> triage home visits and use staff time better.</li>
      <li><b>Hospitals</b> add Saathi beside their hospital information system as a ready-made product.</li>
      <li><b>NGOs and community services</b> run it with fees switched off.</li>
    </ul>
    <p>Organisations charge families per teleconsult (for example a full first fee and half for a follow-up within 15 days). Saathi’s running cost per family message is a fraction of a rupee, against consult fees of ₹500–2,000.</p></>},
  {title:'Safety by design',body:null},
  {title:'That’s Saathi',body:<>
    <p>One line for families, one queue for the care team, and a record of every contact, with doctors making every clinical decision.</p>
    <p className="muted">You can restart this tour any time from <b>Tour for judges</b> in the sidebar.</p></>},
];

type Props={view:TourView;setView:(v:TourView)=>void;hasReports:boolean;onExample:()=>Promise<void>;onClose:()=>void};
export default function JudgeTour({view,setView,hasReports,onExample,onClose}:Props){
  const [i,setI]=useState(0),[rect,setRect]=useState<DOMRect|null>(null),[cardH,setCardH]=useState(320),[size,setSize]=useState({w:1200,h:800}),[score,setScore]=useState<{keyword:Score|null;live:Score&{total:number}}|null>(null),[loading,setLoading]=useState(false);
  const card=useRef<HTMLDivElement>(null),scrolled=useRef(-1);
  const step=steps[i]!,last=i===steps.length-1;
  const go=useCallback((n:number)=>{if(n>=steps.length)return onClose();setI(Math.max(0,n));},[onClose]);
  useEffect(()=>{fetch('/api/evaluation',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(setScore).catch(()=>{});},[]);
  useEffect(()=>{if(step.view&&step.view!==view)setView(step.view);},[step,view,setView]);
  useEffect(()=>{card.current?.focus();},[i]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.target as HTMLElement).closest('input,textarea,select'))return;if(e.key==='Escape')onClose();else if(e.key==='ArrowRight')go(i+1);else if(e.key==='ArrowLeft')go(i-1);};window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);},[i,go,onClose]);
  // Re-measure the highlighted element a few times a second: data loads, views switch and the page scrolls underneath us.
  useEffect(()=>{
    const measure=()=>{
      setSize({w:window.innerWidth,h:window.innerHeight});
      const el=step.target?document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`):null;
      if(!el){setRect(null);return;}
      if(scrolled.current!==i){scrolled.current=i;const r=el.getBoundingClientRect();if(r.top<70||r.bottom>window.innerHeight-20)el.scrollIntoView({block:r.height>window.innerHeight*.7?'start':'center',behavior:'smooth'});}
      setRect(el.getBoundingClientRect());
    };
    measure();const id=setInterval(measure,150);return ()=>clearInterval(id);
  },[i,step.target]);
  useLayoutEffect(()=>{if(card.current)setCardH(card.current.offsetHeight);});

  const W=Math.min(380,size.w-24),gap=16,mobile=size.w<760;
  let pos:React.CSSProperties;
  if(mobile)pos={left:12,right:12,bottom:12};
  else if(!rect)pos={left:(size.w-W)/2,top:Math.max(16,(size.h-cardH)/2)};
  else{
    const top=Math.min(Math.max(16,rect.top),size.h-cardH-16);
    if(rect.right+gap+W<size.w-12)pos={left:rect.right+gap,top};
    else if(rect.left-gap-W>12)pos={left:rect.left-gap-W,top};
    else{const below=rect.bottom+gap+cardH<size.h;pos={left:Math.min(Math.max(12,rect.left),size.w-W-12),top:below?rect.bottom+gap:Math.max(16,rect.top-gap-cardH)};}
  }
  const absent=step.target&&!rect;
  const body=step.title==='Safety by design'?<>
    <ul className="tour-list">
      <li>The model only transcribes and extracts, with a verbatim quote for every field.</li>
      <li>Urgency comes only from deterministic, unit-tested rules.</li>
      <li>Families receive only pre-written text. No AI advice, no prognosis, no photo interpretation.</li>
      <li>Teleconsult prescriptions block narcotic and psychotropic (NDPS), Schedule X and anti-cancer drugs, as the 2020 Telemedicine Practice Guidelines require. Morphine refills stay with the patient’s registered hospital.</li>
      <li>Synthetic data only. Every alert is traceable from the family’s words to the rule to the human response.</li>
    </ul>
    {score&&<div className="tour-score"><div><b>{score.live.redCaught}/{score.live.redExpected}</b>expected REDs caught by the full pipeline</div>{score.keyword&&<div><b>{score.keyword.redCaught}/{score.keyword.redExpected}</b>by keywords alone</div>}<div><b>{score.live.falseRed}</b>false RED alarms</div></div>}
    {score&&<p className="muted">{score.live.run} of {score.live.total} invented messages in English, Hindi and Kannada. Labels are engineering drafts awaiting clinical review.</p>}</>:step.body;

  return <div className="judge-tour" role="dialog" aria-modal="false" aria-labelledby="tour-title">
    {rect?<div className="tour-spot" style={{left:rect.left-6,top:rect.top-6,width:rect.width+12,height:rect.height+12}}/>:<div className="tour-dim"/>}
    <div ref={card} tabIndex={-1} className="tour-card-pop" style={{...pos,width:mobile?undefined:W}}>
      <div className="tour-who"><Guide/><div><b>Dr. Asha</b><small>Fictional guide · for judges</small></div><button className="tour-skip" onClick={onClose}>Skip tour</button></div>
      <h2 id="tour-title">{step.title}</h2>
      <div className="tour-body">{absent&&(step.missing||step.needsReport)?<p className="tour-missing">{step.missing??'Load an example report to see this part of the screen.'}</p>:null}{body}</div>
      {absent&&(step.target==='urgent'||(step.needsReport&&!hasReports))&&<button disabled={loading} onClick={async()=>{setLoading(true);try{await onExample();}finally{setLoading(false);}}}>{loading?'Loading…':'Load an urgent example report'}</button>}
      {step.cta&&<a className="tour-cta" href={step.cta.href} target="_blank" rel="noreferrer">{step.cta.label}</a>}
      <div className="tour-foot"><div className="tour-dots" aria-label={`Step ${i+1} of ${steps.length}`}>{steps.map((_,n)=><span key={n} className={n===i?'on':n<i?'done':''}/>)}</div>
        <span>{i+1}/{steps.length}</span>{i>0&&<button onClick={()=>go(i-1)}>Back</button>}<button className="primary" onClick={()=>go(i+1)}>{last?'Finish':i===0?'Start':'Next'}</button></div>
    </div>
  </div>;
}
