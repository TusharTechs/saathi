'use client';
import {useEffect,useRef,useState} from 'react';
import type {Patient,RecordEntry} from '../../../packages/workflow/src/index';
type Attempt={id:string;kind:'voice'|'text';patientId:string;language:string;text:string;clip:File|null};
export default function VoiceIntake({patients,patientId,setPatientId,enabled,onSaved}:{patients:Patient[];patientId:string;setPatientId:(id:string)=>void;enabled:boolean;onSaved:(record:RecordEntry)=>Promise<void>}){
 const [kind,setKind]=useState<'voice'|'text'>('voice'),[language,setLanguage]=useState('en-IN'),[text,setText]=useState('');
 const [clip,setClip]=useState<File|null>(null),[audioURL,setAudioURL]=useState(''),[consent,setConsent]=useState(false);
 const [starting,setStarting]=useState(false),[recording,setRecording]=useState(false),[seconds,setSeconds]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const recorder=useRef<MediaRecorder|null>(null),tracks=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null),stopTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const mounted=useRef(true),attempt=useRef<Attempt|null>(null);
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;if(timer.current)clearInterval(timer.current);if(stopTimer.current)clearTimeout(stopTimer.current);if(recorder.current?.state==='recording')recorder.current.stop();tracks.current?.getTracks().forEach(t=>t.stop());};},[]);
 useEffect(()=>{if(!clip){setAudioURL('');return;}const url=URL.createObjectURL(clip);setAudioURL(url);return ()=>URL.revokeObjectURL(url);},[clip]);
 const stop=()=>{if(recorder.current?.state==='recording')recorder.current.stop();};
 const start=async()=>{
  if(starting||recording)return;setStarting(true);setError('');try{
   if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('Recording is unavailable in this browser. Upload a short clip or use text.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(!mounted.current){stream.getTracks().forEach(t=>t.stop());return;}tracks.current=stream;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(m=>MediaRecorder.isTypeSupported(m));
   const media=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);recorder.current=media;const chunks:BlobPart[]=[];
   media.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   media.onstop=()=>{
    stream.getTracks().forEach(t=>t.stop());if(timer.current)clearInterval(timer.current);if(stopTimer.current)clearTimeout(stopTimer.current);
    if(!mounted.current)return;setRecording(false);const type=media.mimeType||'audio/webm';
    setClip(new File(chunks,`synthetic-recording.${type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm'}`,{type}));attempt.current=null;
   };
   media.onerror=()=>{stop();if(mounted.current)setError('Recording failed. Try a file upload or text.');};
   media.start();setSeconds(0);setRecording(true);timer.current=setInterval(()=>setSeconds(s=>s+1),1000);stopTimer.current=setTimeout(()=>media.state==='recording'&&media.stop(),25000);
  }catch(e){tracks.current?.getTracks().forEach(t=>t.stop());setError(e instanceof Error&&e.name==='NotAllowedError'?'Microphone access was declined. You can upload a clip or use text.':e instanceof Error?e.message:'Recording failed.');}finally{if(mounted.current)setStarting(false);}
 };
 const submit=async()=>{
  if(!consent||!enabled||starting||recording)return;
  setBusy(true);setError('');
  try{
   const a=attempt.current??{id:crypto.randomUUID(),kind,patientId,language,text,clip};attempt.current=a;
   let payload:FormData|string,headers:HeadersInit={};
   if(a.kind==='voice'){
    if(!a.clip)throw Error('Record or choose an audio clip first.');
    const form=new FormData();form.set('requestId',a.id);form.set('patientId',a.patientId);form.set('language',a.language);form.set('synthetic','true');form.set('audio',a.clip);payload=form;
   }else{payload=JSON.stringify({requestId:a.id,patientId:a.patientId,language:a.language,synthetic:true,text:a.text});headers={'Content-Type':'application/json'};}
   const r=await fetch(a.kind==='voice'?'/api/voice':'/api/narrative',{method:'POST',headers,body:payload,signal:AbortSignal.timeout(120000)});
   const result=await r.json();if(!r.ok)throw Error(result.error??'Processing failed. Your input has been kept for retry.');
   attempt.current=null;await onSaved(result.record);
  }catch(e){setError(e instanceof Error&&e.name==='TimeoutError'?'Processing timed out. Check the queue first; retry uses the same request ID.':e instanceof Error?e.message:'Processing failed. Your input is kept for retry.');}
  finally{if(mounted.current)setBusy(false);}
 };
 const change=()=>{attempt.current=null;setError('');};
 return <section className="voice-panel" aria-label="Voice and text report">
  <div className="voice-intro"><div className="eyebrow">IN YOUR OWN WORDS</div><h2>A short update can go a long way.</h2><p>Record a synthetic caregiver report or type it in English, Hindi or Kannada. Your original transcript stays with the report.</p><div className="voice-tabs" role="group" aria-label="Report input type"><button aria-pressed={kind==='voice'} disabled={busy||starting||recording} onClick={()=>{setKind('voice');change();}}>Voice note</button><button aria-pressed={kind==='text'} disabled={busy||starting||recording} onClick={()=>{setKind('text');change();}}>Type a report</button></div><small>Audio is sent to Sarvam, and the transcript to Groq. The report is stored in your Supabase project. Only invented test reports belong here.</small></div>
  <div className="voice-controls"><div className="field-pair"><label>Synthetic patient<select disabled={busy||starting||recording} value={patientId} onChange={e=>{setPatientId(e.target.value);change();}}>{patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Report language<select disabled={busy||starting||recording} value={language} onChange={e=>{setLanguage(e.target.value);change();}}><option value="en-IN">English</option><option value="hi-IN">Hindi</option><option value="kn-IN">Kannada</option><option value="unknown">Detect language</option></select></label></div>
   {kind==='voice'?<><div className="record-controls"><button className={recording?'record-button recording':'record-button'} disabled={busy||starting||!enabled} onClick={recording?stop:start}>{starting?'Waiting for microphone permission…':recording?`■ Stop recording · ${seconds}s`:'● Record a voice note'}</button><span>Stops after 25 seconds</span></div><label className="audio-upload">Or choose an audio clip<input aria-label="Choose synthetic audio clip" disabled={busy||starting||recording||!enabled} type="file" accept="audio/wav,audio/x-wav,audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/x-m4a" onChange={e=>{const file=e.target.files?.[0];change();if(file&&file.size>2*1024*1024){setError('Audio must be under 2 MB.');setClip(null);}else setClip(file??null);}}/></label>{audioURL&&<audio controls src={audioURL} preload="metadata"/>}<p className="voice-limit">Up to 30 seconds · 2 MB · WAV, WebM, Ogg, MP3 or M4A</p></>:<label>Caregiver report<textarea lang={language.slice(0,2)} disabled={busy||!enabled} rows={4} maxLength={4000} value={text} onChange={e=>{setText(e.target.value);change();}} placeholder="Example: Papa keeps falling asleep while talking. I gave four extra doses in the last 24 hours."/></label>}
   <label className="consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>This is an invented report with no real patient information.</label>
   {!enabled&&<p className="message error">Connect Supabase storage to process voice or text. Button intake remains available below.</p>}
   {error&&<div className="message error" role="alert">{error}</div>}
   <button className="primary" disabled={busy||starting||recording||!enabled||!consent||(kind==='voice'?!clip:!text.trim())} onClick={submit}>{busy?'Processing… your report will appear in the queue':'Process and save report'}</button>
   {busy&&<p className="voice-limit" role="status">After transcription, the report is saved before extraction finishes. You can check the care queue while processing continues.</p>}
  </div>
 </section>;
}
