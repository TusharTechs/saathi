'use client';
import JudgeSwitcher from '../components/JudgeSwitcher';
import RedAlert from '../components/RedAlert';
import { useCallback, useEffect, useState } from 'react';
import ClinicalReview from '../components/ClinicalReview';
import PatientWorkspace from '../components/PatientWorkspace';
import {checkinQuestions,checkinAnswers} from '../../../packages/workflow/src/checkin';
import VoiceIntake from '../components/VoiceIntake';
import JudgeTour,{type TourView} from '../components/JudgeTour';
import CareQueue,{type Workspace} from '../components/CareQueue';
import type { Intake, RecordEntry } from '../../../packages/workflow/src/index';
type Queue=Workspace;
const EMPTY:Queue={patients:[],records:[],team:[],storage:null,carePlans:{},fees:{}};
export default function Page(){
 const [queue,setQueue]=useState<Queue>(EMPTY),[selected,setSelected]=useState<string|null>(null),[view,setView]=useState<'queue'|'intake'|'patients'|'review'>('queue');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const [patientId,setPatientId]=useState('demo-ramesh'),[answers,setAnswers]=useState<Record<string,string>>({});
 const [requestId,setRequestId]=useState('');
 const [pendingPayload,setPendingPayload]=useState<object|null>(null);
 const [me,setMe]=useState<{name:string;role:string}|null>(null),[touring,setTouring]=useState(false);
 useEffect(()=>{fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(d=>setMe(d.session)).catch(()=>{});},[]);
 // The judges' walkthrough opens with ?tour=1, or once on a first visit; anyone can skip it.
 useEffect(()=>{const q=new URLSearchParams(window.location.search);if(q.get('tour')==='1'||!localStorage.getItem('saathi-tour-seen'))setTouring(true);},[]);
 const initials=(me?.name??'Demo doctor').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
 const refresh=useCallback(async()=>{const response=await fetch('/api/queue',{cache:'no-store'});const data=await response.json();if(!response.ok) throw new Error(data.error);setQueue(data);setLoaded(true);},[]);
 // Deep links from the guided tour: /?view=intake|patients|review.
 useEffect(()=>{const v=new URLSearchParams(window.location.search).get('view');if(v==='intake'||v==='patients'||v==='review')setView(v);},[]);
 useEffect(()=>{refresh().catch(e=>setError(e.message));const id=setInterval(()=>refresh().catch(e=>setError(e.message)),5000);return ()=>clearInterval(id);},[refresh]);
 const send=async(url:string,payload:object)=>{const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok) throw new Error(data.error);return data;};
 const perform=async(task:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await task();await refresh();}catch(e){setError(e instanceof Error?e.message:'Operation failed');}finally{setBusy(false);}};
 const intake=async(scenario?:Intake['scenario'])=>{
   // Freeze a failed request for exact retries, including its idempotency key.
   let payload=pendingPayload;
   if(!payload){const values=checkinAnswers(answers);
     const key=requestId||crypto.randomUUID();setRequestId(key);payload={requestId:key,patientId,answers:scenario?{}:values,...(scenario?{scenario}:{})};}
   setPendingPayload(payload);
   const result=await send('/api/intake',payload);setSelected(result.record.id);setView('queue');setNotice('Synthetic report saved. No message has been sent.');setAnswers({});setRequestId('');setPendingPayload(null);
 };
 const update=(key:string,value:string)=>setAnswers({...answers,[key]:value});
 return <><JudgeSwitcher/><div className="shell">
  <aside className="sidebar"><a className="brand" href="/" aria-label="Saathi home"><span className="brandmark">s</span>saathi<span className="branddot">●</span></a><div className="workspace-label">CARE TEAM WORKSPACE</div>
   <nav data-tour="nav"><button className={view==='queue'?'nav active':'nav'} onClick={()=>setView('queue')}><span>▤</span> Care queue <b>{queue.records.filter(r=>r.status!=='resolved').length}</b></button><button className={view==='intake'?'nav active':'nav'} onClick={()=>setView('intake')}><span>＋</span> Caregiver check-in</button><button className={view==='patients'?'nav active':'nav'} onClick={()=>setView('patients')}><span>◷</span> Patient timeline</button><button className={view==='review'?'nav active':'nav'} onClick={()=>setView('review')}><span>✓</span> Clinical review</button><a className="nav" data-tour="emr-link" href="/emr" target="_blank" rel="noreferrer"><span>⌂</span> Hospital EMR ↗</a><a className="nav" data-tour="coord-link" href="/coordinator" target="_blank" rel="noreferrer"><span>▦</span> Call manager report ↗</a><button className="nav tour-launch" onClick={()=>setTouring(true)}><span>▶</span> Tour for judges</button></nav>
   <div className="side-note"><span className="live-dot"/> Live demo · synthetic data<p>Five invented patients.<br/>Every report has a trace.</p></div>
   <div className="profile"><div className="avatar">{initials}</div><div><strong>{me?.name??'Demo doctor'}</strong><small>Medical staff · demo sign-in</small></div><button className="signout" onClick={async()=>{await fetch('/api/session',{method:'DELETE'});window.location.href='/login';}}>Sign out</button></div>
  </aside>
  <main><div className="topbar"><span>KMC Manipal <span className="slash">/</span> Home care</span><span className="demo-chip">SYNTHETIC DATA ONLY</span></div>
   <div className="page-heading"><div><div className="eyebrow">HOME PALLIATIVE CARE</div><h1>{view==='queue'?'A little closer to home.':view==='review'?'Ready for a clinician’s review.':view==='patients'?'The whole story, in one place.':'Tell the care team how things are.'}</h1><p>{view==='queue'?'Caregiver updates, clear priorities, and the words behind every alert.':view==='review'?'Draft protocol, care cards and the decisions still awaiting sign-off.':view==='patients'?'A patient’s saved reports, source words and care-team activity.':'A demo check-in for a synthetic patient. Leave anything you do not know unanswered.'}</p></div><button className="primary" onClick={()=>setView(view==='intake'?'queue':'intake')}>{view==='intake'?'View care queue':'+ New check-in'}</button></div>
   <div className="demo-banner"><span>◈</span><div><strong>Demo protocol · awaiting clinical approval</strong><p>{queue.storage==='supabase'?'Synthetic reports are stored in your Supabase project.':queue.storage==='local'?'Synthetic reports are stored on this computer.':'Connecting to configured storage.'} Reports are triaged by the unsigned demo protocol into teleconsult call-backs. No real patient is connected.</p></div></div>
   <RedAlert records={queue.records} patients={queue.patients} onOpen={id=>{setSelected(id);setView('queue');}}/>
   {error&&<div className="message error" role="alert">{error} <button onClick={()=>perform(refresh)}>Refresh</button></div>}{notice&&<div className="message success" role="status">{notice}</div>}
   {view==='intake'&&<div data-tour="voice"><VoiceIntake patients={queue.patients} patientId={patientId} setPatientId={setPatientId} enabled={queue.storage==='supabase'} onSaved={async(record)=>{setSelected(record.id);setView('queue');setNotice(record.report.processing?.extraction.status==='failed'?'Transcript saved. Extraction failed; human review is required.':record.report.processing?.extraction.status==='pending'?'Report saved; extraction is still pending.':'Report saved with validated source quotes. Human review is still required.');await refresh();}}/></div>}
   {view==='queue'?<>
    <CareQueue ws={queue} selected={selected} setSelected={setSelected} busy={busy} perform={perform} send={send} setNotice={setNotice} loaded={loaded} onExample={()=>perform(()=>intake('urgent'))}/>
    <div className="bottom-tools"><p>Unacknowledged reports escalate on a 15-minute demo interval, checked automatically in the background. RED alerts reach the registered on-call phone on WhatsApp.</p><button disabled={busy} onClick={()=>perform(async()=>{const r=await send('/api/tick',{});setNotice(`${r.changed} local escalation update${r.changed===1?'':'s'}. No notification sent.`);})}>Run escalation check</button></div>
   </>:view==='review'?<div data-tour="review"><ClinicalReview/></div>:view==='patients'?<div data-tour="patients"><PatientWorkspace patients={queue.patients} records={queue.records} patientId={patientId} setPatientId={setPatientId}/></div>:<div className="intake-layout"><form className="intake-form" onSubmit={e=>{e.preventDefault();perform(()=>intake());}}><div className="section-head"><div><h2>Daily check-in</h2><p>English button intake · adult demo pack</p></div><span className="pill pending">DEMO</span></div><fieldset disabled={busy||Boolean(pendingPayload)}><label>Synthetic patient<select value={patientId} onChange={e=>setPatientId(e.target.value)}>{queue.patients.map(p=><option key={p.id} value={p.id}>{p.name} · {p.age} yr</option>)}</select></label><p className="muted">All 12 daily check-in topics, with optional detail questions. Leave unknown answers blank.</p>{checkinQuestions.map(q=><label key={q.key}>{q.text}{q.textInput?<textarea rows={4} maxLength={4000} value={answers[q.key]??''} onChange={e=>update(q.key,e.target.value)} placeholder="Synthetic concerns and missed medicine names"/>:q.max!==undefined?<input type="number" min="0" max={q.max} placeholder="Not answered" value={answers[q.key]??''} onChange={e=>update(q.key,e.target.value)}/>:<select value={answers[q.key]??''} onChange={e=>update(q.key,e.target.value)}><option value="">Not answered</option>{q.choices.map(([label,value])=><option key={value} value={value}>{label}</option>)}</select>}</label>)}</fieldset><div className="form-footer"><p>Unanswered fields stay unknown. A draft EN/HI/KN keyword safety net flags selected phrases; other text still needs review.</p><button className="primary" disabled={busy} type="submit">{busy?'Saving…':pendingPayload?'Retry saved request':'Save check-in'}</button>{pendingPayload&&<button type="button" disabled={busy} onClick={()=>{setPendingPayload(null);setRequestId('');setNotice('Retry cleared. Check the queue before submitting again.');}}>Discard retry</button>}</div></form>
    <aside className="scenario-panel"><div className="eyebrow">EXPLORE THE WORKFLOW</div><h2>A report. A rule.<br/>A clear next step.</h2><p>These scenarios use explicit, invented test observations. They do not fill the caregiver form or simulate a real clinical assessment.</p>{([['urgent','01','Urgent report','Drowsiness W4 and four extra doses. Expect R2 + A1, RED.'],['review','02','Same-day review','Three extra doses in 24 hours. Expect A1, AMBER.'],['complete','03','Complete test report','Explicit negative test observations. Expect GREEN.'],['incomplete','04','Unanswered check-in','No symptom answers. Expect follow-up, never GREEN.']] as const).map(([scenario,n,title,description])=><button key={scenario} disabled={busy||Boolean(pendingPayload)} onClick={()=>perform(()=>intake(scenario))}><span>{n}</span><div><strong>{title}</strong><p>{description}</p></div><b>↗</b></button>)}<small>Each example is saved for the selected synthetic patient. A scenario is a fixture, not speech or LLM extraction.</small></aside></div>}
   {touring&&<JudgeTour view={view} setView={setView as (v:TourView)=>void} hasReports={queue.records.length>0} onExample={()=>perform(()=>intake('urgent'))} onClose={()=>{localStorage.setItem('saathi-tour-seen','1');setTouring(false);}}/>}
   <footer>saathi <span>AI listens. The doctor decides.</span><small>Local prototype · clinician approval pending</small></footer>
  </main>
 </div></>;
}
