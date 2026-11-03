'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SECTIONS, QUESTION_IDS, type Question } from '../../lib/review-questions';
type Answer={choice?:string|string[];details?:string};
type Answers=Record<string,Answer>;
const time=(at:string)=>new Date(at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const answered=(a?:Answer)=>Boolean(a&&(Array.isArray(a.choice)?a.choice.length:a.choice));
/**
 * Review form for the clinical lead: tap a choice for each question, add a note only if needed. Everything autosaves
 * (also in this browser) and Submit sends a copy to Tushar. She can come back and change answers any time.
 */
export default function Review(){
  const [k,setK]=useState(''),[name,setName]=useState('Dr. Krithika S Rao'),[answers,setAnswers]=useState<Answers>({}),[open,setOpen]=useState<Record<string,boolean>>({});
  const [status,setStatus]=useState<'loading'|'ready'|'saving'|'saved'|'offline'|'invalid'>('loading'),[savedAt,setSavedAt]=useState(''),[submittedAt,setSubmittedAt]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const first=useRef(true),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{const key=new URLSearchParams(window.location.search).get('k')??'';setK(key);
    fetch(`/api/review?k=${encodeURIComponent(key)}`,{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok){setStatus('invalid');setError(d.error);return;}
      const local=JSON.parse(localStorage.getItem('saathi-review')??'null') as {answers:Answers;at:number}|null;
      // Keep whichever copy is newer: the server's or an unsent one in this browser.
      const server=d.updatedAt?Date.parse(d.updatedAt):0;setAnswers(local&&local.at>server?local.answers:d.answers??{});
      if(d.name)setName(d.name);if(d.submittedAt)setSubmittedAt(d.submittedAt);if(d.updatedAt)setSavedAt(d.updatedAt);setStatus('ready');}).catch(()=>{setStatus('offline');});},[]);
  const save=useCallback(async(next:Answers,nm:string,submit=false)=>{
    setStatus('saving');localStorage.setItem('saathi-review',JSON.stringify({answers:next,at:Date.now()}));
    const r=await fetch('/api/review',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({k,name:nm,answers:next,submit})});
    const d=await r.json();if(!r.ok)throw Error(d.error);setSavedAt(d.updatedAt);if(d.submittedAt)setSubmittedAt(d.submittedAt);setStatus('saved');
  },[k]);
  useEffect(()=>{if(status==='loading'||status==='invalid')return;if(first.current){first.current=false;return;}
    if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{save(answers,name).catch(()=>setStatus('offline'));},1200);
    return ()=>{if(timer.current)clearTimeout(timer.current);};},[answers,name]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose=(q:Question,c:string)=>{setAnswers(a=>{const cur=a[q.id]??{};let choice:string|string[];
    if(q.multi){const list=Array.isArray(cur.choice)?cur.choice:[];choice=list.includes(c)?list.filter(x=>x!==c):[...list,c];}else choice=cur.choice===c?'':c;
    return {...a,[q.id]:{...cur,choice}};});if(/write|list them|below/i.test(c))setOpen(o=>({...o,[q.id]:true}));};
  const note=(id:string,details:string)=>setAnswers(a=>({...a,[id]:{...a[id],details}}));
  const done=QUESTION_IDS.filter(id=>answered(answers[id])).length;
  if(status==='loading')return <main className="review"><p className="muted">Loading…</p></main>;
  if(status==='invalid')return <main className="review"><p className="message error">{error}</p></main>;
  return <main className="review">
    <header className="review-head"><a className="brand" href="#top"><span className="brandmark">s</span>saathi<span className="branddot">●</span></a>
      <div className="review-status"><b>{done}/{QUESTION_IDS.length}</b> answered · {status==='saving'?'Saving…':status==='offline'?<span className="bad">Not saved (check the connection; kept on this device)</span>:savedAt?`Saved ${time(savedAt)}`:'Saves automatically'}</div></header>
    <section className="review-intro" id="top"><div className="eyebrow">CLINICAL REVIEW · SAATHI · 3 NOV 2026</div><h1>Your decisions for Saathi</h1>
      <p>Tap one choice for each question. Add a note only if you want to; a box opens by itself when a choice says “write below”. Your answers save automatically, so you can stop and come back on any device using this link. Press <b>Submit</b> at the end so Tushar knows you are done. You can change answers and submit again later.</p>
      <p className="muted">Nothing here is used as your approval until you submit, and every item stays labelled “draft” in the app until then.</p>
      <label>Your name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></label>
      <nav className="review-nav">{SECTIONS.map(s=>{const n=s.questions.filter(q=>answered(answers[q.id])).length;return <a key={s.id} href={`#sec-${s.id}`} className={n===s.questions.length?'done':''}>{s.id}. {s.title} <small>{n}/{s.questions.length}</small></a>;})}</nav>
    </section>
    {SECTIONS.map(s=><section key={s.id} id={`sec-${s.id}`} className="review-section"><h2>{s.id}. {s.title}</h2>{s.intro&&<p className="muted">{s.intro}</p>}
      {s.questions.map(q=>{const a=answers[q.id]??{},chosen=(c:string)=>Array.isArray(a.choice)?a.choice.includes(c):a.choice===c,showNote=open[q.id]||Boolean(a.details)||Boolean(q.details);
        return <article key={q.id} className={`review-q ${answered(a)?'answered':''}`} id={`q-${q.id}`}>
          <h3>{q.title}</h3>{q.quote&&<blockquote>{q.quote}</blockquote>}{q.text&&<p>{q.text}</p>}
          <div className={`review-choices ${q.multi?'multi':''}`} role={q.multi?'group':'radiogroup'} aria-label={q.title}>{q.choices.map(c=>{const link=q.links?.find(l=>l.label===c);return <div key={c} className="choice-wrap">
            <button type="button" role={q.multi?'checkbox':'radio'} aria-checked={chosen(c)} className={chosen(c)?'on':''} onClick={()=>choose(q,c)}><span className="tick">{chosen(c)?'✓':''}</span>{c}</button>
            {link&&<a href={link.href} target="_blank" rel="noreferrer" className="watch">Watch ▶</a>}</div>;})}</div>
          {q.links&&!q.multi&&q.links.map(l=><a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="watch">{l.label} ↗</a>)}
          {showNote?<label className="review-note">{q.details??'Your note (optional)'}<textarea rows={q.details?6:3} maxLength={4000} value={a.details??''} onChange={e=>note(q.id,e.target.value)}/></label>
            :<button type="button" className="linkish add-note" onClick={()=>setOpen(o=>({...o,[q.id]:true}))}>+ Add a note</button>}
        </article>;})}
    </section>)}
    <section className="review-submit">
      <p><b>{done} of {QUESTION_IDS.length}</b> questions answered.{done<QUESTION_IDS.length?' You can submit now and finish the rest later.':''}</p>
      {submittedAt&&<p className="message success">Submitted {time(submittedAt)}. Thank you! Tushar can see your answers. You can still change them and submit again.</p>}
      {error&&<p className="message error">{error}</p>}
      <button className="primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await save(answers,name,true);}catch(e){setError(e instanceof Error?e.message:'Not submitted. Please try again.');}finally{setBusy(false);}}}>{busy?'Submitting…':submittedAt?'Submit again':'Submit to Tushar'}</button>
    </section>
  </main>;
}
