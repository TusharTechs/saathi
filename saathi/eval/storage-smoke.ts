import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:3000';
async function request(path:string,payload?:unknown){
 const r=await fetch(base+path,{method:payload===undefined?'GET':'POST',headers:payload===undefined?{}:{'Content-Type':'application/json',Origin:base},body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
 return {status:r.status,data:await r.json()};
}
const initial=await request('/api/queue');assert.equal(initial.status,200);assert.equal(initial.data.storage,'supabase');assert.equal(initial.data.patients.length,5);
const payload={requestId:randomUUID(),patientId:'demo-fatima',scenario:'urgent',answers:{}};
const [one,two]=await Promise.all([request('/api/intake',payload),request('/api/intake',payload)]);
assert.ok([200,201].includes(one.status));assert.ok([200,201].includes(two.status));assert.equal(one.data.record.id,two.data.record.id);assert.equal(Number(one.data.duplicate)+Number(two.data.duplicate),1);
const record=one.data.record;assert.equal(record.report.evaluation.tier,'RED');assert.equal(record.events.length,1);
const [ackA,ackB]=await Promise.all([request(`/api/alerts/${record.id}`,{action:'acknowledge',expectedRevision:1}),request(`/api/alerts/${record.id}`,{action:'acknowledge',expectedRevision:1})]);
assert.deepEqual([ackA.status,ackB.status].sort(),[200,409]);
const stale=await request(`/api/alerts/${record.id}`,{action:'resolve',expectedRevision:1});assert.equal(stale.status,409);
const done=await request(`/api/alerts/${record.id}`,{action:'resolve',expectedRevision:2});assert.equal(done.status,200);assert.equal(done.data.events.length,3);
const final=await request('/api/queue');const matches=final.data.records.filter((r:{requestId:string})=>r.requestId===payload.requestId);assert.equal(matches.length,1);assert.equal(matches[0].status,'resolved');
console.log(JSON.stringify({storage:final.data.storage,concurrentSubmission:'deduplicated',concurrentAcknowledgement:'one winner',staleRevision:'rejected',resolvedReportId:record.id,persistedAuditEvents:matches[0].events.length,records:final.data.records.length}));
