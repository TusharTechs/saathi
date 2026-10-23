import type { Patient, RecordEntry } from './store.ts';
export function patientHistory(records:RecordEntry[],patientId:string){
 return records.filter(r=>r.patientId===patientId).slice().sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id));
}
export const reportSource=(r:RecordEntry)=>`${r.report.origin?.channel??'web'} · ${r.report.source==='synthetic_fixture'?'test fixture':r.report.source}`;
export const reportDate=(at:string)=>new Date(at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
/** A source-linked digest of saved records, never a diagnosis or generated treatment plan. */
export function preCallSummary(patient:Patient,records:RecordEntry[]):string{
 const history=patientHistory(records,patient.id),latest=history[0];
 const lines=[`SYNTHETIC DEMO · Pre-call summary`,`${patient.name}, ${patient.age} · ${patient.diagnosis} · ${patient.language}`,`Patient: ${patient.id}`,`Saved reports: ${history.length}. No clinician contact is implied.`];
 if(!latest)return [...lines,'No reports saved. Symptoms, medication chart and clinical history are unknown.'].join('\n');
 const active=history.filter(r=>r.status!=='resolved');
 lines.push(`Active reports: ${active.length}; RED: ${active.filter(r=>r.report.evaluation.tier==='RED').length}; AMBER: ${active.filter(r=>r.report.evaluation.tier==='AMBER').length}.`);
 lines.push(`Latest report: ${reportDate(latest.createdAt)} IST · ${reportSource(latest)} · ${latest.status} · ${latest.report.evaluation.tier??'PENDING'}`,`Report ID: ${latest.id}`,`Protocol: ${latest.report.evaluation.protocolVersion} · unsigned demo`);
 lines.push(`Matched: ${latest.report.evaluation.matched.join(', ')||'none recorded'}`,`Latest report observations (reported, not independently verified):`);
 for(const [key,field] of Object.entries(latest.report.input.fields))if(field)lines.push(`- ${key}: ${field.value??'unknown'} · confidence ${field.confidence} · source ${field.messageId} · quote: ${field.quote}`);
 if(!Object.keys(latest.report.input.fields).length)lines.push('- No structured observations in the latest report.');
 lines.push('Original latest report:',...latest.report.input.messages.map(m=>`[${m.id}] ${m.text}`));
 lines.push(`Unresolved facts: ${latest.report.evaluation.followupFields.join(', ')||'none listed'}`);
 if(latest.report.needsTextReview)lines.push('Human review of narrative required.');
 if(latest.report.processing)lines.push(`Extraction: ${latest.report.processing.extraction.status}.`);
 lines.push('Earlier open RED reports:');
 const earlier=active.filter(r=>r.id!==latest.id&&r.report.evaluation.tier==='RED');
 lines.push(...(earlier.length?earlier.map(r=>`- ${reportDate(r.createdAt)} IST · ${r.status} · ${r.report.evaluation.matched.join(', ')} · report ${r.id}`):['- None.']));
 lines.push('Medication chart, OP/IP encounters and clinician assessment are not recorded here. Missing observations stay unknown; older values are not carried forward. Clinical guidance is withheld pending approval.');
 return lines.join('\n');
}
