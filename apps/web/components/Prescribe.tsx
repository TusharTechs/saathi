'use client';
import { useCallback, useEffect, useState } from 'react';
import { blockedItems, inPersonOnlyItems } from '../../../packages/workflow/src/restricted';
type Item={medicine:string;dose:string;frequency:string;days:number;instructions:string};
type Rx={id:string;alertId:string|null;issuedAt:string;prescriber:string;items:Item[];verified:boolean};
const blank=():Item=>({medicine:'',dose:'',frequency:'',days:3,instructions:''});
const stamp=(at:string)=>new Date(at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
/**
 * Optional prescription change after a call (Dr. Rao, review E1): the doctor guides the change on the call and saves it;
 * it is printed and issued only in person at the OPD within 2-3 working days. Nothing is sent to the family.
 */
export default function Prescribe({patientId,alertId,hospital}:{patientId:string;alertId:string;hospital:string|null}){
  const [list,setList]=useState<Rx[]>([]),[open,setOpen]=useState(false),[items,setItems]=useState<Item[]>([blank()]),[registration,setRegistration]=useState(''),[advice,setAdvice]=useState(''),[attested,setAttested]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{const r=await fetch(`/api/prescriptions?patient=${patientId}`,{cache:'no-store'});if(r.ok)setList(await r.json());},[patientId]);
  useEffect(()=>{load();setOpen(false);setItems([blank()]);setError('');setAttested(false);},[load,alertId]);
  const filled=items.filter(i=>i.medicine.trim()),blocked=blockedItems(filled),inPerson=inPersonOnlyItems(filled);
  const set=(n:number,k:keyof Item,v:string)=>setItems(items.map((it,i)=>i===n?{...it,[k]:k==='days'?Math.max(1,Math.min(90,Number(v)||1)):v}:it));
  const submit=async()=>{setBusy(true);setError('');try{
    const r=await fetch('/api/prescriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientId,alertId,registration,advice,attested,items:items.filter(i=>i.medicine.trim())})});
    const d=await r.json();if(!r.ok)throw Error(d.error);setOpen(false);setItems([blank()]);setAdvice('');setAttested(false);await load();
  }catch(e){setError(e instanceof Error?e.message:'Prescription not saved.');}finally{setBusy(false);}};
  const mine=list.filter(r=>r.alertId===alertId);
  return <div className="rx" data-tour="prescription">
    <h3>Prescription change <small>saved for the OPD · optional</small></h3>
    {mine.map(r=><p key={r.id} className="rx-issued"><a href={`/rx/${r.id}`} target="_blank" rel="noreferrer">Saved {stamp(r.issuedAt)} · {r.items.length} medicine{r.items.length===1?'':'s'} · {r.prescriber} · to be issued at the OPD ↗</a>{r.verified?'':' · record changed after saving'}</p>)}
    {!open?<button onClick={()=>setOpen(true)}>Save a prescription change</button>:<div className="rx-form">
      <p className="muted">Guide the dose change on the call. Saathi saves it here; nothing is printed or sent to the family. The family collects the printed prescription at the OPD{hospital?` (${hospital})`:''} within 2–3 working days. The palliative care team does not prescribe anti-cancer drugs.</p>
      {items.map((it,n)=><div key={n} className="rx-row">
        <input aria-label="Medicine" placeholder="Medicine (generic name)" value={it.medicine} onChange={e=>set(n,'medicine',e.target.value)} className={blocked.some(b=>b.medicine===it.medicine)?'bad':''}/>
        <input aria-label="Dose" placeholder="Dose" value={it.dose} onChange={e=>set(n,'dose',e.target.value)}/>
        <input aria-label="How often" placeholder="How often" value={it.frequency} onChange={e=>set(n,'frequency',e.target.value)}/>
        <input aria-label="Days" type="number" min={1} max={90} value={it.days} onChange={e=>set(n,'days',e.target.value)}/>
        <input aria-label="Instructions" placeholder="Instructions" value={it.instructions} onChange={e=>set(n,'instructions',e.target.value)}/>
        {items.length>1&&<button aria-label="Remove medicine" onClick={()=>setItems(items.filter((_,i)=>i!==n))}>×</button>}
      </div>)}
      {items.length<10&&<button className="linkish" onClick={()=>setItems([...items,blank()])}>+ Add a medicine</button>}
      {blocked.length>0&&<p className="message error">{blocked.map(b=>b.medicine).join(', ')}: anti-cancer drugs are not prescribed by the palliative care team.</p>}{inPerson.length>0&&<p className="message">{inPerson.map(b=>`${b.medicine} (${b.category})`).join(', ')}: issue only in person at the OPD.</p>}
      <label>Your medical registration number<input value={registration} onChange={e=>setRegistration(e.target.value)} placeholder="e.g. KA-12345 (demo)"/></label>
      <label>Advice (optional)<textarea rows={2} maxLength={1000} value={advice} onChange={e=>setAdvice(e.target.value)}/></label>
      <label className="agree"><input type="checkbox" checked={attested} onChange={e=>setAttested(e.target.checked)}/><span>I consulted this patient’s family by phone or video. This change will be issued in person at the OPD.</span></label>
      {error&&<p className="message error">{error}</p>}
      <div className="actions"><button className="primary" disabled={busy||!attested||blocked.length>0||registration.trim().length<3||!items.some(i=>i.medicine.trim()&&i.dose.trim()&&i.frequency.trim())} onClick={submit}>{busy?'Saving…':'Save for OPD issue'}</button><button onClick={()=>setOpen(false)}>Cancel</button></div>
    </div>}
  </div>;
}
