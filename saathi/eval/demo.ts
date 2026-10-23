import { evaluate } from '../packages/rules-engine/src/index.ts';
// Synthetic English transcript; extraction below is a fixture, not an LLM result.
const text = 'Papa keeps falling asleep while talking. I gave four extra doses in the last 24 hours.';
const input = {
  messages:[{id:'synthetic-message-1',text}], context:{pack:'adult'},
  fields:{
    wakefulness:{value:'W4',confidence:1,quote:'keeps falling asleep while talking',messageId:'synthetic-message-1'},
    rescue_doses_24h:{value:4,confidence:1,quote:'four extra doses in the last 24 hours',messageId:'synthetic-message-1'},
  },
};
const result = evaluate(input);
console.log(JSON.stringify({
  synthetic:true, extraction:'fixture (no model or speech service called)', input,
  alert:{id:'synthetic-alert-1', tier:result.tier, matched:result.matched,
    protocolVersion:result.protocolVersion, mode:result.mode, status:result.status,
    trace:result.traces.filter(t => t.outcome === true),
    delivery:'local console only', caregiverGuidance:'withheld: emergency card is not approved'},
  followupFields:result.followupFields,
},null,2));
if(result.tier !== 'RED' || !result.matched.includes('R2') || !result.matched.includes('A1')) process.exitCode=1;
