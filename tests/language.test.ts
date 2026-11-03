import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scriptLanguage} from '../packages/telegram/src/engine.ts';
test('a typed message is labelled by its script, so families never pick a language',()=>{
  assert.equal(scriptLanguage('वह बहुत सो रहे हैं','en-IN'),'hi-IN');
  assert.equal(scriptLanguage('ಅವರು ತುಂಬಾ ನಿದ್ದೆ ಮಾಡುತ್ತಿದ್ದಾರೆ','en-IN'),'kn-IN');
  assert.equal(scriptLanguage('He is very sleepy today','hi-IN'),'hi-IN','Latin script keeps the chat setting (romanised Hindi)');
  assert.equal(scriptLanguage('He is very sleepy today','unknown'),'en-IN');
  assert.equal(scriptLanguage('Morphine 3 बार दिया','en-IN'),'hi-IN');
});
