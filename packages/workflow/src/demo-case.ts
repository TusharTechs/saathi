import type { CarePlan } from './care-plan.ts';
const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
/**
 * Placeholder synthetic case for the demo hospital record until Dr. Rao sends hers. Invented, not a prescription
 * for anyone; medicine names and doses only illustrate the reminder workflow.
 */
export const demoCase=():CarePlan=>({
  synthetic:true,
  hospital:{name:'Demo Cancer Centre (synthetic)',hospitalId:'DEMO-PC-0001',department:'Palliative Medicine OPD',consultant:'Demo consultant'},
  demographics:{name:'Ramesh K. (synthetic)',age:64,sex:'male',address:'Invented address, Udupi district, Karnataka',caregiver:'Asha K.',relation:'daughter'},
  diagnosis:'Carcinoma of the buccal mucosa, on best supportive care (invented case)',
  summary:'Invented case for the Saathi demo. Pain controlled on oral morphine at last OPD visit. Family taught rescue dosing and constipation care. Phone follow-up in 2 weeks, OPD review in 1 month.',
  usualPainScore:3,
  medications:[
    {key:'morphine_sr',name:'Tab. Morphine SR (invented)',dose:'10 mg',route:'oral',slots:['morning','night'],instructions:'Swallow whole, 12-hourly',rescue:false},
    {key:'morphine_ir',name:'Oral morphine solution (invented)',dose:'5 mg',route:'oral',slots:[],instructions:'Rescue dose for breakthrough pain, as taught',rescue:true},
    {key:'lactulose',name:'Syrup Lactulose (invented)',dose:'15 ml',route:'oral',slots:['night'],instructions:'Every night while on morphine',rescue:false},
    {key:'paracetamol',name:'Tab. Paracetamol (invented)',dose:'650 mg',route:'oral',slots:['morning','afternoon','evening'],instructions:'After food',rescue:false},
  ],
  appointments:[{kind:'phone_followup',date:day(14),time:'11:00',note:'Phone follow-up'},{kind:'refill',date:day(10),note:'Morphine refill at the registered hospital'},{kind:'opd_visit',date:day(30),time:'10:00',note:'Palliative OPD review'}],
  consent:{leafletGiven:true,consented:true,recordedBy:'Demo nurse'},
});
