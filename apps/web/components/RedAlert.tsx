'use client';
import { useEffect, useRef, useState } from 'react';
import type { RecordEntry } from '../../../packages/workflow/src/index';
type P={id:string;name:string};
const stamp=(at:string)=>new Date(at).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'});
/**
 * Dr. Rao: a RED "is an alert that flashes to somebody manning the page". New open REDs that arrive while the
 * dashboard is open flash a banner, beep, blink the tab title and, if allowed, show a desktop notification.
 */
export default function RedAlert({records,patients,onOpen}:{records:RecordEntry[];patients:P[];onOpen:(id:string)=>void}){
  const seen=useRef<Set<string>|null>(null),[fresh,setFresh]=useState<RecordEntry[]>([]),[canNotify,setCanNotify]=useState(false);
  useEffect(()=>{setCanNotify(typeof Notification!=='undefined'&&Notification.permission==='default');},[]);
  useEffect(()=>{
    const red=records.filter(r=>r.report.evaluation.tier==='RED'&&r.status==='open');
    if(!records.length)return;
    if(!seen.current){seen.current=new Set(red.map(r=>r.id));return;} // first load: existing REDs are already in the list
    const added=red.filter(r=>!seen.current!.has(r.id));added.forEach(r=>seen.current!.add(r.id));
    setFresh(f=>[...f.filter(x=>red.some(r=>r.id===x.id)),...added]);
    if(added.length){
      try{const ctx=new AudioContext(),o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=880;o.connect(g);g.connect(ctx.destination);g.gain.setValueAtTime(.2,ctx.currentTime);o.start();o.stop(ctx.currentTime+.6);}catch{/* sound is optional */}
      if(typeof Notification!=='undefined'&&Notification.permission==='granted')for(const r of added)new Notification('Saathi · RED · needs immediate review',{body:`${patients.find(p=>p.id===r.patientId)?.name??'Patient'} · ${stamp(r.createdAt)}`});
    }
  },[records,patients]);
  useEffect(()=>{if(!fresh.length)return;const base=document.title;let on=false;const id=setInterval(()=>{on=!on;document.title=on?`● RED (${fresh.length}) · Saathi`:base;},900);return ()=>{clearInterval(id);document.title=base;};},[fresh.length]);
  if(!fresh.length)return canNotify?<p className="notify-hint"><button className="linkish" onClick={async()=>{await Notification.requestPermission();setCanNotify(false);}}>Turn on desktop alerts</button> so a new RED reaches you even in another tab.</p>:null;
  return <div className="red-alert" role="alert">{fresh.map(r=><div key={r.id}><b>RED · needs immediate review</b><span>{patients.find(p=>p.id===r.patientId)?.name??'Patient'} · received {stamp(r.createdAt)} · via {r.report.origin?.channel??'web'}</span>
    <button onClick={()=>{onOpen(r.id);setFresh(f=>f.filter(x=>x.id!==r.id));}}>Open report</button><button className="dismiss" aria-label="Dismiss" onClick={()=>setFresh(f=>f.filter(x=>x.id!==r.id))}>×</button></div>)}</div>;
}
