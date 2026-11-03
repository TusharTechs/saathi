'use client';
import {useEffect,useRef,useState} from 'react';
import type {Patient,RecordEntry} from '../../../packages/workflow/src/index';
type Attempt={id:string;kind:'voice'|'text';patientId:string;language:string;text:string;clip:File|null};
/**
 * Staff report a concern on a family's behalf, for example during a phone call: upload a voice note to transcribe,
 * or type what the family said. Dr. Rao asked for upload only on the care-team side (no in-browser recording).
 */
export default function VoiceIntake({patients,patientId,setPatientId,enabled,onSaved}:{patients:Patient[];patientId:string;setPatientId:(id:string)=>void;enabled:boolean;onSaved:(record:RecordEntry)=>Promise<void>}){
 const [kind,setKind]=useState<'voice'|'text'>('text'),[language,setLanguage]=useState('unknown'),[text,setText]=useState('');
 const [clip,setClip]=useState<File|null>(null),[audioURL,setAudioURL]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const mounted=useRef(true),attempt=useRef<Attempt|null>(null);
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
 useEffect(()=>{if(!clip){setAudioURL('');return;}const url=URL.createObjectURL(clip);setAudioURL(url);return ()=>URL.revokeObjectURL(url);},[clip]);
 const submit=async()=>{
  if(!consent||!enabled)return;setBusy(true);setError('');
  try{
   const a=attempt.current??{id:crypto.randomUUID(),kind,patientId,language,text,clip};attempt.current=a;
   let payload:FormData|string,headers:HeadersInit={};
   if(a.kind==='voice'){
    if(!a.clip)throw Error('Choose an audio file first.');
    const form=new FormData();form.set('requestId',a.id);form.set('patientId',a.patientId);form.set('language',a.language);form.set('synthetic','true');form.set('audio',a.clip);payload=form;
   }else{payload=JSON.stringify({requestId:a.id,patientId:a.patientId,language:a.language==='unknown'?(/[\u0C80-\u0CFF]/.test(a.text)?'kn-IN':/[\u0900-\u097F]/.test(a.text)?'hi-IN':'en-IN'):a.language,synthetic:true,text:a.text});headers={'Content-Type':'application/json'};}
   const r=await fetch(a.kind==='voice'?'/api/voice':'/api/narrative',{method:'POST',headers,body:payload,signal:AbortSignal.timeout(120000)});
   const result=await r.json();if(!r.ok)throw Error(result.error??'Processing failed. Your input has been kept for retry.');
   attempt.current=null;await onSaved(result.record);
  }catch(e){setError(e instanceof Error&&e.name==='TimeoutError'?'Processing timed out. Check the queue first; retry uses the same request ID.':e instanceof Error?e.message:'Processing failed. Your input is kept for retry.');}
  finally{if(mounted.current)setBusy(false);}
 };
 const change=()=>{attempt.current=null;setError('');};
 return <section className="voice-panel" aria-label="Report on a family's behalf">
  <div className="voice-intro"><div className="eyebrow">ON A FAMILY’S BEHALF</div><h2>Took the call yourself? Add it here.</h2><p>Type what the family told you, or upload their voice note to transcribe. It goes through the same transcription, rules and queue as a WhatsApp or web report, and keeps the family’s words.</p><div className="voice-tabs" role="group" aria-label="Report input type"><button aria-pressed={kind==='text'} disabled={busy} onClick={()=>{setKind('text');change();}}>Type what they said</button><button aria-pressed={kind==='voice'} disabled={busy} onClick={()=>{setKind('voice');change();}}>Upload a voice note</button></div><small>Audio goes to Sarvam for transcription and the text to Groq for extraction. Synthetic test reports only.</small></div>
  <div className="voice-controls"><div className="field-pair"><label>Synthetic patient<select disabled={busy} value={patientId} onChange={e=>{setPatientId(e.target.value);change();}}>{patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Language<select disabled={busy} value={language} onChange={e=>{setLanguage(e.target.value);change();}}><option value="unknown">Detect automatically</option><option value="en-IN">English</option><option value="hi-IN">Hindi</option><option value="kn-IN">Kannada</option></select></label></div>
   {kind==='voice'?<><label className="audio-upload">Voice note file<input aria-label="Choose synthetic audio file" disabled={busy||!enabled} type="file" accept="audio/wav,audio/x-wav,audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/x-m4a" onChange={e=>{const file=e.target.files?.[0];change();if(file&&file.size>2*1024*1024){setError('Audio must be under 2 MB.');setClip(null);}else setClip(file??null);}}/></label>{audioURL&&<audio controls src={audioURL} preload="metadata"/>}<p className="voice-limit">Up to 30 seconds · 2 MB · WAV, WebM, Ogg, MP3 or M4A</p></>
    :<label>What the family said<textarea lang={language.slice(0,2)} disabled={busy||!enabled} rows={4} maxLength={4000} value={text} onChange={e=>{setText(e.target.value);change();}} placeholder="Example: Daughter says Papa keeps falling asleep while talking and she gave four extra doses in the last 24 hours."/></label>}
   <label className="consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>This is an invented report with no real patient information.</label>
   {!enabled&&<p className="message error">Connect Supabase storage to process voice or text.</p>}
   {error&&<div className="message error" role="alert">{error}</div>}
   <button className="primary" disabled={busy||!enabled||!consent||(kind==='voice'?!clip:!text.trim())} onClick={submit}>{busy?'Processing… the report will appear in the queue':'Save report to the queue'}</button>
   {busy&&<p className="voice-limit" role="status">The transcript is saved before extraction finishes. You can check the care queue meanwhile.</p>}
  </div>
 </section>;
}
