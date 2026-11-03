'use client';
import { use, useEffect, useState } from 'react';
import { patientHistory, preCallSummary } from '../../../../../packages/workflow/src/timeline';
import { SLOT_TIME, type DoseLog } from '../../../../../packages/workflow/src/care-plan';
import type { RecordEntry } from '../../../../../packages/workflow/src/index';
import { istDate, stamp, type Workspace } from '../../../components/CareQueue';
const tier=(r:RecordEntry)=>r.report.evaluation.tier??'PENDING';
const dayLabel=(d:string)=>new Date(d+'T12:00:00+05:30').toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
/** Read-only patient record that opens in a second tab beside the queue: no buttons to press while on a call. */
export default function PatientTimeline({params}:{params:Promise<{id:string}>}){
  const {id}=use(params);
  const [ws,setWs]=useState<Workspace|null>(null),[doses,setDoses]=useState<DoseLog[]>([]),[error,setError]=useState('');
  useEffect(()=>{(async()=>{try{const [q,d]=await Promise.all([fetch('/api/queue',{cache:'no-store'}),fetch(`/api/doses/${id}`,{cache:'no-store'})]);if(!q.ok)throw Error((await q.json()).error);setWs(await q.json());if(d.ok)setDoses(await d.json());}catch(e){setError(e instanceof Error?e.message:'Patient record unavailable.');}})();},[id]);
  const patient=ws?.patients.find(p=>p.id===id),plan=ws?.carePlans[id]?.plan;
  if(error)return <main className="record"><p className="message error">{error}</p></main>;
  if(!ws||!patient)return <main className="record"><p className="muted">Loading patient record…</p></main>;
  const history=patientHistory(ws.records,id).slice().reverse();
  const pain=history.flatMap(r=>{const v=r.report.input.fields.pain_now?.value;return typeof v==='number'?[{at:r.createdAt,v}]:[];});
  // Medicine compliance per day: doses marked given against doses scheduled by the checked-in prescription.
  const scheduled=(plan?.medications??[]).filter(m=>!m.rescue).reduce((n,m)=>n+m.slots.length,0);
  const days=Array.from({length:14},(_,i)=>istDate(Date.now()-(13-i)*86400000));
  const compliance=days.map(d=>{const logs=doses.filter(x=>x.dueDate===d);return {d,given:logs.filter(x=>x.status==='given').length,missed:logs.filter(x=>x.status==='not_given').length};});
  const W=640,H=180,pad=28,x=(i:number)=>pad+(pain.length<2?(W-2*pad)/2:i*(W-2*pad)/(pain.length-1)),y=(v:number)=>H-pad-v*(H-2*pad)/10;
  return <main className="record">
    <header><div className="eyebrow">PATIENT RECORD · SYNTHETIC · READ ONLY</div><h1>{plan?.demographics.name??patient.name}</h1>
      <p>{plan?`${plan.demographics.age} yr · ${plan.demographics.sex}`:`${patient.age} yr`} · {plan?.diagnosis??patient.diagnosis} · Hospital ID {plan?.hospital.hospitalId??'not checked in'} · ABHA (simulated) {patient.abha} · Saathi ID {patient.saathiId}</p>
      {plan&&<p>Caregiver {plan.demographics.caregiver} ({plan.demographics.relation}) · {plan.demographics.address} · Consultant {plan.hospital.consultant}, {plan.hospital.department}</p>}</header>
    {plan&&<section><h2>Care plan from the hospital record</h2><p>{plan.summary}</p>
      <table><thead><tr><th>Medicine</th><th>Dose</th><th>When</th><th>Instructions</th></tr></thead><tbody>{plan.medications.map(m=><tr key={m.key}><td>{m.name}{m.rescue?' (rescue)':''}</td><td>{m.dose} · {m.route}</td><td>{m.rescue?'As needed':m.slots.map(s=>`${s} ${SLOT_TIME[s]}`).join(', ')}</td><td>{m.instructions}</td></tr>)}</tbody></table>
      <p>{plan.appointments.map(a=>`${a.kind==='opd_visit'?'OPD visit':a.kind==='phone_followup'?'Phone follow-up':'Refill due'} ${dayLabel(a.date)}${a.time?` ${a.time}`:''}${a.note?` (${a.note})`:''}`).join(' · ')}</p></section>}
    <section><h2>Pain score over time</h2>{pain.length?<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pain scores reported over time" className="chart">
      {[0,5,10].map(v=><g key={v}><line x1={pad} x2={W-pad} y1={y(v)} y2={y(v)} className="grid"/><text x={4} y={y(v)+4}>{v}</text></g>)}
      <polyline points={pain.map((p,i)=>`${x(i)},${y(p.v)}`).join(' ')} className="line"/>
      {pain.map((p,i)=><g key={i}><circle cx={x(i)} cy={y(p.v)} r={4} className={p.v>=7?'dot high':'dot'}/><text x={x(i)} y={y(p.v)-9} textAnchor="middle">{p.v}</text><text x={x(i)} y={H-6} textAnchor="middle" className="axis">{dayLabel(istDate(p.at))}</text></g>)}
    </svg>:<p className="muted">No pain scores reported yet.</p>}</section>
    <section><h2>Medicine compliance · last 14 days</h2>{!plan?<p className="muted">No prescription checked in from the hospital record.</p>:<div className="compliance">{compliance.map(c=>{const pct=scheduled?Math.min(100,Math.round(c.given/scheduled*100)):0,known=c.given+c.missed>0;return <div key={c.d} title={`${c.given} of ${scheduled} scheduled doses marked given`}><div className="bar"><span style={{height:`${pct}%`}} className={pct>=100?'full':pct>0?'part':''}/></div><b>{known?`${c.given}/${scheduled}`:'—'}</b><small>{dayLabel(c.d)}</small></div>;})}</div>}<p className="muted">From families tapping “Given” or “Not given” on WhatsApp reminders. “—” means no reminder response that day.</p></section>
    <section><h2>Calls and reports</h2>{!history.length?<p className="muted">No reports yet.</p>:<ol className="call-log">{history.map(r=>{const ack=r.events.find(e=>e.type==='acknowledged'),closed=[...r.events].reverse().find(e=>e.type==='resolved');return <li key={r.id}>
      <p><b>{stamp(r.createdAt)}</b> · {tier(r)} · via {r.report.origin?.channel??'web'}</p>
      <p>Reported: {r.report.evaluation.traces.filter(t=>t.outcome===true).map(t=>t.label).join('; ')||'no rule matched'}</p>
      {r.report.input.messages.map(m=><p key={m.id} className="quote">“{m.text}”</p>)}
      <p>{ack?`Acknowledged by ${ack.actor} at ${stamp(ack.at)}.`:'Not yet acknowledged.'} {closed?`Closed at ${stamp(closed.at)}. ${closed.details}`:''}</p></li>;})}</ol>}</section>
    <section><h2>Pre-call summary</h2><pre>{preCallSummary(patient,ws.records)}</pre></section>
  </main>;
}
