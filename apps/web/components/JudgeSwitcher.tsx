'use client';
import { useEffect, useState } from 'react';
type Role='medical'|'coordinator'|'family';
// [role, label, path, staff]: the nurse view is medical staff without prescription changes.
const VIEWS:[Role,string,string,string?][]=[['medical','Doctor','/','doctor'],['medical','Nurse','/','nurse'],['coordinator','Call manager','/coordinator'],['family','Patient / family','/c']];
/** For judge test sessions only: one login, three role views. Real accounts never see this bar. */
export default function JudgeSwitcher(){
  const [s,setS]=useState<{role:Role;judge?:boolean;staff?:string}|null>(null),[busy,setBusy]=useState(false);
  useEffect(()=>{fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(d=>setS(d.session)).catch(()=>{});},[]);
  if(!s?.judge)return null;
  const on=(role:Role,staff?:string)=>s.role===role&&(role!=='medical'||(s.staff??'doctor')===staff);
  const go=async(role:Role,path:string,staff?:string)=>{if(on(role,staff))return;setBusy(true);const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'switch',role,...(staff?{staff}:{})})});if(r.ok)window.location.href=path;else setBusy(false);};
  return <div className="judge-switch no-print" role="navigation" aria-label="Switch judge view"><span>Judge view</span>{VIEWS.map(([role,label,path,staff])=><button key={label} disabled={busy} aria-pressed={on(role,staff)} className={on(role,staff)?'on':''} onClick={()=>go(role,path,staff)}>{label}</button>)}<button className="out" onClick={async()=>{await fetch('/api/session',{method:'DELETE'});window.location.href='/login';}}>Sign out</button></div>;
}
