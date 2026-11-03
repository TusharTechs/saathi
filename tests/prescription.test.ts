import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restrictedItems,signRx,verifyRx,rxInput,type Prescription} from '../packages/workflow/src/prescription.ts';
test('teleconsult prescriptions block narcotic, psychotropic, Schedule X and anti-cancer drugs',()=>{
  const hits=restrictedItems([{medicine:'Tab. Morphine SR'},{medicine:'Ondansetron'},{medicine:'Fentanyl patch'},{medicine:'Inj. MIDAZOLAM'},{medicine:'Tab Tramadol'},{medicine:'Capecitabine 500'},{medicine:'Lactulose syrup'}]);
  assert.deepEqual(hits.map(h=>[h.index,h.category]),[[0,'narcotic (NDPS Act)'],[2,'narcotic (NDPS Act)'],[3,'psychotropic (NDPS Act)'],[4,'narcotic (NDPS Act)'],[5,'anti-cancer']]);
  assert.deepEqual(restrictedItems([{medicine:'Paracetamol'},{medicine:'Senna'},{medicine:'Metoclopramide'}]),[]);
});
test('a signed prescription detects any later change',()=>{
  const base:Omit<Prescription,'signature'>={id:crypto.randomUUID(),alertId:null,patientId:'demo-ramesh',prescriber:'Dr. Test',registration:'KMC-12345',items:[{medicine:'Ondansetron',dose:'4 mg',frequency:'twice a day',days:3,instructions:''}],advice:null,issuedAt:'2026-11-03T10:00:00.000Z'};
  const signed={...base,signature:signRx(base,'s'.repeat(40))};
  assert.equal(verifyRx(signed,'s'.repeat(40)),true);
  assert.equal(verifyRx({...signed,items:[{...signed.items[0]!,dose:'8 mg'}]},'s'.repeat(40)),false);
  assert.equal(verifyRx(signed,'t'.repeat(40)),false);
});
test('the doctor must attest and name each medicine, dose, frequency and duration',()=>{
  assert.equal(rxInput.safeParse({patientId:'demo-ramesh',alertId:null,registration:'KMC-1',items:[{medicine:'Ondansetron',dose:'4 mg',frequency:'BD',days:3}],attested:true}).success,true);
  assert.equal(rxInput.safeParse({patientId:'demo-ramesh',alertId:null,registration:'KMC-1',items:[{medicine:'Ondansetron',dose:'4 mg',frequency:'BD',days:3}]}).success,false);
  assert.equal(rxInput.safeParse({patientId:'demo-ramesh',alertId:null,registration:'KMC-1',items:[]  ,attested:true}).success,false);
});
