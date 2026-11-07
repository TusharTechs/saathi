'use client';
import JudgeSwitcher from '../../components/JudgeSwitcher';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GREETING, GREETING_PATTERN, RIDER, closedMessage } from '../../../../packages/workflow/src/service-config';
import { LIBRARY, videoUrl } from '../../../../packages/workflow/src/family-content';
type Family={patient:{name:string;age:number;saathiId:string;hospital:string|null;hospitalId:string|null};medications:{key:string;name:string;dose:string;slots:string[];instructions:string}[];appointments:{kind:string;date:string;time?:string;note:string}[];requests:{id:string;createdAt:string;status:string;text:string;replies:string[]}[];closure:{reason:string}|null;fees:{enabled:boolean;audioCall:number;due:number;followUp:boolean;followUpWithinDays:number};slots:string[];events:{kind:string;value:number|null;note:string|null;at:string}[];prescriptions:{id:string;issuedAt:string;prescriber:string;items:number;verified:boolean}[]};
const SLOT_LABEL:Record<string,string>={morning:'Morning (8 am)',afternoon:'Afternoon (2 pm)',evening:'Evening (8 pm)',night:'Night (10 pm)'};
const lang=(t:string)=>/[\u0C80-\u0CFF]/.test(t)?'kn-IN':/[\u0900-\u097F]/.test(t)?'hi-IN':'en-IN';
// Links in fixed replies (approved hospice videos) become tappable.
const Linked=({text}:{text:string})=><>{text.split(/(https:\/\/www\.youtube\.com\/watch\?v=[\w-]+)/).map((part,i)=>part.startsWith('https://')?<a key={i} href={part} target="_blank" rel="noreferrer">Watch on YouTube ↗</a>:<span key={i}>{part}</span>)}</>;
const TZ='Asia/Kolkata',when=(at:string)=>new Date(at).toLocaleString('en-IN',{timeZone:TZ,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
/** Family web page, an alternative to WhatsApp: confirm the patient, describe the concern in words or a voice note, request a call-back. */
export default function FamilyPortal(){
  const [data,setData]=useState<Family|null>(null),[note,setNote]=useState(''),[updated,setUpdated]=useState(''),[confirmed,setConfirmed]=useState(false),[text,setText]=useState(''),[file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[greeted,setGreeted]=useState<{text:string;at:number}[]>([]);
  const chat=useRef<HTMLDivElement|null>(null);
  const load=useCallback(async()=>{const r=await fetch('/api/family',{cache:'no-store'});const d=await r.json();if(!r.ok){setError(d.error);return;}setData(d);},[]);
  useEffect(()=>{load();},[load]);
  // Scroll only the conversation, never the page.
  useEffect(()=>{const c=chat.current;if(c)c.scrollTop=c.scrollHeight;},[data,greeted,busy]);
  async function submit(){
    // Like WhatsApp: a greeting opens the conversation and creates no report.
    if(!file&&GREETING_PATTERN.test(text.trim())){setGreeted(g=>[...g,{text:text.trim(),at:Date.now()}]);setText('');return;}
    setBusy(true);setError('');
    try{
      const requestId=crypto.randomUUID();let r:Response;
      if(file){const form=new FormData();form.set('audio',file);form.set('requestId',requestId);form.set('language','unknown');form.set('synthetic','true');r=await fetch('/api/voice',{method:'POST',body:form});}
      else r=await fetch('/api/narrative',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,language:lang(text),synthetic:true,text})});
      const d=await r.json();if(!r.ok)throw Error(d.error);setText('');setFile(null);await load();
    }catch(e){setError(e instanceof Error?e.message:'Your request could not be sent. Please call the hospital.');}finally{setBusy(false);}
  }
  const update=async(payload:object,done:string)=>{setError('');try{const r=await fetch('/api/updates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw Error(d.error);setUpdated(done);setNote('');await load();}catch(e){setError(e instanceof Error?e.message:'Update not saved.');}};
  if(!data)return <main className="family"><p className="muted">{error||'Loading…'}</p></main>;
  return <><JudgeSwitcher/><main className="family">
    <header><a className="brand" href="/c"><span className="brandmark">s</span>saathi<span className="branddot">●</span></a><button onClick={async()=>{await fetch('/api/session',{method:'DELETE'});window.location.href='/login';}}>Sign out</button></header>
    <p className="family-rider">Saathi is a support service, not an emergency service. {RIDER}</p>
    {data.closure&&<section className="family-card"><h1>Saathi follow-up has ended</h1><p>{closedMessage(data.patient.name)}</p></section>}
    {data.closure?null:!confirmed?<section className="family-card"><h1>Is this the patient?</h1><dl><dt>Name</dt><dd>{data.patient.name}</dd><dt>Age</dt><dd>{data.patient.age}</dd><dt>Hospital</dt><dd>{data.patient.hospital??'—'} {data.patient.hospitalId?`(${data.patient.hospitalId})`:''}</dd><dt>Saathi ID</dt><dd>{data.patient.saathiId}</dd></dl>
      <button className="primary" onClick={()=>setConfirmed(true)}>Yes, continue</button><p className="muted">If these details are wrong, please call the hospital.</p></section>
    :<section className="family-card chat-card"><div className="chat-head"><span className="brandmark">s</span><div><b>Saathi</b><small>Your palliative care team · same replies as the Saathi WhatsApp line</small></div></div>
      <div className="chat" ref={chat}>
        <p className="bubble in">{GREETING}</p>
        {[...[...data.requests].reverse().map(r=>({at:Date.parse(r.createdAt),r,g:null as null|{text:string}})),...greeted.map(g=>({at:g.at,r:null,g}))].sort((a,b)=>a.at-b.at).map(({r,g},k)=>g?<div key={`g${k}`}><p className="bubble out">{g.text}</p><p className="bubble in">{GREETING}</p></div>:r&&<div key={r.id}><p className="bubble out">{r.text||'Voice note'}<time>{when(r.createdAt)}</time></p>{r.replies.map((t,i)=><p key={i} className={`bubble in ${/may be critical|emergency department/.test(t)?'urgent':''}`}><Linked text={t}/></p>)}<p className="chat-status">{r.status==='resolved'?'Call completed':r.status==='acked'?'The care team will call you':'Received by the care team'}</p></div>)}
        {busy&&<p className="bubble in typing">Saathi is reading your message…</p>}
      </div>
      {error&&<p className="message error">{error}</p>}
      {data.fees.enabled&&<p className="fee-note">Call-back fee: <b>₹{data.fees.due}</b>{data.fees.followUp?` (follow-up within ${data.fees.followUpWithinDays} days of your last call)`:` (first consultation; a follow-up within ${data.fees.followUpWithinDays} days costs less)`}. Demo: no payment is collected.</p>}
      <div className="chat-input"><textarea rows={2} maxLength={4000} value={text} onChange={e=>setText(e.target.value)} disabled={Boolean(file)||busy} placeholder="Type what is worrying you, in English, Hindi or Kannada" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(text.trim()||file)submit();}}}/>
        <label className="attach" title="Attach a voice note (up to 30 seconds)">🎤<input type="file" accept="audio/*" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
        <button className="primary" disabled={busy||(!text.trim()&&!file)} onClick={submit}>{busy?'…':'Send'}</button></div>
      {file&&<p className="muted">Voice note: {file.name} <button className="linkish" onClick={()=>setFile(null)}>remove</button></p>}
    </section>}
    {confirmed&&!data.closure&&<section className="family-card"><h2>Today’s update</h2><p className="muted">Takes a few seconds and helps the care team see how things are going between calls.</p>
      <div className="upd"><b>Pain right now (0 = no pain, 10 = worst)</b><div className="pain-scale">{Array.from({length:11},(_,n)=><button key={n} onClick={()=>update({kind:'pain',value:n},`Pain score ${n} recorded.`)}>{n}</button>)}</div></div>
      {data.slots.length>0&&<div className="upd"><b>Medicines today</b>{data.slots.map(slot=><div key={slot} className="dose-row"><span>{SLOT_LABEL[slot]??slot}</span><button onClick={()=>update({kind:'dose',slot,status:'given'},`${SLOT_LABEL[slot]??slot} medicines recorded as given.`)}>All given</button><button onClick={()=>update({kind:'dose',slot,status:'not_given'},`Recorded that the ${slot} medicines were not given. The care team can see this.`)}>Not given</button></div>)}</div>}
      <div className="upd"><b>Hospital stay</b><p className="muted">Please let us know if the patient is admitted to any hospital or discharged home.</p><input value={note} onChange={e=>setNote(e.target.value)} maxLength={300} placeholder="Hospital name (optional)"/><div className="dose-row"><button onClick={()=>update({kind:'admitted',note},'Admission recorded. Thank you for letting us know.')}>Admitted to hospital</button><button onClick={()=>update({kind:'discharged',note},'Discharge recorded. The care team will call you for a follow-up in about two weeks.')}>Discharged home</button></div></div>
      {updated&&<p className="message success">{updated}</p>}
    </section>}
    {data.medications.length>0&&<section className="family-card"><h2>Your medicines</h2><ul>{data.medications.map(m=><li key={m.key}><b>{m.name} {m.dose}</b> · {m.slots.join(', ')}{m.instructions?` · ${m.instructions}`:''}</li>)}</ul><p className="muted">As prescribed by your doctor. Do not change doses without speaking to the care team.</p></section>}
    {data.appointments.length>0&&<section className="family-card"><h2>Upcoming</h2><ul>{data.appointments.map((a,i)=><li key={i}>{a.kind==='opd_visit'?'OPD visit':a.kind==='phone_followup'?'Phone follow-up':'Refill due'} · {new Date(a.date+'T12:00:00+05:30').toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}{a.time?` ${a.time}`:''}</li>)}</ul></section>}
    {data.prescriptions.length>0&&<section className="family-card"><h2>Prescription updates</h2><ul>{data.prescriptions.map(r=><li key={r.id}>{when(r.issuedAt)} · {r.prescriber} updated the prescription after your call</li>)}</ul><p className="muted">Collect the printed prescription at the OPD within 2–3 working days. Prescriptions are not sent by phone.</p></section>}
    <section className="family-card"><h2>Caring at home: short videos</h2><p className="muted">From recognised hospices, recommended by your palliative care team. They open on YouTube.</p><ul className="video-list">{LIBRARY.map(v=><li key={v.id}><a href={videoUrl(v)} target="_blank" rel="noreferrer">{v.title}</a><small>{v.source} · {v.language}</small></li>)}</ul></section>
    <p className="login-foot"><a href="/terms">Service terms and consent</a> · <a href="https://tushartechs.github.io/saathi-privacy/" target="_blank" rel="noreferrer">Privacy</a> · Synthetic demo data only</p>
  </main></>;
}
