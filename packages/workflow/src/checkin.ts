import type { Intake } from './intake.ts';
export type CheckinQuestion={key:keyof Intake['answers'];text:string;choices:[string,string][];max?:number;boolean?:boolean;textInput?:boolean};
/** Keep the first six indexes stable for existing private chat drafts. */
export const checkinQuestions:CheckinQuestion[]=[
 {key:'wakefulness',text:'How awake are they?',choices:[['Awake / talking normally','W1'],['Sleeping, wakes easily','W2'],['Drowsy but stays awake','W3'],['Falls asleep while talking/eating','W4'],['Very hard to wake / cannot wake','W5']]},
 {key:'breathing',text:'How is the breathing?',choices:[['Normal','normal'],['Breathless when moving','breathless_moving'],['Breathless at rest','breathless_rest'],['Very slow / long pauses','very_slow_or_pauses'],['Noisy / rattling','noisy_rattling']]},
 {key:'pain',text:'Pain now, 0–10?',max:10,choices:Array.from({length:11},(_,i)=>[String(i),String(i)])},
 {key:'rescue',text:'Extra doses in the last 24 hours?',max:100,choices:Array.from({length:7},(_,i)=>[String(i),String(i)])},
 {key:'respiratoryRate',text:'Breaths counted?',max:120,choices:[8,10,12,14,16,20,24,30].map(n=>[String(n),String(n)])},
 {key:'fullMinute',text:'Was that breath count taken over a full minute?',boolean:true,choices:[['Yes','yes'],['No','no']]},
 {key:'nausea',text:'Nausea or vomiting?',choices:[['None','none'],['Feels sick','feels_sick'],['Vomited','vomited']]},
 {key:'vomitCount',text:'Vomiting episodes in the last 24 hours?',max:100,choices:[0,1,2,3,4,5].map(n=>[String(n),String(n)])},
 {key:'vomitAppearance',text:'What did the vomit look like?',choices:[['No vomiting','none'],['Food','food'],['Green or yellow','green_yellow'],['Blood or coffee-coloured','blood_or_coffee']]},
 {key:'stoolDays',text:'Days since the last stool? Enter an exact count if known.',max:365,choices:[['Today','0'],['Yesterday','1'],['2 days ago','2'],['3 days ago','3']]},
 {key:'intake',text:'Eating and drinking?',choices:[['As usual','usual'],['Less than usual','less'],['Only mouthfuls or sips','mouthfuls_sips'],['Nothing','nothing']]},
 {key:'confusion',text:'New confusion or restlessness?',choices:[['No','no'],['A little, came on slowly','gradual'],['Yes, suddenly','sudden'],['Seeing or hearing things','hallucinations']]},
 {key:'legSwelling',text:'Feet or legs swollen?',choices:[['No','no'],['Same as before','same'],['More than before','more']]},
 {key:'missedDoses',text:'Regular medicine doses missed in the last 24 hours?',max:100,choices:[0,1,2,3,4].map(n=>[String(n),String(n)])},
 {key:'concerns',text:'Anything else worrying you? Use invented text only, including any missed medicine names.',textInput:true,choices:[]},
 {key:'coping',text:'How are you coping?',choices:[['Managing','managing'],['Struggling','struggling'],['Not coping','not_coping']]},
];
export function parseCheckinAnswer(q:CheckinQuestion,value:string):string|number|boolean|undefined{
 if(value===''||value==='skip')return undefined;
 if(q.textInput){if(value.length>4000)throw Error('Report too long');return value.trim()||undefined;}
 if(q.max!==undefined){if(!/^\d{1,3}$/.test(value)||Number(value)>q.max)throw Error('Answer outside allowed range');return Number(value);}
 if(!q.choices.some(([,v])=>v===value))throw Error('Answer outside allowed choices');
 return q.boolean?value==='yes':value;
}
export function checkinAnswers(raw:Record<string,string>):Intake['answers']{
 const answers:Record<string,unknown>={};
 for(const q of checkinQuestions){const value=parseCheckinAnswer(q,raw[q.key]??'');if(value!==undefined)answers[q.key]=value;}
 if(raw.concerns?.trim())answers.concerns=raw.concerns.trim();
 return answers as Intake['answers'];
}
