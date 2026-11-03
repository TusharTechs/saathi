'use client';
import { use, useEffect, useState } from 'react';
type Rx={id:string;issuedAt:string;prescriber:string;registration:string;items:{medicine:string;dose:string;frequency:string;days:number;instructions:string}[];advice:string|null;signature:string;verified:boolean;patient:{name:string;age:number;sex:string|null;hospitalId:string|null;hospital:string|null;saathiId:string;abha:string}};
/** Printable teleconsult prescription. Families see their own; medical staff see any. */
export default function Prescription({params}:{params:Promise<{id:string}>}){
  const {id}=use(params);const [rx,setRx]=useState<Rx|null>(null),[error,setError]=useState('');
  useEffect(()=>{fetch(`/api/prescriptions?id=${id}`,{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(!d[0])throw Error('Prescription not found.');setRx(d[0]);}).catch(e=>setError(e.message));},[id]);
  if(error)return <main className="rx-page"><p className="message error">{error}</p></main>;
  if(!rx)return <main className="rx-page"><p className="muted">Loading prescription…</p></main>;
  const when=new Date(rx.issuedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  return <main className="rx-page">
    <div className="rx-demo no-print">SYNTHETIC DEMO · not a valid prescription · <button onClick={()=>window.print()}>Print or save as PDF</button></div>
    <header><div><b className="rx-org">Saathi teleconsultation</b><span>{rx.patient.hospital??'Palliative care team'}</span></div><div className="rx-mark">℞</div></header>
    <section className="rx-patient"><div><span>Patient</span><b>{rx.patient.name}</b>{rx.patient.age} yr{rx.patient.sex?` · ${rx.patient.sex}`:''}</div><div><span>Hospital ID</span>{rx.patient.hospitalId??'—'}</div><div><span>Saathi ID</span>{rx.patient.saathiId}</div><div><span>ABHA (simulated)</span>{rx.patient.abha}</div><div><span>Date</span>{when}</div></section>
    <table><thead><tr><th>#</th><th>Medicine</th><th>Dose</th><th>How often</th><th>Days</th><th>Instructions</th></tr></thead>
      <tbody>{rx.items.map((m,i)=><tr key={i}><td>{i+1}</td><td><b>{m.medicine}</b></td><td>{m.dose}</td><td>{m.frequency}</td><td>{m.days}</td><td>{m.instructions||'—'}</td></tr>)}</tbody></table>
    {rx.advice&&<p className="rx-advice"><b>Advice:</b> {rx.advice}</p>}
    <footer>
      <div><b>{rx.prescriber}</b><span>Registration no. {rx.registration}</span><span className="rx-sig">Electronically signed in Saathi · {rx.verified?'signature verified':'SIGNATURE DOES NOT MATCH'} · {rx.signature.slice(0,16)}…</span></div>
      <p>Issued after a teleconsultation under the Telemedicine Practice Guidelines 2020. Narcotic, psychotropic, Schedule X and anti-cancer drugs are not prescribed by teleconsultation. If the patient is very sick, go to the nearest hospital or call 108.</p>
      <p className="rx-note">Demo: this electronic signature is a tamper check, not a certified digital signature (DSC). A live service would sign with the doctor’s DSC.</p>
    </footer>
  </main>;
}
