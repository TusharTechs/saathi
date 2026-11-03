'use client';
import { useEffect, useState } from 'react';
type Mode='medical'|'coordinator'|'family';
const post=async(payload:object)=>{const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
/** Simulated sign-in with the three roles Dr. Rao described. One-time codes are shown on screen; nothing is sent. */
export default function Login(){
  const [mode,setMode]=useState<Mode>('medical'),[name,setName]=useState('Demo doctor 1'),[contact,setContact]=useState(''),[code,setCode]=useState(''),[demoCode,setDemoCode]=useState(''),[sid,setSid]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[staffCode,setStaffCode]=useState(''),[hosted,setHosted]=useState(false),[agreed,setAgreed]=useState(false);
  useEffect(()=>{fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(d=>setHosted(Boolean(d.publicDemo))).catch(()=>{});},[]);
  const run=async(task:()=>Promise<void>)=>{setBusy(true);setError('');try{await task();}catch(e){setError(e instanceof Error?e.message:'Sign-in failed.');}finally{setBusy(false);}};
  const go=(path:string)=>{window.location.href=path;};
  return <main className="login">
    <div className="login-card">
      <a className="brand" href="/login"><span className="brandmark">s</span>saathi<span className="branddot">●</span></a>
      <h1>Sign in</h1><p className="muted">Demo sign-in with synthetic data. Codes are shown on screen because no SMS or email is sent.</p>
      <div className="login-tabs" role="tablist">{([['medical','Doctor, nurse or psychologist'],['coordinator','Call manager (non-medical)'],['family','Patient or family']] as const).map(([m,label])=><button key={m} role="tab" aria-selected={mode===m} className={mode===m?'active':''} onClick={()=>{setMode(m);setError('');setName(m==='medical'?'Demo doctor 1':m==='coordinator'?'Demo call manager':'');}}>{label}</button>)}</div>
      {mode!=='family'?<form onSubmit={e=>{e.preventDefault();run(async()=>{await post({kind:'staff',role:mode,name,...(hosted?{code:staffCode}:{})});go(mode==='medical'?'/':'/coordinator');});}}>
        <label>Name<input value={name} onChange={e=>setName(e.target.value)} required maxLength={60}/></label>
        {hosted&&<label>Staff access code<input type="password" value={staffCode} onChange={e=>setStaffCode(e.target.value)} required autoComplete="current-password"/></label>}
        <p className="muted">{mode==='medical'?'Full patient and clinical details, call-backs, call notes and the hospital record.':'Daily counts, urgency, status and fees only. No symptoms, quotes or clinical notes.'}</p>
        <button className="primary" disabled={busy} type="submit">Sign in</button>
      </form>:<form onSubmit={e=>{e.preventDefault();run(async()=>{if(!demoCode){const d=await post({kind:'code',contact});setDemoCode(d.demoCode);return;}await post({kind:'family',contact,code,saathiId:sid,agreed});go('/c');});}}>
        <label>Mobile number or email<input value={contact} onChange={e=>{setContact(e.target.value);setDemoCode('');}} required placeholder="Email works if your Indian number is not available"/></label>
        {demoCode&&<><p className="message success">Demo code: <b>{demoCode}</b> (in a real service this arrives by SMS or email)</p>
          <label>One-time code<input value={code} onChange={e=>setCode(e.target.value)} required inputMode="numeric" maxLength={6}/></label>
          <label>Saathi ID (on the leaflet from your OPD visit)<input value={sid} onChange={e=>setSid(e.target.value)} required placeholder="SA-XXXXXX"/></label>
          <label className="agree"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} required/><span>I have read the <a href="/terms" target="_blank">service terms and consent</a>. I understand Saathi is not an emergency service: if the patient is very sick, I will go to the nearest hospital or call 108.</span></label></>}
        <button className="primary" disabled={busy} type="submit">{demoCode?'Sign in':'Send code'}</button>
      </form>}
      {error&&<p className="message error" role="alert">{error}</p>}
      <p className="login-foot"><a href="/terms">Service terms and consent</a> · <a href="https://tushartechs.github.io/saathi-privacy/" target="_blank" rel="noreferrer">Privacy</a></p>
    </div>
  </main>;
}
