'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
type Role='medical'|'coordinator'|'family';
type Info={whatsappLogin:boolean;orgCode:string;demoSaathiId:string};
type Challenge={id:string;code:string;text:string;link:string;qr:string;number:string};
const home:Record<Role,string>={medical:'/',coordinator:'/coordinator',family:'/c'};
const ROLES:[Role,string,string][]=[
  ['medical','Doctor, nurse or psychologist','Care queue, patient records, call-backs and call notes.'],
  ['coordinator','Call manager','Daily call report, missed calls and fees. No clinical details.'],
  ['family','Patient or family','Ask for a call-back, see medicines and appointments.'],
];
const post=async(payload:object)=>{const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};

/** Shows a WhatsApp sign-in code and waits until the person sends it from their phone. */
function WhatsAppVerify({onVerified}:{onVerified:(challengeId:string)=>void}){
  const [c,setC]=useState<Challenge|null>(null),[error,setError]=useState(''),[expired,setExpired]=useState(false);
  const start=useCallback(async()=>{setError('');setExpired(false);try{setC(await post({kind:'challenge'}));}catch(e){setError(e instanceof Error?e.message:'Could not create a code.');}},[]);
  const done=useRef(false);
  useEffect(()=>{if(!c)return;done.current=false;const id=setInterval(async()=>{try{const r=await fetch(`/api/session?challenge=${c.id}`,{cache:'no-store'});const d=await r.json();if(d.verified&&!done.current){done.current=true;clearInterval(id);onVerified(c.id);}else if(d.expired){clearInterval(id);setExpired(true);}}catch{/* keep polling */}},2000);return ()=>clearInterval(id);},[c,onVerified]);
  if(!c)return <div className="wa-start"><button type="button" className="wa-button" onClick={start}>Verify my mobile with WhatsApp</button><p className="muted">You send us a short code from your WhatsApp. It is free, and no SMS is needed.</p>{error&&<p className="message error">{error}</p>}</div>;
  return <div className="wa-box">
    <div><p>Send this message to Saathi on WhatsApp <b>{c.number}</b>:</p><p className="wa-code">{c.text}</p>
      <a className="wa-button" href={c.link} target="_blank" rel="noreferrer">Open WhatsApp</a>
      <p className="muted">{expired?<>This code expired. <button type="button" className="linkish" onClick={start}>Get a new code</button></>:<><span className="live-dot"/>Waiting for your message… this page continues by itself.</>}</p></div>
    <div className="wa-qr"><div dangerouslySetInnerHTML={{__html:c.qr}}/><small>On a computer? Scan with your phone camera.</small></div>
  </div>;
}

export default function Login(){
  const [info,setInfo]=useState<Info|null>(null),[tab,setTab]=useState<'signin'|'signup'>('signin'),[method,setMethod]=useState<'whatsapp'|'email'>('whatsapp');
  const [role,setRole]=useState<Role>('medical'),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[orgCode,setOrgCode]=useState(''),[sid,setSid]=useState(''),[agreed,setAgreed]=useState(false);
  const [verified,setVerified]=useState<{id:string;phone?:string}|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[key,setKey]=useState(0);
  useEffect(()=>{fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(d=>{setInfo(d);if(!d.whatsappLogin)setMethod('email');}).catch(()=>{});},[]);
  const run=async(task:()=>Promise<void>)=>{setBusy(true);setError('');try{await task();}catch(e){setError(e instanceof Error?e.message:'Something went wrong.');}finally{setBusy(false);}};
  const go=(r:Role)=>{window.location.href=home[r];};
  const switchTab=(t:'signin'|'signup')=>{setTab(t);setError('');setNotice('');setVerified(null);setKey(k=>k+1);};
  const onSigninVerified=useCallback((id:string)=>run(async()=>{const d=await post({kind:'whatsapp-login',challengeId:id});
    if(d.needsSignup){setTab('signup');setVerified({id,phone:d.phone});setNotice(`${d.phone} is verified. Finish creating your account.`);return;}go(d.role);}),[]);
  const onSignupVerified=useCallback((id:string)=>setVerified({id}),[]);
  const signup=()=>run(async()=>{const d=await post({kind:'signup',role,name,method,agreed,...(method==='email'?{email,password}:{challengeId:verified?.id}),...(role==='family'?{saathiId:sid}:{orgCode})});go(d.role);});
  return <main className="login">
    <div className="login-wrap">
      <a className="brand" href="/login"><span className="brandmark">s</span>saathi<span className="branddot">●</span></a>
      <p className="login-tag">Out-of-hours support for families caring for a palliative-care patient at home, with a call-back from their care team.</p>
      <section className="judge-card">
        <div className="eyebrow">JUDGING SAATHI? EXPLORE INSTANTLY</div>
        <h1>Try it in one click</h1>
        <p className="muted">Shared demo accounts with invented (synthetic) patients. No sign-up needed. The doctor view includes a short guided tour.</p>
        <div className="judge-roles">{ROLES.map(([r,label,desc])=><button key={r} disabled={busy} onClick={()=>run(async()=>{await post({kind:'demo',role:r});go(r);})}><b>{label}</b><span>{desc}</span><i>Open →</i></button>)}</div>
      </section>
      <section className="login-card">
        <div className="login-switch" role="tablist"><button role="tab" aria-selected={tab==='signin'} className={tab==='signin'?'active':''} onClick={()=>switchTab('signin')}>Sign in</button><button role="tab" aria-selected={tab==='signup'} className={tab==='signup'?'active':''} onClick={()=>switchTab('signup')}>Create an account</button></div>
        {tab==='signup'&&<div className="role-pick">{ROLES.map(([r,label])=><button key={r} type="button" className={role===r?'active':''} onClick={()=>setRole(r)}>{label}</button>)}</div>}
        {info?.whatsappLogin&&!(tab==='signup'&&verified)&&<div className="method-pick"><button type="button" className={method==='whatsapp'?'active':''} onClick={()=>setMethod('whatsapp')}>Mobile number (WhatsApp)</button><button type="button" className={method==='email'?'active':''} onClick={()=>setMethod('email')}>Email and password</button></div>}
        {notice&&<p className="message success">{notice}</p>}
        {tab==='signin'?(method==='whatsapp'?<WhatsAppVerify key={key} onVerified={onSigninVerified}/>
          :<form onSubmit={e=>{e.preventDefault();run(async()=>{const d=await post({kind:'email-login',email,password});go(d.role);});}}>
            <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>
            <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>
            <button className="primary" disabled={busy} type="submit">{busy?'Signing in…':'Sign in'}</button>
            <p className="muted">No account yet? <button type="button" className="linkish" onClick={()=>switchTab('signup')}>Create one</button></p>
          </form>)
        :<form onSubmit={e=>{e.preventDefault();signup();}}>
          <label>{role==='family'?'Your name':'Full name'}<input value={name} onChange={e=>setName(e.target.value)} required maxLength={80} autoComplete="name"/></label>
          {role==='family'?<label>Saathi ID of the patient<input value={sid} onChange={e=>setSid(e.target.value)} required placeholder="SA-XXXXXX"/><small className="hint">On the leaflet from the OPD visit. Demo patient: <button type="button" className="linkish" onClick={()=>setSid(info?.demoSaathiId??'')}>{info?.demoSaathiId}</button> (Ramesh K., synthetic)</small></label>
            :<label>Organisation code<input value={orgCode} onChange={e=>setOrgCode(e.target.value)} required/><small className="hint">Given by your organisation’s Saathi administrator. Demo organisation: <button type="button" className="linkish" onClick={()=>setOrgCode(info?.orgCode??'')}>{info?.orgCode}</button></small></label>}
          {method==='email'?<><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/><small className="hint">Works for relatives abroad without an Indian number.</small></label>
            <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete="new-password"/></label></>
            :verified?<p className="message success">Mobile number verified{verified.phone?` (${verified.phone})`:''}.</p>:<WhatsAppVerify key={key} onVerified={onSignupVerified}/>}
          <label className="agree"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} required/><span>I have read the <a href="/terms" target="_blank">service terms and consent</a>. Saathi is not an emergency service: if the patient is very sick, go to the nearest hospital or call 108.</span></label>
          <button className="primary" disabled={busy||(method==='whatsapp'&&!verified)} type="submit">{busy?'Creating…':'Create account'}</button>
        </form>}
        {error&&<p className="message error" role="alert">{error}</p>}
      </section>
      <p className="login-foot"><a href="/terms">Service terms and consent</a> · <a href="https://tushartechs.github.io/saathi-privacy/" target="_blank" rel="noreferrer">Privacy</a> · Synthetic demo data only. Never enter real patient information.</p>
    </div>
  </main>;
}
