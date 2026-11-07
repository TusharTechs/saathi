import type { CarePlan } from './care-plan.ts';
const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
/**
 * Synthetic case written by Dr. Krithika S Rao in the clinical review form (D4, 7 Nov 2026). Invented: not a real
 * patient and not a prescription for anyone. Doses and timings are hers, verbatim.
 */
export const demoCase=():CarePlan=>({
  synthetic:true,
  hospital:{name:'Demo Cancer Centre (synthetic)',hospitalId:'DEMO-PC-0001',department:'Palliative Medicine OPD',consultant:'Demo consultant, Palliative Medicine'},
  demographics:{name:'Arjun Mehta',age:45,sex:'male',address:'Flat D-00, Demo Residency, Fictional Layout, Bengaluru, Karnataka',caregiver:'Priya Mehta',relation:'wife'},
  diagnosis:'Metastatic prostate adenocarcinoma with bone metastases; followed by oncology and palliative care',
  summary:'Pain is mainly over the lower back and pelvis, currently reported as 3/10 at rest. Occasional breakthrough pain with movement. Mild constipation; appetite and sleep fair. No new weakness, numbness, or bladder/bowel changes reported. Follow-up: palliative care review in 1 week to reassess pain, rescue-dose use, constipation, sedation and function; review sooner if symptoms worsen. Seek urgent medical assessment for new leg weakness or numbness, difficulty passing urine, loss of bladder/bowel control, or severe uncontrolled pain.',
  usualPainScore:3,
  medications:[
    {key:'morphine_sr',name:'Morphine sustained-release tablet',dose:'30 mg by mouth',route:'oral',slots:['morning','evening'],instructions:'At 8:00 am and 8:00 pm. Swallow whole. Take regularly.',rescue:false},
    {key:'morphine_ir',name:'Morphine immediate-release tablet',dose:'10 mg by mouth',route:'oral',slots:[],instructions:'As needed for breakthrough pain, no more often than every 4 hours. Record each dose. Contact the palliative care team if pain remains uncontrolled or rescue doses are needed frequently.',rescue:true},
    {key:'bisacodyl',name:'Bisacodyl tablet',dose:'10 mg by mouth',route:'oral',slots:['night'],instructions:'At bedtime, for constipation; adjust only as directed by the care team.',rescue:false},
  ],
  appointments:[{kind:'opd_visit',date:day(7),time:'10:00',note:'Palliative care review: pain, rescue-dose use, constipation, sedation and function'}],
  consent:{leafletGiven:true,consented:true,recordedBy:'Demo nurse'},
});
