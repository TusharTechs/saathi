'use client';
import JudgeSwitcher from '../../components/JudgeSwitcher';
import { useCallback, useEffect, useState } from 'react';
type Row={id:string;date:string;createdAt:string;patient:string;hospitalId:string|null;saathiId:string|null;urgency:string;status:'open'|'acked'|'resolved';acknowledgedBy:string|null;acknowledgedAt:string|null;closedAt:string|null;done:string;fee:'due'|'paid'|'waived';channel:string;assignee:'doctor'|'nurse'|'psychologist'|null};
const TZ='Asia/Kolkata',today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const t=(at:string|null)=>at?new Date(at).toLocaleTimeString('en-IN',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}):'—';
const rank:Record<string,number>={RED:0,AMBER:1,REVIEW:2,PENDING:2,GREEN:3};
/** Call manager's view: who called, how urgent, whether it was handled, and fees. No clinical content. */
export default function Coordinator(){
  const [rows,setRows]=useState<Row[]>([]),[date,setDate]=useState(today()),[error,setError]=useState(''),[fees,setFees]=useState<{enabled:boolean;audioCall:number}|null>(null);
  const load=useCallback(async()=>{try{const r=await fetch('/api/report',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);setRows(d.rows);setFees(d.fees);setError('');}catch(e){setError(e instanceof Error?e.message:'Report unavailable.');}},[]);
  useEffect(()=>{load();const id=setInterval(load,10000);return ()=>clearInterval(id);},[load]);
  const day=rows.filter(r=>r.date===date).sort((a,b)=>(rank[a.urgency]??2)-(rank[b.urgency]??2)||Date.parse(a.createdAt)-Date.parse(b.createdAt));
  const n=(f:(r:Row)=>boolean)=>day.filter(f).length;
  const act=async(id:string,payload:object)=>{const r=await fetch(`/api/alerts/${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(r.ok)load();else setError((await r.json()).error);};
  const setFee=(id:string,status:Row['fee'])=>act(id,{action:'fee',status});
  return <><JudgeSwitcher/><main className="coord">
    <header className="coord-head"><div><div className="eyebrow">SAATHI · CALL MANAGER · SYNTHETIC DATA</div><h1>Daily call report</h1><p className="muted">Counts, status and fees only. Clinical details are visible to medical staff.</p></div>
      <div className="coord-tools no-print"><label>Date<input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value||today())}/></label><button className="primary" onClick={()=>window.print()}>Export PDF</button><button onClick={async()=>{await fetch('/api/session',{method:'DELETE'});window.location.href='/login';}}>Sign out</button></div></header>
    <p className="print-only">Report date {date} · generated {new Date().toLocaleString('en-IN',{timeZone:TZ})} · synthetic demo data</p>
    {error&&<p className="message error">{error}</p>}
    <section className="coord-counts"><div><b>{day.length}</b>calls received</div><div className="red"><b>{n(r=>r.urgency==='RED')}</b>RED</div><div className="amber"><b>{n(r=>r.urgency==='AMBER')}</b>AMBER</div><div><b>{n(r=>r.urgency!=='RED'&&r.urgency!=='AMBER')}</b>GREEN / review</div><div><b>{n(r=>r.status!=='open')}</b>acknowledged</div><div className="done"><b>{n(r=>r.status==='resolved')}</b>completed</div><div className="red"><b>{n(r=>r.status==='open')}</b>waiting</div></section>
    <table className="coord-table"><thead><tr><th>Received</th><th>Patient</th><th>Hospital ID</th><th>Urgency</th><th>What was done</th><th>Assigned to</th><th>Acknowledged</th><th>Closed</th>{fees?.enabled&&<th>Fee (₹{fees.audioCall})</th>}</tr></thead>
      <tbody>{day.length===0?<tr><td colSpan={9} className="muted">No calls on this day.</td></tr>:day.map(r=><tr key={r.id} className={r.status==='open'?'waiting':''}>
        <td>{t(r.createdAt)} · {r.channel}</td><td>{r.patient}<small>{r.saathiId}</small></td><td>{r.hospitalId??'—'}</td><td><span className={`pill ${r.urgency==='REVIEW'?'pending':r.urgency.toLowerCase()}`}>{r.urgency}</span></td><td>{r.done}</td><td>{r.urgency==='RED'?<span className="muted">On-call doctor</span>:r.status==='resolved'?(r.assignee??'—'):<><select className="no-print" value={r.assignee??''} onChange={e=>act(r.id,{action:'assign',assignee:e.target.value})}><option value="" disabled>Choose…</option><option value="doctor">Doctor</option><option value="nurse">Nurse</option><option value="psychologist">Psychologist</option></select><span className="print-only">{r.assignee??'—'}</span></>}</td><td>{r.acknowledgedBy?`${t(r.acknowledgedAt)} · ${r.acknowledgedBy}`:'—'}</td><td>{t(r.closedAt)}</td>
        {fees?.enabled&&<td><select className="no-print" value={r.fee} onChange={e=>setFee(r.id,e.target.value as Row['fee'])}><option value="due">Due</option><option value="paid">Paid</option><option value="waived">Waived</option></select><span className="print-only">{r.fee}</span></td>}</tr>)}</tbody></table>
  </main></>;
}
