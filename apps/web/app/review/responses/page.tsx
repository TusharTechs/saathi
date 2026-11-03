'use client';
import { useEffect, useState } from 'react';
import { SECTIONS } from '../../../lib/review-questions';
type Answer={choice?:string|string[];details?:string};
type Data={current:{reviewer:string;name:string|null;answers:Record<string,Answer>;updatedAt:string;submittedAt:string|null}[];submissions:{id:number;name:string|null;submittedAt:string}[]};
const time=(at:string)=>new Date(at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const text=(a?:Answer)=>!a?'':Array.isArray(a.choice)?a.choice.join('; '):a.choice??'';
/** Tushar's view of the clinical lead's answers (admin link only), with a Markdown copy for the project docs. */
export default function Responses(){
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[copied,setCopied]=useState(false),[onlyNotes,setOnlyNotes]=useState(false);
  useEffect(()=>{const admin=new URLSearchParams(window.location.search).get('admin')??'';fetch(`/api/review?admin=${encodeURIComponent(admin)}`,{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok||!d.current)throw Error(d.error??'This results link is not valid.');setData(d);}).catch(e=>setError(e.message));},[]);
  if(error)return <main className="review"><p className="message error">{error}</p></main>;
  if(!data)return <main className="review"><p className="muted">Loading…</p></main>;
  const r=data.current[0];
  if(!r)return <main className="review"><h1>No answers yet</h1><p className="muted">Nothing has been saved from the review link so far.</p></main>;
  const md=[`# Clinical review answers · ${r.name??'Clinical lead'}`,`Last saved ${time(r.updatedAt)}${r.submittedAt?` · submitted ${time(r.submittedAt)}`:' · not submitted yet'}`,'',...SECTIONS.flatMap(s=>[`## ${s.id}. ${s.title}`,...s.questions.map(q=>`- **${q.title}:** ${text(r.answers[q.id])||'_not answered_'}${r.answers[q.id]?.details?`\n  - Note: ${r.answers[q.id]!.details!.replace(/\n/g,'\n    ')}`:''}`),''])].join('\n');
  const total=SECTIONS.reduce((n,s)=>n+s.questions.length,0),done=SECTIONS.flatMap(s=>s.questions).filter(q=>text(r.answers[q.id])).length;
  return <main className="review">
    <section className="review-intro"><div className="eyebrow">RESULTS · ADMIN ONLY</div><h1>{r.name??'Clinical lead'}’s answers</h1>
      <p>{done}/{total} answered · last saved {time(r.updatedAt)} · {r.submittedAt?<b>submitted {time(r.submittedAt)}</b>:<b className="bad">not submitted yet (autosaved draft)</b>}</p>
      <p className="muted">{data.submissions.length} submission{data.submissions.length===1?'':'s'}{data.submissions.length?`: ${data.submissions.map(s=>time(s.submittedAt)).join(', ')}`:''}</p>
      <div className="actions"><button className="primary" onClick={async()=>{await navigator.clipboard.writeText(md);setCopied(true);}}>{copied?'Copied':'Copy as Markdown'}</button><label className="agree"><input type="checkbox" checked={onlyNotes} onChange={e=>setOnlyNotes(e.target.checked)}/><span>Only show answers that need action (changes, notes, unanswered)</span></label></div></section>
    {SECTIONS.map(s=><section key={s.id} className="review-section"><h2>{s.id}. {s.title}</h2>
      <table className="coord-table"><tbody>{s.questions.filter(q=>{const a=r.answers[q.id];return !onlyNotes||!text(a)||a?.details||!/^Approve$|^Approve the|^Approve for|^Approve these|^All good$/.test(text(a));}).map(q=>{const a=r.answers[q.id];return <tr key={q.id} className={!text(a)?'waiting':''}><td style={{width:'32%'}}><b>{q.title}</b></td><td>{text(a)||<span className="muted">not answered</span>}{a?.details&&<p className="review-note-out">{a.details}</p>}</td></tr>;})}</tbody></table></section>)}
  </main>;
}
