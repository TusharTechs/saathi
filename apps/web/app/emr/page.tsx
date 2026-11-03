'use client';
import { useEffect, useState } from 'react';
import { demoCase } from '../../../../packages/workflow/src/demo-case';
import { SLOTS, type CarePlan } from '../../../../packages/workflow/src/care-plan';
import { saathiId } from '../../../../packages/workflow/src/service-config';
type Patient={id:string;name:string};
/** Stand-in for a hospital EMR: the doctor finishes the OPD note and clicks "Check in to Saathi". Synthetic only. */
export default function DemoEMR(){
  const [patients,setPatients]=useState<Patient[]>([]),[patientId,setPatientId]=useState('demo-ramesh'),[plan,setPlan]=useState<CarePlan>(demoCase()),[checked,setChecked]=useState<string>(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[slot,setSlot]=useState<typeof SLOTS[number]>('morning'),[queued,setQueued]=useState('');
  useEffect(()=>{fetch('/api/queue',{cache:'no-store'}).then(r=>r.json()).then(q=>{setPatients(q.patients??[]);const existing=q.carePlans?.['demo-ramesh'];if(existing){setPlan(existing.plan);setChecked(existing.checkedInAt);}}).catch(()=>setError('Saathi is not reachable.'));},[]);
  const set=<K extends keyof CarePlan>(k:K,v:CarePlan[K])=>setPlan({...plan,[k]:v});
  const demo=(k:keyof CarePlan['demographics'],v:string|number)=>setPlan({...plan,demographics:{...plan.demographics,[k]:v}});
  const med=(i:number,patch:Partial<CarePlan['medications'][number]>)=>set('medications',plan.medications.map((m,j)=>j===i?{...m,...patch}:m));
  const appt=(i:number,patch:Partial<CarePlan['appointments'][number]>)=>set('appointments',plan.appointments.map((a,j)=>j===i?{...a,...patch}:a));
  async function checkIn(){
    setBusy(true);setError('');
    try{const r=await fetch('/api/checkin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientId,plan})});const d=await r.json();if(!r.ok)throw Error(d.error);setChecked(d.checkedInAt);}
    catch(e){setError(e instanceof Error?e.message:'Check-in failed.');}finally{setBusy(false);}
  }
  return <div className="emr">
    <header className="emr-bar"><b>Demo Hospital EMR</b><span>Synthetic stand-in for a hospital information system · not a real hospital record</span></header>
    <main>
      <div className="emr-head"><div><div className="eyebrow">OPD VISIT · PALLIATIVE MEDICINE</div><h1>{plan.demographics.name}</h1><p>{plan.hospital.name} · Hospital ID {plan.hospital.hospitalId} · {plan.hospital.consultant}</p></div>
        <label>Saathi demo patient<select value={patientId} onChange={e=>{setPatientId(e.target.value);setChecked('');}}>{patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
      <section className="emr-grid">
        <fieldset><legend>Demographics</legend>
          <label>Name<input value={plan.demographics.name} onChange={e=>demo('name',e.target.value)}/></label>
          <label>Age<input type="number" value={plan.demographics.age} onChange={e=>demo('age',Number(e.target.value))}/></label>
          <label>Sex<select value={plan.demographics.sex} onChange={e=>demo('sex',e.target.value)}><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
          <label>Address<input value={plan.demographics.address} onChange={e=>demo('address',e.target.value)}/></label>
          <label>Caregiver<input value={plan.demographics.caregiver} onChange={e=>demo('caregiver',e.target.value)}/></label>
          <label>Relation<input value={plan.demographics.relation} onChange={e=>demo('relation',e.target.value)}/></label>
          <p className="muted">The caregiver’s phone comes from their private Saathi WhatsApp link, so no real number is typed here.</p>
        </fieldset>
        <fieldset><legend>Diagnosis and notes</legend>
          <label>Diagnosis<input value={plan.diagnosis} onChange={e=>set('diagnosis',e.target.value)}/></label>
          <label>OPD notes<textarea rows={5} value={plan.summary} onChange={e=>set('summary',e.target.value)}/></label>
          <label>Usual pain score (0–10)<input type="number" min={0} max={10} value={plan.usualPainScore??''} onChange={e=>set('usualPainScore',e.target.value===''?undefined:Number(e.target.value))}/></label>
        </fieldset>
      </section>
      <section><h2>Prescription</h2><table className="emr-table"><thead><tr><th>Medicine</th><th>Dose</th><th>When</th><th>Instructions</th><th>Rescue</th></tr></thead><tbody>{plan.medications.map((m,i)=><tr key={m.key}>
        <td><input value={m.name} onChange={e=>med(i,{name:e.target.value})}/></td><td><input value={m.dose} onChange={e=>med(i,{dose:e.target.value})}/></td>
        <td className="slots">{SLOTS.map(s=><label key={s}><input type="checkbox" disabled={m.rescue} checked={m.slots.includes(s)} onChange={e=>med(i,{slots:e.target.checked?[...m.slots,s]:m.slots.filter(x=>x!==s)})}/>{s}</label>)}</td>
        <td><input value={m.instructions} onChange={e=>med(i,{instructions:e.target.value})}/></td><td><input type="checkbox" checked={m.rescue} onChange={e=>med(i,{rescue:e.target.checked,slots:e.target.checked?[]:m.slots})}/></td></tr>)}</tbody></table></section>
      <section><h2>Follow-up plan</h2><table className="emr-table"><tbody>{plan.appointments.map((a,i)=><tr key={i}><td>{a.kind==='opd_visit'?'OPD visit':a.kind==='phone_followup'?'Phone follow-up':'Refill due'}</td><td><input type="date" value={a.date} onChange={e=>appt(i,{date:e.target.value})}/></td><td><input value={a.note} onChange={e=>appt(i,{note:e.target.value})}/></td></tr>)}</tbody></table></section>
      <section className="emr-consent"><label><input type="checkbox" checked={plan.consent.leafletGiven} onChange={e=>set('consent',{...plan.consent,leafletGiven:e.target.checked})}/> Saathi information leaflet given in OPD</label><label><input type="checkbox" checked={plan.consent.consented} onChange={e=>set('consent',{...plan.consent,consented:e.target.checked})}/> Family consented to Saathi follow-up</label></section>
      {error&&<p className="message error">{error}</p>}
      <div className="emr-submit"><button className="primary" disabled={busy||!plan.consent.consented} onClick={checkIn}>{busy?'Checking in…':checked?'Update Saathi check-in':'Submit notes · Check in to Saathi'}</button>
        {checked&&<p className="message success">Checked in to Saathi at {new Date(checked).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}. Saathi ID <b>{saathiId(patientId)}</b>. Medicine reminders and follow-ups now run from this plan. <a href={`/patients/${patientId}`} target="_blank" rel="noreferrer">Open the Saathi record ↗</a></p>}</div>
      {checked&&<section className="emr-demo"><h2>Demo: send a medicine reminder now</h2><p className="muted">Reminders normally go at 08:00, 14:00, 20:00 and 22:00 IST. The family must have messaged Saathi in the last 24 hours (WhatsApp’s free window), and the WhatsApp worker must be running.</p>
        <label>Slot<select value={slot} onChange={e=>setSlot(e.target.value as typeof slot)}>{SLOTS.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
        <button disabled={busy} onClick={async()=>{setQueued('');const r=await fetch('/api/reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientId,slot})});const d=await r.json();setQueued(r.ok?`The ${slot} reminder will be sent within 30 seconds.`:d.error);}}>Send reminder now</button>{queued&&<p className="message success">{queued}</p>}</section>}
    </main>
  </div>;
}
