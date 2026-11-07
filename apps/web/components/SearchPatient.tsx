'use client';
import { useState } from 'react';
import { SLOTS } from '../../../packages/workflow/src/care-plan';
import type { Workspace } from './CareQueue';
const REASON:Record<string,string>={died:'Patient died',transferred:'Transferred to another palliative care team',other:'Other'};
const stamp=(at:string)=>new Date(at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
/**
 * Dr. Rao (7 Nov): when a call bypasses Saathi and comes straight to the team, staff search the patient by ID or name.
 * Doctors also close follow-up here when a patient dies or moves to another primary team.
 */
export default function SearchPatient({ws,busy,perform,send,setNotice}:{ws:Workspace;busy:boolean;perform:(task:()=>Promise<void>)=>Promise<void>;send:(url:string,payload:object)=>Promise<unknown>;setNotice:(n:string)=>void}){
  const [q,setQ]=useState(''),[picked,setPicked]=useState<string|null>(null),[reason,setReason]=useState<'died'|'transferred'|'other'>('transferred'),[note,setNote]=useState(''),[slot,setSlot]=useState<typeof SLOTS[number]>('morning');
  const term=q.trim().toLowerCase().replace(/\s+/g,' ');
  const rows=ws.patients.map(p=>{const plan=ws.carePlans[p.id]?.plan;return {p,plan,name:plan?.demographics.name??p.name,hospitalId:plan?.hospital.hospitalId??''};});
  const hits=term?rows.filter(r=>[r.name,r.p.saathiId,r.hospitalId,r.p.whatsapp??'',r.p.abha].some(v=>v.toLowerCase().includes(term))):[];
  const chosen=rows.find(r=>r.p.id===picked)??(hits.length===1?hits[0]:undefined);
  const reports=chosen?ws.records.filter(r=>r.patientId===chosen.p.id):[];
  return <section className="search-patient">
    <div className="section-head"><div><h2>Search patient</h2><p>Name, Saathi ID, hospital ID, ABHA (simulated) or phone number</p></div></div>
    <input className="search-box" type="search" autoFocus value={q} onChange={e=>{setQ(e.target.value);setPicked(null);}} placeholder="e.g. Arjun, SA-…, DEMO-PC-0001"/>
    {term&&!hits.length&&<p className="muted">No patient matches “{q}”.</p>}
    {hits.length>1&&!chosen&&<ul className="search-hits">{hits.map(r=><li key={r.p.id}><button onClick={()=>setPicked(r.p.id)}><b>{r.name}</b><span>{r.p.saathiId}{r.hospitalId?` · ${r.hospitalId}`:''}</span></button></li>)}</ul>}
    {!term&&<p className="muted">Use this when a family calls the team directly, outside Saathi.</p>}
    {chosen&&<div className="search-card">
      <div className="demo-top"><div><div className="eyebrow">{chosen.plan?.closure?'SAATHI FOLLOW-UP CLOSED':chosen.plan?'ACTIVE ON SAATHI':'NOT CHECKED IN FROM THE HOSPITAL RECORD'}</div><h3>{chosen.name}</h3>
        <p>{chosen.plan?`${chosen.plan.demographics.age} yr · ${chosen.plan.demographics.sex} · ${chosen.plan.diagnosis}`:`${chosen.p.age} yr · ${chosen.p.diagnosis}`}</p></div>
        <a className="call timeline" href={`/patients/${chosen.p.id}`} target="_blank" rel="noreferrer">Open full record ↗</a></div>
      <dl><div><dt>Saathi ID</dt><dd>{chosen.p.saathiId}</dd></div><div><dt>Hospital ID</dt><dd>{chosen.hospitalId||'—'}</dd></div><div><dt>ABHA (simulated)</dt><dd>{chosen.p.abha}</dd></div><div><dt>Reports</dt><dd>{reports.length} · {reports.filter(r=>r.status!=='resolved').length} open</dd></div></dl>
      {chosen.plan?.closure?<div className="closure"><p><b>{REASON[chosen.plan.closure.reason]}</b> · closed {stamp(chosen.plan.closure.closedAt)} by {chosen.plan.closure.closedBy}{chosen.plan.closure.note?` · ${chosen.plan.closure.note}`:''}</p><p className="muted">Reminders and call-backs have stopped. If the family messages Saathi, they are asked to call the OPD.</p>
          <button disabled={busy} onClick={()=>perform(async()=>{await send(`/api/patients/${chosen.p.id}`,{action:'reopen'});setNotice('Saathi follow-up reopened.');})}>Reopen follow-up</button></div>
        :chosen.plan&&<div className="search-actions">
          <div><h4>Send a medicine reminder now</h4><select value={slot} onChange={e=>setSlot(e.target.value as typeof slot)}>{SLOTS.map(s=><option key={s} value={s}>{s}</option>)}</select><button disabled={busy} onClick={()=>perform(async()=>{await send('/api/reminders',{patientId:chosen.p.id,slot});setNotice(`The ${slot} reminder will go out on WhatsApp within a minute, if the family messaged Saathi in the last 24 hours.`);})}>Send</button></div>
          <div><h4>Close Saathi follow-up</h4><select value={reason} onChange={e=>setReason(e.target.value as typeof reason)}>{Object.entries(REASON).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><input value={note} maxLength={300} onChange={e=>setNote(e.target.value)} placeholder="Note (optional)"/>
            <button disabled={busy} onClick={()=>{if(!window.confirm(`Close Saathi follow-up for ${chosen.name}? Reminders and call-backs stop; the record is kept.`))return;perform(async()=>{await send(`/api/patients/${chosen.p.id}`,{action:'close',reason,note});setNote('');setNotice('Saathi follow-up closed. The record is kept.');});}}>Close follow-up</button></div>
        </div>}
    </div>}
  </section>;
}
