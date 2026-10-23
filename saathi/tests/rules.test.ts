import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../packages/rules-engine/src/index.ts';
import values from '../eval/negative-values.json' with { type:'json' };
import type { Input } from '../packages/shared/src/index.ts';
function input(changes:Record<string,unknown>={}, context:Record<string,unknown>={}): Input {
  const facts = {...values.fields,...changes};
  const text = Object.entries(facts).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join('; ');
  return {messages:[{id:'test',text}], fields:Object.fromEntries(Object.entries(facts).map(([k,v]) => [k,{value:v,confidence:1,quote:`${k}=${JSON.stringify(v)}`,messageId:'test'}])), context:{...values.context,...context}} as Input;
}
test('R1 activates on its positive fixture', () => assert.ok(evaluate(input({"wakefulness": "W5"},{})).matched.includes('R1')));
test('R2 activates on its positive fixture', () => assert.ok(evaluate(input({"wakefulness": "W4"},{})).matched.includes('R2')));
test('R3 activates on its positive fixture', () => assert.ok(evaluate(input({"resp_rate_per_min": 12, "resp_count_full_minute": true},{})).matched.includes('R3')));
test('R4 activates on its positive fixture', () => assert.ok(evaluate(input({"blue_lips": true},{})).matched.includes('R4')));
test('R5 activates on its positive fixture', () => assert.ok(evaluate(input({"bladder_bowel_loss": true},{})).matched.includes('R5')));
test('R6 activates on its positive fixture', () => assert.ok(evaluate(input({"confusion": "sudden"},{})).matched.includes('R6')));
test('R7 activates on its positive fixture', () => assert.ok(evaluate(input({"seizure": true},{})).matched.includes('R7')));
test('R8 activates on its positive fixture', () => assert.ok(evaluate(input({"black_stools": true},{})).matched.includes('R8')));
test('R9 activates on its positive fixture', () => assert.ok(evaluate(input({"vomit_count_24h": 2, "swollen_belly": true, "no_stool_or_wind": true},{})).matched.includes('R9')));
test('R10 activates on its positive fixture', () => assert.ok(evaluate(input({"fever_c": 38, "chemo_within_weeks": 6},{})).matched.includes('R10')));
test('R11 activates on its positive fixture', () => assert.ok(evaluate(input({"pain_now": 8, "pain_sudden": true, "rescue_not_helped": true},{})).matched.includes('R11')));
test('R12 activates on its positive fixture', () => assert.ok(evaluate(input({"med_error": true},{})).matched.includes('R12')));
test('R13 activates on its positive fixture', () => assert.ok(evaluate(input({"caregiver_coping": "not_coping"},{})).matched.includes('R13')));
test('A1 activates on its positive fixture', () => assert.ok(evaluate(input({"rescue_doses_24h": 3},{})).matched.includes('A1')));
test('A2 activates on its positive fixture', () => assert.ok(evaluate(input({"pain_now": 7, "pain_despite_medicines": true},{})).matched.includes('A2')));
test('A3 activates on its positive fixture', () => assert.ok(evaluate(input({"vomit_count_24h": 3},{})).matched.includes('A3')));
test('A4 activates on its positive fixture', () => assert.ok(evaluate(input({"days_since_stool": 3},{"on_morphine": true})).matched.includes('A4')));
test('A5 activates on its positive fixture', () => assert.ok(evaluate(input({"intake": "mouthfuls_sips", "reduced_intake_hours": 24},{})).matched.includes('A5')));
test('A6 activates on its positive fixture', () => assert.ok(evaluate(input({"wakefulness": "W3", "wakefulness_new_since_dose_increase_72h": true},{})).matched.includes('A6')));
test('A7 activates on its positive fixture', () => assert.ok(evaluate(input({"jerking": true},{})).matched.includes('A7')));
test('A8 activates on its positive fixture', () => assert.ok(evaluate(input({"confusion": "gradual"},{})).matched.includes('A8')));
test('A9 activates on its positive fixture', () => assert.ok(evaluate(input({"wound_stronger_smell": true},{"wound_photo_available": true})).matched.includes('A9')));
test('A10 activates on its positive fixture', () => assert.ok(evaluate(input({"breathing": "breathless_rest", "breathing_new": true},{})).matched.includes('A10')));
test('A11 activates on its positive fixture', () => assert.ok(evaluate(input({"missed_regular_doses": 2},{})).matched.includes('A11')));
test('A12 activates on its positive fixture', () => assert.ok(evaluate(input({},{"caregiver_struggling_streak": 2})).matched.includes('A12')));
test('A13 activates on its positive fixture', () => assert.ok(evaluate(input({},{"unanswered_card_attempts": 2})).matched.includes('A13')));
test('A14 activates on its positive fixture', () => assert.ok(evaluate(input({},{"days_since_checkin": 2})).matched.includes('A14')));

test('complete explicitly negative report is GREEN', () => assert.equal(evaluate(input()).tier,'GREEN'));
test('negative report matches no active rule', () => assert.deepEqual(evaluate(input()).matched,[]));
test('draft A15 stays disabled at both boundaries', () => {
  for(const n of [13,15]) assert.ok(!evaluate(input({resp_rate_per_min:n,resp_count_full_minute:true})).matched.includes('A15'));
});
test('empty input never defaults to GREEN', () => {
 const r=evaluate({messages:[],fields:{},context:{pack:'adult'}});
 assert.equal(r.tier,null); assert.equal(r.status,'needs_followup');
});
test('RED takes precedence and preserves all rule IDs', () => {
 const r=evaluate(input({wakefulness:'W4',rescue_doses_24h:4}));
 assert.equal(r.tier,'RED'); assert.ok(r.matched.includes('R2')); assert.ok(r.matched.includes('A1'));
});
test('low-confidence negative cannot clear a rule', () => {
 const i=input(); i.fields.seizure!.confidence=0.1;
 const r=evaluate(i); assert.equal(r.tier,null); assert.ok(r.unknownRuleIds.includes('R7'));
});
test('low-confidence positive still raises RED and requests confirmation', () => {
 const i=input({seizure:true}); i.fields.seizure!.confidence=0.1;
 const r=evaluate(i); assert.equal(r.tier,'RED'); assert.equal(r.status,'needs_followup');
});
test('missing facts do not suppress a known RED', () => {
 const i=input({wakefulness:'W5'}); delete i.fields.seizure;
 assert.equal(evaluate(i).tier,'RED');
});
test('paediatric input never executes adult rules', () => {
 const r=evaluate(input({resp_rate_per_min:8,resp_count_full_minute:true},{pack:'paediatric'}));
 assert.equal(r.status,'unsupported_pack'); assert.equal(r.tier,null); assert.deepEqual(r.traces,[]);
});
test('rejects fabricated quotes and source references', () => {
 const i=input(); i.fields.seizure!.quote='invented quote'; assert.throws(() => evaluate(i));
 i.fields.seizure!.quote='seizure=false'; i.fields.seizure!.messageId='missing'; assert.throws(() => evaluate(i));
});
test('rejects wrong types, extra fields and out-of-range pain', () => {
 assert.throws(() => evaluate(input({pain_now:11})));
 assert.throws(() => evaluate(input({seizure:'false'})));
 assert.throws(() => evaluate(input({unknown_flag:true})));
});
test('null evidence remains unknown', () => {
 const i=input(); i.fields.seizure!.value=null;
 assert.equal(evaluate(i).tier,null);
});
test('evaluation is deterministic and does not mutate input', () => {
 const i=input({wakefulness:'W4'}); const before=JSON.stringify(i);
 assert.deepEqual(evaluate(i),evaluate(i)); assert.equal(JSON.stringify(i),before);
});
test('alert trace retains source quote, message and protocol version', () => {
 const r=evaluate(input({seizure:true})); const trace=r.traces.find(t=>t.ruleId==='R7')!;
 assert.equal(trace.evidence[0]!.quote,'seizure=true'); assert.equal(trace.evidence[0]!.messageId,'test');
 assert.equal(r.protocolVersion,'adult.v1-demo.1'); assert.equal(r.mode,'demo_only');
});
test('R3 includes noisy new breathing with drowsiness', () => assert.ok(evaluate(input({breathing:'noisy_rattling',breathing_new:true,wakefulness:'W3'})).matched.includes('R3')));
test('R3 needs full minute confirmation for counted rate', () => assert.ok(!evaluate(input({resp_rate_per_min:12})).matched.includes('R3')));
test('pain baseline difference branch is supported', () => assert.ok(evaluate(input({pain_now:5},{usual_pain_score:2})).matched.includes('A2')));
test('R3 negative boundary 0', () => assert.ok(!evaluate(input({"resp_rate_per_min": 13, "resp_count_full_minute": true},{})).matched.includes('R3')));
test('R10 negative boundary 1', () => assert.ok(!evaluate(input({"fever_c": 37.9, "chemo_within_weeks": 6},{})).matched.includes('R10')));
test('R10 negative boundary 2', () => assert.ok(!evaluate(input({"fever_c": 38, "chemo_within_weeks": 7},{})).matched.includes('R10')));
test('R11 negative boundary 3', () => assert.ok(!evaluate(input({"pain_now": 7, "pain_sudden": true, "rescue_not_helped": true},{})).matched.includes('R11')));
test('A1 negative boundary 4', () => assert.ok(!evaluate(input({"rescue_doses_24h": 2},{})).matched.includes('A1')));
test('A2 negative boundary 5', () => assert.ok(!evaluate(input({"pain_now": 6, "pain_despite_medicines": true},{"usual_pain_score": 6})).matched.includes('A2')));
test('A3 negative boundary 6', () => assert.ok(!evaluate(input({"vomit_count_24h": 2},{})).matched.includes('A3')));
test('A4 negative boundary 7', () => assert.ok(!evaluate(input({"days_since_stool": 2},{"on_morphine": true})).matched.includes('A4')));
test('A5 negative boundary 8', () => assert.ok(!evaluate(input({"intake": "nothing", "reduced_intake_hours": 23},{})).matched.includes('A5')));
test('A11 negative boundary 9', () => assert.ok(!evaluate(input({"missed_regular_doses": 1},{})).matched.includes('A11')));
test('A12 negative boundary 10', () => assert.ok(!evaluate(input({},{"caregiver_struggling_streak": 1})).matched.includes('A12')));
test('A13 negative boundary 11', () => assert.ok(!evaluate(input({},{"unanswered_card_attempts": 1})).matched.includes('A13')));
test('A14 negative boundary 12', () => assert.ok(!evaluate(input({},{"days_since_checkin": 1})).matched.includes('A14')));
test('A11 negative boundary 13', () => assert.ok(!evaluate(input({},{"on_morphine": true, "morphine_supply_days": 6})).matched.includes('A11')));
