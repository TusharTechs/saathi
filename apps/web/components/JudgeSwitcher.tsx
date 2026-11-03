'use client';
import { useEffect, useState } from 'react';
type Role='medical'|'coordinator'|'family';
const VIEWS:[Role,string,string][]=[['medical','Doctor','/'],['coordinator','Call manager','/coordinator'],['family','Patient / family','/c']];
/** For judge test sessions only: one login, three role views. Real accounts never see this bar. */
export default function JudgeSwitcher(){
  const [s,setS]=useState<{role:Role;judge?:boolean}|null>(null),[busy,setBusy]=useState(false);
  useEffect(()=>{fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(d=>setS(d.session)).catch(()=>{});},[]);
  if(!s?.judge)return null;
  const go=async(role:Role,path:string)=>{if(role===s.role)return;setBusy(true);const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'switch',role})});if(r.ok)window.location.href=path;else setBusy(false);};
  return <div className="judge-switch no-print" role="navigation" aria-label="Switch judge view"><span>Judge view</span>{VIEWS.map(([role,label,path])=><button key={role} disabled={busy} aria-pressed={s.role===role} className={s.role===role?'on':''} onClick={()=>go(role,path)}>{label}</button>)}<button className="out" onClick={async()=>{await fetch('/api/session',{method:'DELETE'});window.location.href='/login';}}>Sign out</button></div>;
}
