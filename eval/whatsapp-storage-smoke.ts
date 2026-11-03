/** Simulated WhatsApp storage check; sends no Meta, Sarvam or Groq requests. */
import {loadEnvFile} from 'node:process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {WhatsAppStore} from '../packages/whatsapp/src/store.ts';
loadEnvFile(new URL('../apps/web/env.local',import.meta.url));
const store=new WhatsAppStore(process.env.NEXT_PUBLIC_SUPABASE_URL??'',process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'');
const requestId=randomUUID(),origin={channel:'whatsapp' as const,externalId:'wamid.SAATHI_STORAGE_SMOKE_'+requestId};
const result=await store.submit({requestId,patientId:'demo-suresh',answers:{wakefulness:'W4',rescue:4,concerns:'SIMULATED WhatsApp storage check. No live Meta message was received or sent.'}},origin);
const r=result.record;assert.equal(r.report.evaluation.tier,'RED');assert.ok(r.report.evaluation.matched.includes('R2'));assert.ok(r.report.evaluation.matched.includes('A1'));assert.deepEqual(r.report.origin,origin);
const duplicate=await store.submit({requestId,patientId:'demo-suresh',answers:{wakefulness:'W4',rescue:4,concerns:'SIMULATED WhatsApp storage check. No live Meta message was received or sent.'}},origin);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.record.id,r.id);
const ack=await store.transition(r.id,'acknowledge',r.revision),done=await store.transition(r.id,'resolve',ack.revision);
const reload=(await store.queue()).records.find(item=>item.id===r.id);assert.equal(reload?.status,'resolved');assert.deepEqual(reload?.report.origin,origin);
console.log(JSON.stringify({simulated:true,liveMetaMessages:0,reportId:done.id,origin:done.report.origin?.channel,duplicate:'same record',tier:done.report.evaluation.tier,status:done.status,auditEvents:done.events.length}));
