'use client';
import { useEffect, useState } from 'react';
import {escalationStatus} from '../../../packages/workflow/src/escalation';
import {callbackDue,service,familyReplies,CLINICIAN_LABEL} from '../../../packages/workflow/src/service-config';
import type { RecordEntry, CarePlanEntry } from '../../../packages/workflow/src/index';
import type { Patient } from '../../../packages/workflow/src/store';
import Prescribe from './Prescribe';
const WHO:Record<string,string>={doctor:'Doctor',nurse:'Nurse',psychologist:'Psychologist'};
export type WorkspacePatient=Patient&{saathiId:string;abha:string;whatsapp:string|null};
export type Assignment={assignee:'doctor'|'nurse'|'psychologist';by:string;at:string};
export type Workspace={patients:WorkspacePatient[];records:RecordEntry[];team:string[];storage:'local'|'supabase'|null;carePlans:Record<string,CarePlanEntry>;fees:Record<string,'due'|'paid'|'waived'>;assignments?:Record<string,Assignment>};
const tier=(r:RecordEntry)=>r.report.evaluation.tier??'PENDING';
const rank:Record<string,number>={RED:0,AMBER:1,PENDING:2,GREEN:3};
const TZ='Asia/Kolkata';
export const istDate=(at:string|number)=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
export const stamp=(at:string|number)=>new Date(at).toLocaleString('en-IN',{timeZone:TZ,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const clock=(at:number)=>new Date(at).toLocaleTimeString('en-IN',{timeZone:TZ,hour:'2-digit',minute:'2-digit'});
const tierLabel=(t:string)=>t==='PENDING'?'REVIEW':t;
const statusLabel:Record<RecordEntry['status'],string>={open:'New · not acknowledged',acked:'In call-back list',resolved:'Call closed'};
const minutes=(ms:number)=>{const m=Math.round(Math.abs(ms)/60000);return m>=2880?`${Math.round(m/1440)} days`:m>=120?`${Math.round(m/60)} h`:`${m} min`;};
function Due({r,now}:{r:RecordEntry;now:number}){
  if(r.status==='resolved')return null;const due=callbackDue(r.createdAt,r.report.evaluation.tier),left=due-now;
  return <span className={`due ${left<0?'late':left<15*60000?'soon':''}`}>{left<0?`Call overdue by ${minutes(left)}`:`Call by ${clock(due)} · ${minutes(left)} left`}</span>;
}
type Props={ws:Workspace;selected:string|null;setSelected:(id:string|null)=>void;busy:boolean;perform:(task:()=>Promise<void>)=>Promise<void>;send:(url:string,payload:object)=>Promise<any>;setNotice:(n:string)=>void;onExample:()=>void;loaded:boolean;staff?:string};
export default function CareQueue({ws,selected,setSelected,busy,perform,send,setNotice,onExample,loaded,staff='doctor'}:Props){
  const today=istDate(Date.now());
  const [from,setFrom]=useState(today),[to,setTo]=useState(today),[now,setNow]=useState(Date.now()),[notes,setNotes]=useState(''),[advice,setAdvice]=useState(''),[answeredBy,setAnsweredBy]=useState('duty_doctor');
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),30000);return ()=>clearInterval(id);},[]);
  useEffect(()=>{setNotes('');setAdvice('');},[selected]);
  // Oldest first within each urgency, so the team calls back in the order families asked.
  const order=(a:RecordEntry,b:RecordEntry)=>(rank[tier(a)]!-rank[tier(b)]!)||Date.parse(a.createdAt)-Date.parse(b.createdAt);
  // A from–to range (IST dates, inclusive). Open calls from before the range are carried forward while it ends today.
  const range=(f:string,t:string)=>{setFrom(f);setTo(t);setSelected(null);};
  const daysAgo=(n:number)=>istDate(Date.now()-n*86400000);
  const isToday=from===today&&to===today,single=from===to;
  const fmt=(d:string)=>stamp(d+'T12:00:00+05:30').split(',')[0];
  const day=ws.records.filter(r=>{const d=istDate(r.createdAt);return d>=from&&d<=to;}),carried=to===today?ws.records.filter(r=>r.status!=='resolved'&&istDate(r.createdAt)<from):[];
  const open=[...carried,...day.filter(r=>r.status!=='resolved')];
  const sections:[string,string,RecordEntry[]][]=[
    ['urgent','Needs immediate review',open.filter(r=>tier(r)==='RED').sort(order)],
    ['callback','Call-back list',open.filter(r=>tier(r)!=='RED').sort(order)],
    ['closed',isToday?'Closed today':single?'Closed on this day':'Closed in this range',day.filter(r=>r.status==='resolved').sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))],
  ];
  const all=sections.flatMap(s=>s[2]),chosen=all.find(r=>r.id===selected)??all[0];
  const patient=chosen?ws.patients.find(p=>p.id===chosen.patientId):undefined,plan=chosen?ws.carePlans[chosen.patientId]?.plan:undefined;
  const count=(t:string)=>day.filter(r=>tier(r)===t).length;
  const phone=plan?.demographics.phone??patient?.whatsapp??null;
  const fee=chosen?ws.fees[chosen.id]??'due':'due';
  return <>
    <section className="day-bar" data-tour="day-bar" aria-label="Reports for the selected dates">
      <label>From<input type="date" value={from} max={to} onChange={e=>{const f=e.target.value||today;range(f,f>to?f:to);}}/></label>
      <label>To<input type="date" value={to} min={from} max={today} onChange={e=>{const t=e.target.value||today;range(t<from?t:from,t);}}/></label>
      <div className="range-presets" role="group" aria-label="Quick ranges">
        <button className={isToday?'active':''} aria-pressed={isToday} onClick={()=>range(today,today)}>Today</button>
        <button className={from===daysAgo(6)&&to===today?'active':''} aria-pressed={from===daysAgo(6)&&to===today} onClick={()=>range(daysAgo(6),today)}>Last 7 days</button>
        <button className={from===daysAgo(29)&&to===today?'active':''} aria-pressed={from===daysAgo(29)&&to===today} onClick={()=>range(daysAgo(29),today)}>Last 30 days</button>
      </div>
      <div className="day-counts"><span><b>{day.length}</b> calls received</span><span className="red"><b>{count('RED')}</b> RED</span><span className="amber"><b>{count('AMBER')}</b> AMBER</span><span><b>{count('GREEN')+count('PENDING')}</b> GREEN / review</span><span className="done"><b>{day.filter(r=>r.status==='resolved').length}</b> closed</span>{carried.length>0&&<span className="carry"><b>{carried.length}</b> still open from earlier days</span>}</div>
    </section>
    <div className="queue-layout"><section className="queue-panel">
      {!loaded?<div className="empty">Loading workspace…</div>:all.length===0?<div className="empty"><div className="empty-symbol">✧</div><h3>{isToday?'No reports on this day yet.':single?`No reports on ${fmt(from)}.`:`No reports from ${fmt(from)} to ${fmt(to)}.`}</h3><p>Caregiver concerns from WhatsApp and the family web page appear here.</p>{isToday&&<button disabled={busy} onClick={onExample}>Load an urgent example</button>}</div>:
      sections.map(([key,title,rows])=>rows.length>0&&<div key={key} data-tour={key} className={`queue-section ${key}`}><h2>{title}<span>{rows.length}</span></h2>{rows.map(r=>{const p=ws.patients.find(p=>p.id===r.patientId)!;return <button key={r.id} className={`patient-row ${chosen?.id===r.id?'selected':''}`} onClick={()=>setSelected(r.id)}><div className={`row-marker ${tier(r).toLowerCase()}`}/><div className="avatar">{p.initials}</div><div className="row-text"><strong>{p.name} <span>{p.age} yr</span></strong><p>{p.diagnosis}</p><div className="row-reason">{r.report.evaluation.traces.filter(t=>t.outcome===true).map(t=>t.label).join(' · ')||'Call to understand the concern'}</div></div><div className="row-status"><span className={`pill ${tier(r).toLowerCase()}`}>{tierLabel(tier(r))}</span><small>{stamp(r.createdAt)}</small><small>{statusLabel[r.status]}</small>{ws.assignments?.[r.id]&&<small className="assignee">→ {WHO[ws.assignments[r.id]!.assignee]}</small>}<Due r={r} now={now}/></div></button>;})}</div>)}
      <div className="queue-footer"><span className="live-dot"/> {ws.storage==='supabase'?'Supabase storage':ws.storage==='local'?'Local file storage':'Connecting to storage'} <span>·</span> Oldest first within each urgency · updates every 5 seconds</div>
    </section>
    <section className="detail-panel" data-tour="detail" aria-label="Report details">{chosen&&patient?<>
      <div className="demographics" data-tour="demographics">
        <div className="demo-top"><div><div className="eyebrow">PATIENT · SYNTHETIC</div><h2>{plan?.demographics.name??patient.name}</h2><p>{plan?`${plan.demographics.age} yr · ${plan.demographics.sex}`:`${patient.age} yr`} · {plan?.diagnosis??patient.diagnosis}</p></div><span className={`pill ${tier(chosen).toLowerCase()}`}>{tierLabel(tier(chosen))}</span></div>
        <dl><div><dt>Hospital ID</dt><dd>{plan?.hospital.hospitalId??'Not checked in'}</dd></div><div><dt>ABHA (simulated)</dt><dd>{patient.abha}</dd></div><div><dt>Saathi ID</dt><dd>{patient.saathiId}</dd></div><div><dt>Phone</dt><dd>{phone?`+${phone}`:'No verified number'}</dd></div><div><dt>Caregiver</dt><dd>{plan?`${plan.demographics.caregiver} (${plan.demographics.relation})`:'—'}</dd></div><div><dt>Address</dt><dd>{plan?.demographics.address??'—'}</dd></div></dl>
        <div className="call-buttons" data-tour="call-buttons"><a className={`call ${phone?'':'disabled'}`} href={phone?`tel:+${phone}`:undefined}>📞 Phone call</a><a className={`call ${phone?'':'disabled'}`} href={phone?`https://wa.me/${phone}`:undefined} target="_blank" rel="noreferrer">WhatsApp call or video</a><a className="call timeline" href={`/patients/${patient.id}`} target="_blank" rel="noreferrer">Full record ↗</a></div>
      </div>
      <div className="detail-body">
        <div className="detail-meta"><span>Received {stamp(chosen.createdAt)} · {chosen.report.origin?`${chosen.report.origin.channel==='telegram'?'Telegram':'WhatsApp'} · `:'Web · '}{chosen.report.source==='buttons'?'Check-in answers':chosen.report.source==='voice'?'Voice note':chosen.report.source==='text'?'Typed concern':'Synthetic example'}</span><span>{statusLabel[chosen.status]} <Due r={chosen} now={now}/></span></div>
        {chosen.report.processing&&chosen.report.processing.extraction.status!=='complete'&&<div className="processing-status"><strong>{chosen.report.processing.extraction.status==='failed'?'Extraction failed · transcript preserved':'Extraction pending · transcript preserved'}</strong><button disabled={busy} onClick={()=>perform(async()=>{await send(`/api/analysis/${chosen.id}`,{});setNotice('Extraction retry checked.');})}>Retry extraction</button></div>}
        <div data-tour="evidence"><h3>What the caregiver reported</h3>{chosen.report.input.messages.map(m=><blockquote key={m.id}>{m.text}</blockquote>)}
        <div className="trace-heading"><h3>Why this reached the queue</h3><span>{chosen.report.evaluation.protocolVersion}</span></div>{chosen.report.evaluation.traces.filter(t=>t.outcome===true).map(t=><div className="trace-card" key={t.ruleId}><div><strong>{t.ruleId}</strong><span>{t.label}</span></div>{t.evidence.filter(e=>e.quote).map((e,i)=><p key={`${e.path}-${i}`}><code>{e.path} = {String(e.value)}</code><q>{e.quote}</q></p>)}</div>)}{chosen.report.safetyNet.map((h,i)=><div className="trace-card" key={i}><strong>Keyword safety net · {h.language.toUpperCase()}</strong><p><q>{h.phrase}</q> matched {h.id}{h.possibleNegation?' · possible negation, check on the call':''}</p></div>)}
        {tier(chosen)!=='RED'&&chosen.report.evaluation.traces.every(t=>t.outcome!==true)&&<p className="muted">No rule matched. Call to understand the concern.</p>}</div>
        <div className={`family-message ${tier(chosen)==='RED'?'':'calm'}`} data-tour="family-message"><div className="eyebrow">WHAT THE FAMILY WAS TOLD · WORDING APPROVED BY THE CLINICAL LEAD</div>{familyReplies(chosen.report.evaluation.tier,chosen.report.processing?.extraction.status,chosen.report.evaluation.matched,chosen.report.input.fields).map((t,i)=><p key={i}>{t}</p>)}</div>
        <p className="muted">{escalationStatus(chosen)}</p>
        {chosen.status==='open'&&<div className="actions" data-tour="actions"><button className="primary" disabled={busy} onClick={()=>perform(async()=>{await send(`/api/alerts/${chosen.id}`,{action:'acknowledge',expectedRevision:chosen.revision});setNotice('Added to the call-back list under your name.');})}>Acknowledge · add to call-back list</button><a className="export-link" href={`/api/fhir/${chosen.id}`} download>Export FHIR</a></div>}
        {chosen.status==='acked'&&<form className="close-call" data-tour="actions" onSubmit={e=>{e.preventDefault();perform(async()=>{await send(`/api/alerts/${chosen.id}`,{action:'close',expectedRevision:chosen.revision,notes:`${notes.trim()}\nAnswered by: ${CLINICIAN_LABEL[answeredBy]}${service.fees.enabled?` · fee ₹${service.fees.byClinician[answeredBy]}`:''}`,advice});setNotice('Call closed with notes.');});}}>
          <h3>After the call</h3><label>Call notes (what was discussed)<textarea required rows={4} maxLength={4000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Synthetic demo only"/></label><label>Call answered by<select value={answeredBy} onChange={e=>setAnsweredBy(e.target.value)}>{Object.entries(CLINICIAN_LABEL).map(([k,v])=><option key={k} value={k}>{v}{service.fees.enabled?` · ₹${service.fees.byClinician[k]}`:''}</option>)}</select></label><label>Advice given<textarea rows={2} maxLength={2000} value={advice} onChange={e=>setAdvice(e.target.value)}/></label>
          <div className="actions"><button className="primary" disabled={busy||!notes.trim()} type="submit">Close call</button><a className="export-link" href={`/api/fhir/${chosen.id}`} download>Export FHIR</a></div></form>}
        {chosen.status==='resolved'&&<div className="actions" data-tour="actions"><a className="export-link" href={`/api/fhir/${chosen.id}`} download>Export FHIR</a></div>}
        {tier(chosen)!=='RED'&&chosen.status!=='resolved'&&<div className="assign-row" data-tour="assign"><span>Assign the call-back to</span>{(['doctor','nurse','psychologist'] as const).map(a=><button key={a} disabled={busy||ws.storage!=='supabase'} className={ws.assignments?.[chosen.id]?.assignee===a?'on':''} onClick={()=>perform(async()=>{await send(`/api/alerts/${chosen.id}`,{action:'assign',assignee:a});setNotice(`Assigned to a ${a}.`);})}>{WHO[a]}</button>)}{ws.assignments?.[chosen.id]&&<small>by {ws.assignments[chosen.id]!.by} · {stamp(ws.assignments[chosen.id]!.at)}</small>}</div>}
        {chosen.status!=='open'&&ws.storage==='supabase'&&(staff==='doctor'?<Prescribe patientId={chosen.patientId} alertId={chosen.id} hospital={plan?.hospital.name??null}/>:<p className="muted rx-note">Prescription changes are made by doctors. As a {staff}, you can call the family, send reminders and add call notes.</p>)}
        {service.fees.enabled&&<div className="fee-row" data-tour="fee"><span>Teleconsult fee · each organisation sets its own amounts (demo: duty doctor ₹{service.fees.byClinician.duty_doctor}, specialist ₹{service.fees.byClinician.specialist}; no payment collected)</span><select aria-label="Fee status" value={fee} disabled={busy||ws.storage!=='supabase'} onChange={e=>{const status=e.target.value;perform(async()=>{await send(`/api/alerts/${chosen.id}`,{action:'fee',status});setNotice(`Fee marked ${status}.`);});}}><option value="due">Fee due</option><option value="paid">Fee paid</option><option value="waived">Waived</option></select></div>}
        <div data-tour="call-log"><h3 className="audit-title">Call log</h3><ol className="audit">{chosen.events.map(e=><li key={e.id}><div><strong>{e.type==='resolved'?'call closed':e.type==='acknowledged'?'added to call-back list':e.type.replaceAll('_',' ')}</strong><time>{stamp(e.at)}</time></div><p>{e.details}</p><small>{e.actor}</small></li>)}</ol></div>
      </div></>:<div className="empty detail-empty"><div className="empty-symbol">↗</div><h3>Select a report.</h3><p>See the patient, the family’s words, the matched rules and the call log.</p></div>}</section></div>
  </>;
}
