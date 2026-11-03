'use client';
import { useCallback, useEffect, useState } from 'react';
type Family={patient:{name:string;age:number;saathiId:string;hospital:string|null;hospitalId:string|null};medications:{key:string;name:string;dose:string;slots:string[];instructions:string}[];appointments:{kind:string;date:string;time?:string;note:string}[];requests:{id:string;createdAt:string;status:string;reply:string}[];fees:{enabled:boolean;audioCall:number}};
const TZ='Asia/Kolkata',when=(at:string)=>new Date(at).toLocaleString('en-IN',{timeZone:TZ,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
/** Family web page, an alternative to WhatsApp: confirm the patient, describe the concern in words or a voice note, request a call-back. */
export default function FamilyPortal(){
  const [data,setData]=useState<Family|null>(null),[confirmed,setConfirmed]=useState(false),[text,setText]=useState(''),[file,setFile]=useState<File|null>(null),[reply,setReply]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{const r=await fetch('/api/family',{cache:'no-store'});const d=await r.json();if(!r.ok){setError(d.error);return;}setData(d);},[]);
  useEffect(()=>{load();},[load]);
  async function submit(){
    setBusy(true);setError('');setReply('');
    try{
      const requestId=crypto.randomUUID();let r:Response;
      if(file){const form=new FormData();form.set('audio',file);form.set('requestId',requestId);form.set('language','en-IN');form.set('synthetic','true');r=await fetch('/api/voice',{method:'POST',body:form});}
      else r=await fetch('/api/narrative',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,language:'en-IN',synthetic:true,text})});
      const d=await r.json();if(!r.ok)throw Error(d.error);setText('');setFile(null);await load();setReply('sent');
    }catch(e){setError(e instanceof Error?e.message:'Your request could not be sent. Please call the hospital.');}finally{setBusy(false);}
  }
  if(!data)return <main className="family"><p className="muted">{error||'Loading…'}</p></main>;
  const latest=data.requests[0];
  return <main className="family">
    <header><a className="brand" href="/c"><span className="brandmark">s</span>saathi<span className="branddot">●</span></a><button onClick={async()=>{await fetch('/api/session',{method:'DELETE'});window.location.href='/login';}}>Sign out</button></header>
    <p className="family-rider">Saathi is a support service, not an emergency service. If the patient is very sick, go to the nearest hospital or call 108 now.</p>
    {!confirmed?<section className="family-card"><h1>Is this the patient?</h1><dl><dt>Name</dt><dd>{data.patient.name}</dd><dt>Age</dt><dd>{data.patient.age}</dd><dt>Hospital</dt><dd>{data.patient.hospital??'—'} {data.patient.hospitalId?`(${data.patient.hospitalId})`:''}</dd><dt>Saathi ID</dt><dd>{data.patient.saathiId}</dd></dl>
      <button className="primary" onClick={()=>setConfirmed(true)}>Yes, continue</button><p className="muted">If these details are wrong, please call the hospital.</p></section>
    :<section className="family-card"><h1>What is worrying you today?</h1><p className="muted">Write in your own words or attach a short voice note (up to 30 seconds). The care team will call you back. English only in this demo.</p>
      <textarea rows={5} maxLength={4000} value={text} onChange={e=>setText(e.target.value)} disabled={Boolean(file)} placeholder="For example: he is very sleepy today and I gave the extra dose three times"/>
      <label className="file">Or attach a voice note<input type="file" accept="audio/*" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
      {data.fees.enabled&&<p className="fee-note">A teleconsultation fee of ₹{data.fees.audioCall} applies to a call-back (demo: no payment is collected; the hospital confirms the fee with you).</p>}
      <button className="primary" disabled={busy||(!text.trim()&&!file)} onClick={submit}>{busy?'Sending…':'Request a call-back'}</button>
      {error&&<p className="message error">{error}</p>}
      {reply&&latest&&<p className={`family-reply ${/critical/.test(latest.reply)?'urgent':''}`}>{latest.reply}</p>}</section>}
    {data.medications.length>0&&<section className="family-card"><h2>Your medicines</h2><ul>{data.medications.map(m=><li key={m.key}><b>{m.name} {m.dose}</b> · {m.slots.join(', ')}{m.instructions?` · ${m.instructions}`:''}</li>)}</ul><p className="muted">As prescribed by your doctor. Do not change doses without speaking to the care team.</p></section>}
    {data.appointments.length>0&&<section className="family-card"><h2>Upcoming</h2><ul>{data.appointments.map((a,i)=><li key={i}>{a.kind==='opd_visit'?'OPD visit':a.kind==='phone_followup'?'Phone follow-up':'Refill due'} · {new Date(a.date+'T12:00:00+05:30').toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}{a.time?` ${a.time}`:''}</li>)}</ul></section>}
    {data.requests.length>0&&<section className="family-card"><h2>Your requests</h2><ul>{data.requests.map(r=><li key={r.id}>{when(r.createdAt)} · {r.status==='resolved'?'Call completed':r.status==='acked'?'The care team will call you':'Received'}</li>)}</ul></section>}
    <p className="login-foot"><a href="/terms">Service terms and consent</a> · <a href="https://tushartechs.github.io/saathi-privacy/" target="_blank" rel="noreferrer">Privacy</a> · Synthetic demo data only</p>
  </main>;
}
