import { createHash } from 'node:crypto';
import type { Patient, RecordEntry } from './store.ts';
/**
 * FHIR R4 export of one saved check-in, for showing ABDM readiness without sandbox access.
 * Base R4 resources only; NRCeS profile conformance is not claimed or validated. The ABHA number
 * is simulated, every resource carries the HL7 "test health data" security label, and observations
 * stay "preliminary" because they are caregiver-reported and unreviewed.
 */
const TEST_DATA={system:'http://terminology.hl7.org/CodeSystem/v3-ActReason',code:'HTEST',display:'test health data'};
const FIELD_SYSTEM='urn:saathi:checkin-field';
// Only fields with an exact standard code get one; the rest keep Saathi's field code and a display text.
const LOINC:Record<string,{code:string;display:string;unit?:string}>={
  pain_now:{code:'72514-3',display:'Pain severity - 0-10 verbal numeric rating [Score] - Reported'},
  resp_rate_per_min:{code:'9279-1',display:'Respiratory rate',unit:'/min'},
  fever_c:{code:'8310-5',display:'Body temperature',unit:'Cel'},
};
export const simulatedAbha=(patientId:string)=>{
  const digits=BigInt('0x'+createHash('sha256').update(patientId).digest('hex').slice(0,16)).toString().padStart(14,'0').slice(-14);
  return `${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6,10)}-${digits.slice(10)}`;
};
const label=(name:string)=>name.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
function value(name:string,v:unknown){
  const loinc=LOINC[name];
  if(typeof v==='boolean')return {valueBoolean:v};
  if(typeof v==='number')return loinc?.unit?{valueQuantity:{value:v,unit:loinc.unit,system:'http://unitsofmeasure.org',code:loinc.unit}}:{valueInteger:v};
  return {valueCodeableConcept:{coding:[{system:`${FIELD_SYSTEM}:${name}`,code:String(v)}],text:String(v).replaceAll('_',' ')}};
}
export function toFhirBundle(record:RecordEntry,patient:Patient){
  const meta={security:[TEST_DATA]},patientRef=`urn:uuid:patient-${patient.id}`,at=record.createdAt;
  const fields=Object.entries(record.report.input.fields).filter((e):e is [string,NonNullable<typeof e[1]>]=>Boolean(e[1])&&e[1]!.value!==null);
  const observations=fields.map(([name,f],i)=>{
    const loinc=LOINC[name];
    return {fullUrl:`urn:uuid:observation-${record.id}-${i}`,resource:{resourceType:'Observation',meta,status:'preliminary',
      category:[{coding:[{system:'http://terminology.hl7.org/CodeSystem/observation-category',code:'survey',display:'Survey'}]}],
      code:{coding:[...(loinc?[{system:'http://loinc.org',code:loinc.code,display:loinc.display}]:[]),{system:FIELD_SYSTEM,code:name,display:label(name)}],text:label(name)},
      subject:{reference:patientRef},effectiveDateTime:at,performer:[{display:'Family caregiver (self-reported)'}],...value(name,f.value),
      note:[{text:`Caregiver's words: "${f.quote}" · extraction confidence ${f.confidence}`}]}};
  });
  const tier=record.report.evaluation.tier;
  const flag={fullUrl:`urn:uuid:flag-${record.id}`,resource:{resourceType:'Flag',meta,status:record.status==='resolved'?'inactive':'active',
    code:{text:`Saathi demo protocol routing: ${tier??'needs review'} (${record.report.evaluation.matched.join(', ')||'no rule matched'}; protocol ${record.report.evaluation.protocolVersion}, unsigned demo)`},
    subject:{reference:patientRef},period:{start:at}}};
  const origin=record.report.origin;
  const provenance={fullUrl:`urn:uuid:provenance-${record.id}`,resource:{resourceType:'Provenance',meta,recorded:at,
    target:[...observations.map(o=>({reference:o.fullUrl})),{reference:flag.fullUrl}],
    agent:[{type:{text:'Source'},who:{display:`Family caregiver via ${origin?.channel??'web'} (${record.report.source})`}},{type:{text:'Assembler'},who:{display:'Saathi deterministic rules engine'}}],
    entity:origin?[{role:'source',what:{identifier:{system:`urn:saathi:${origin.channel}-message`,value:origin.externalId}}}]:undefined}};
  return {resourceType:'Bundle',meta,type:'collection',identifier:{system:'urn:saathi:report',value:record.id},timestamp:at,entry:[
    {fullUrl:patientRef,resource:{resourceType:'Patient',meta,
      identifier:[{type:{text:'Simulated ABHA number (not issued by ABDM)'},system:'urn:saathi:simulated-abha',value:simulatedAbha(patient.id)},{system:'urn:saathi:patient',value:patient.id}],
      name:[{text:`${patient.name} (synthetic)`}],communication:[{language:{text:patient.language},preferred:true}]}},
    ...observations,flag,provenance]};
}
