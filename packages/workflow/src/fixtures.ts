import baseline from './fixture-values.json' with {type:'json'};
import type { Input } from '../../shared/src/index.ts';
import type { Intake } from './intake.ts';
export function fixtureInput(request:Intake):Input {
  if(request.scenario==='incomplete') return {messages:[{id:request.requestId,text:'Synthetic incomplete report: no symptom answers supplied.'}],fields:{},context:{pack:'adult'}};
  const fields={...baseline.fields,...(request.scenario==='urgent'?{wakefulness:'W4',rescue_doses_24h:4}:request.scenario==='review'?{rescue_doses_24h:3}:{})};
  const text='SYNTHETIC FIXTURE: explicit test observations, not a caregiver transcript.\n'+Object.entries(fields).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n');
  return {messages:[{id:request.requestId,text}],fields:Object.fromEntries(Object.entries(fields).map(([k,value])=>[k,{value,confidence:1,quote:`${k}=${JSON.stringify(value)}`,messageId:request.requestId}])),context:baseline.context} as Input;
}
