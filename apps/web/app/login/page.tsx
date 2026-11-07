'use client';
import { useEffect, useState } from 'react';
import { JUDGE_EMAIL, JUDGE_PASSWORD } from '../../lib/judge-accounts';
type Role='medical'|'coordinator'|'family';
type Info={orgCode:string;demoSaathiId:string};
const home:Record<Role,string>={medical:'/',coordinator:'/coordinator',family:'/c'};
const ROLES:[Role,string,string][]=[
  ['medical','Doctor, nurse or psychologist','Care queue, patient records, call-backs and call notes.'],
  ['coordinator','Call manager','Daily call report, missed calls and fees. No clinical details.'],
  ['family','Patient or family','Ask for a call-back, see medicines and appointments.'],
];
// Judge demo views: the nurse or psychologist view is medical staff without prescription changes.
const DEMOS:[Role,string,string,string|undefined][]=[['medical','Doctor','Care queue, patient records, call-backs, call notes and prescription changes.','doctor'],['medical','Nurse or psychologist','Everything a doctor sees, except changing prescriptions.','nurse'],['coordinator','Call manager','Daily call report, contact details for scheduling and fees. No clinical details.',undefined],['family','Patient or family','A WhatsApp-style chat with Saathi, medicines and appointments.',undefined]];
const post=async(payload:object)=>{const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};

export default function Login(){
  const [info,setInfo]=useState<Info|null>(null),[tab,setTab]=useState<'signin'|'signup'>('signin'),[method,setMethod]=useState<'phone'|'email'>('phone');
  const [role,setRole]=useState<Role>('medical'),[name,setName]=useState(''),[login,setLogin]=useState(''),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[orgCode,setOrgCode]=useState(''),[staff,setStaff]=useState<'doctor'|'nurse'|'psychologist'>('doctor'),[sid,setSid]=useState(''),[agreed,setAgreed]=useState(false);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(setInfo).catch(()=>{});},[]);
  const run=async(task:()=>Promise<void>)=>{setBusy(true);setError('');try{await task();}catch(e){setError(e instanceof Error?e.message:'Something went wrong.');}finally{setBusy(false);}};
  const go=(r:Role)=>{window.location.href=home[r];};
  const switchTab=(t:'signin'|'signup')=>{setTab(t);setError('');};
  const signup=()=>run(async()=>{const d=await post({kind:'signup',role,name,method,password,agreed,...(method==='email'?{email}:{phone}),...(role==='family'?{saathiId:sid}:{orgCode}),...(role==='medical'?{staff}:{})});go(d.role);});
  return <main className="login">
    <div className="login-wrap">
      <a className="brand" href="/login"><span className="brandmark">s</span>saathi<span className="branddot">●</span></a>
      <p className="login-tag">A care continuity service for families caring for a palliative-care patient at home, with a call-back from their care team.</p>
      <section className="judge-card">
        <div className="eyebrow">JUDGING SAATHI? EXPLORE INSTANTLY</div>
        <h1>Try it in one click</h1>
        <p className="muted">Invented (synthetic) patients, no sign-up needed. Switch between the three views any time from the bar at the top. The doctor view starts with a short guided tour.</p>
        <div className="judge-roles">{DEMOS.map(([r,label,desc,staff])=><button key={label} disabled={busy} onClick={()=>run(async()=>{await post({kind:'demo',role:r,...(staff?{staff}:{})});go(r);})}><b>{label}</b><span>{desc}</span><i>Open →</i></button>)}</div>
              <div className="judge-creds"><b>Or sign in with the judge test login</b> (one login for all three views; switch views from the bar at the top)
          <p>Email <code>{JUDGE_EMAIL}</code> · Password <code>{JUDGE_PASSWORD}</code> <button type="button" onClick={()=>{setTab('signin');setLogin(JUDGE_EMAIL);setPassword(JUDGE_PASSWORD);setError('');document.querySelector('.login-card')?.scrollIntoView({behavior:'smooth'});}}>Fill in</button></p></div>
      </section>
      <section className="login-card">
        <div className="login-switch" role="tablist"><button role="tab" aria-selected={tab==='signin'} className={tab==='signin'?'active':''} onClick={()=>switchTab('signin')}>Sign in</button><button role="tab" aria-selected={tab==='signup'} className={tab==='signup'?'active':''} onClick={()=>switchTab('signup')}>Create an account</button></div>
        {tab==='signin'?<form onSubmit={e=>{e.preventDefault();run(async()=>{const d=await post({kind:'login',login,password});go(d.role);});}}>
            <label>Mobile number or email<input value={login} onChange={e=>setLogin(e.target.value)} required autoComplete="username" placeholder="+91 98450 12345 or name@example.com"/></label>
            <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>
            <button className="primary" disabled={busy} type="submit">{busy?'Signing in…':'Sign in'}</button>
            <p className="muted">No account yet? <button type="button" className="linkish" onClick={()=>switchTab('signup')}>Create one</button></p>
          </form>
        :<form onSubmit={e=>{e.preventDefault();signup();}}>
          <div className="role-pick">{ROLES.map(([r,label])=><button key={r} type="button" className={role===r?'active':''} onClick={()=>setRole(r)}>{label}</button>)}</div>
          {role==='medical'&&<label>I am a<select value={staff} onChange={e=>setStaff(e.target.value as typeof staff)}><option value="doctor">Doctor</option><option value="nurse">Nurse</option><option value="psychologist">Psychologist</option></select><small className="hint">Nurses and psychologists see everything except prescription changes.</small></label>}
          <label>{role==='family'?'Your name':'Full name'}<input value={name} onChange={e=>setName(e.target.value)} required maxLength={80} autoComplete="name"/></label>
          {role==='family'?<label>Saathi ID of the patient<input value={sid} onChange={e=>setSid(e.target.value)} required placeholder="SA-XXXXXX"/><small className="hint">On the leaflet from the OPD visit. Demo patient: <button type="button" className="linkish" onClick={()=>setSid(info?.demoSaathiId??'')}>{info?.demoSaathiId}</button> (Arjun Mehta, synthetic)</small></label>
            :<label>Organisation code<input value={orgCode} onChange={e=>setOrgCode(e.target.value)} required/><small className="hint">Given by your organisation’s Saathi administrator. Demo organisation: <button type="button" className="linkish" onClick={()=>setOrgCode(info?.orgCode??'')}>{info?.orgCode}</button></small></label>}
          <div className="method-pick"><button type="button" className={method==='phone'?'active':''} onClick={()=>setMethod('phone')}>Mobile number</button><button type="button" className={method==='email'?'active':''} onClick={()=>setMethod('email')}>Email</button></div>
          {method==='phone'?<label>Mobile number<input type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} required autoComplete="tel" placeholder="+91 98450 12345"/></label>
            :<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/><small className="hint">For relatives abroad without a working Indian number.</small></label>}
          <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete="new-password"/><small className="hint">At least 8 characters.</small></label>
          <label className="agree"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} required/><span>I have read the <a href="/terms" target="_blank">service terms and consent</a>. Saathi is not an emergency service: if the patient is very sick, go to the nearest hospital or call 108.</span></label>
          <button className="primary" disabled={busy} type="submit">{busy?'Creating…':'Create account'}</button>
        </form>}
        {error&&<p className="message error" role="alert">{error}</p>}
      </section>
      <p className="login-foot"><a href="/terms">Service terms and consent</a> · <a href="https://tushartechs.github.io/saathi-privacy/" target="_blank" rel="noreferrer">Privacy</a> · Synthetic demo data only. Never enter real patient information.</p>
    </div>
  </main>;
}
