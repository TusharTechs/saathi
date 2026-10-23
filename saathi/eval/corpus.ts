import type {Fields} from '../packages/shared/src/index.ts';
export type EvalCase={id:string;language:'en'|'hi'|'kn';text:string;expectedTier:'RED'|'AMBER'|'PENDING';expectedFields:Partial<{[K in keyof Fields]:NonNullable<Fields[K]>['value']}>;category:string};
type Row=[string,EvalCase['expectedTier'],EvalCase['expectedFields'],string,string,string];
// Engineering labels authored from the unsigned demo protocol. Translation/clinical review pending.
const rows:Row[]=[
 ['cannot-wake','RED',{wakefulness:'W5'},'I cannot wake him even when I call his name.','नाम से बुलाने पर भी मैं उन्हें जगा नहीं पा रहा हूँ।','ಹೆಸರು ಕರೆದರೂ ಅವರನ್ನು ಎಬ್ಬಿಸಲು ಆಗುತ್ತಿಲ್ಲ.'],
 ['falls-asleep','RED',{wakefulness:'W4'},'She keeps falling asleep while talking to me.','वह मुझसे बात करते करते सो जाती हैं।','ಅವರು ನನ್ನ ಜೊತೆ ಮಾತನಾಡುವಾಗ ಮತ್ತೆ ಮತ್ತೆ ನಿದ್ರೆ ಮಾಡುತ್ತಾರೆ.'],
 ['rate-boundary','RED',{resp_rate_per_min:12,resp_count_full_minute:true},'I counted 12 breaths over one full minute.','मैंने पूरे एक मिनट में 12 साँसें गिनीं।','ನಾನು ಪೂರ್ತಿ ಒಂದು ನಿಮಿಷದಲ್ಲಿ 12 ಉಸಿರಾಟಗಳನ್ನು ಎಣಿಸಿದೆ.'],
 ['slow-pauses','RED',{breathing:'very_slow_or_pauses'},'His breathing is very slow with long pauses.','उनकी साँस बहुत धीमी है और बीच में लंबे विराम हैं।','ಅವರ ಉಸಿರಾಟ ತುಂಬಾ ನಿಧಾನವಾಗಿದೆ ಮತ್ತು ನಡುವೆ ದೀರ್ಘ ವಿರಾಮಗಳಿವೆ.'],
 ['sudden-confusion','RED',{confusion:'sudden'},'She became confused all of a sudden today.','आज अचानक उन्हें भ्रम होने लगा।','ಇಂದು ಅವರಿಗೆ ಇದ್ದಕ್ಕಿದ್ದಂತೆ ಗೊಂದಲ ಶುರುವಾಯಿತು.'],
 ['hallucinations','RED',{confusion:'hallucinations'},'He is seeing people who are not there.','उन्हें ऐसे लोग दिखाई दे रहे हैं जो वहाँ नहीं हैं।','ಅಲ್ಲಿ ಇಲ್ಲದ ಜನರು ಅವರಿಗೆ ಕಾಣಿಸುತ್ತಿದ್ದಾರೆ.'],
 ['blood-vomit','RED',{vomit_appearance:'blood_or_coffee'},'She is vomiting blood now.','अभी उन्हें खून की उल्टी हो रही है।','ಈಗ ಅವರಿಗೆ ರಕ್ತ ವಾಂತಿ ಆಗುತ್ತಿದೆ.'],
 ['seizure','RED',{seizure:true},'He is having a seizure now.','अभी उन्हें दौरा पड़ रहा है।','ಈಗ ಅವರಿಗೆ ಸೆಳೆತ ಬರುತ್ತಿದೆ.'],
 ['double-dose','RED',{med_error:true},'I accidentally gave her a double dose of medicine.','मैंने गलती से उन्हें दवा की दोहरी खुराक दे दी।','ನಾನು ತಪ್ಪಾಗಿ ಅವರಿಗೆ ಔಷಧಿಯ ಎರಡು ಪಟ್ಟು ಡೋಸ್ ಕೊಟ್ಟೆ.'],
 ['not-coping','RED',{caregiver_coping:'not_coping'},'As the caregiver, I am not coping at all.','मैं देखभाल करने वाला हूँ और बिल्कुल संभाल नहीं पा रहा हूँ।','ನಾನು ಆರೈಕೆ ಮಾಡುವವನು, ನನಗೆ ಇದನ್ನು ನಿಭಾಯಿಸಲು ಆಗುತ್ತಿಲ್ಲ.'],
 ['rescue-three','AMBER',{rescue_doses_24h:3},'I gave three extra rescue doses in the last 24 hours.','पिछले 24 घंटे में मैंने तीन अतिरिक्त खुराक दी हैं।','ಕಳೆದ 24 ಗಂಟೆಗಳಲ್ಲಿ ಮೂರು ಹೆಚ್ಚುವರಿ ರೆಸ್ಕ್ಯೂ ಡೋಸ್ ಕೊಟ್ಟಿದ್ದೇನೆ.'],
 ['rescue-four','AMBER',{rescue_doses_24h:4},'She needed four extra rescue doses in the last 24 hours.','पिछले 24 घंटे में उन्हें चार अतिरिक्त खुराक चाहिए थीं।','ಕಳೆದ 24 ಗಂಟೆಗಳಲ್ಲಿ ಅವರಿಗೆ ನಾಲ್ಕು ಹೆಚ್ಚುವರಿ ರೆಸ್ಕ್ಯೂ ಡೋಸ್ ಬೇಕಾಯಿತು.'],
 ['vomit-three','AMBER',{vomit_count_24h:3},'He vomited three times in the last 24 hours.','पिछले 24 घंटे में उन्हें तीन बार उल्टी हुई।','ಕಳೆದ 24 ಗಂಟೆಗಳಲ್ಲಿ ಅವರಿಗೆ ಮೂರು ಬಾರಿ ವಾಂತಿ ಆಯಿತು.'],
 ['missed-two','AMBER',{missed_regular_doses:2},'Two regular medicine doses were missed in the last 24 hours.','पिछले 24 घंटे में नियमित दवा की दो खुराक छूट गईं।','ಕಳೆದ 24 ಗಂಟೆಗಳಲ್ಲಿ ನಿಯಮಿತ ಔಷಧಿಯ ಎರಡು ಡೋಸ್ ತಪ್ಪಿಹೋಗಿವೆ.'],
 ['missed-four','AMBER',{missed_regular_doses:4},'Four regular medicine doses were missed in the last 24 hours.','पिछले 24 घंटे में नियमित दवा की चार खुराक छूट गईं।','ಕಳೆದ 24 ಗಂಟೆಗಳಲ್ಲಿ ನಿಯಮಿತ ಔಷಧಿಯ ನಾಲ್ಕು ಡೋಸ್ ತಪ್ಪಿಹೋಗಿವೆ.'],
 ['low-pain','PENDING',{pain_now:2},'Her pain right now is two out of ten.','अभी उनका दर्द दस में से दो है।','ಈಗ ಅವರ ನೋವು ಹತ್ತರಲ್ಲಿ ಎರಡು ಇದೆ.'],
 ['unknown','PENDING',{},'I do not know how he is doing today.','मुझे नहीं पता कि आज उनकी हालत कैसी है।','ಇಂದು ಅವರ ಸ್ಥಿತಿ ಹೇಗಿದೆ ಎಂದು ನನಗೆ ಗೊತ್ತಿಲ್ಲ.'],
 ['stool-no-context','PENDING',{days_since_stool:3},'The last stool was three days ago. I do not know which medicines he takes.','आखिरी बार मल तीन दिन पहले हुआ था। मुझे उनकी दवाओं के बारे में नहीं पता।','ಕೊನೆಯ ಮಲವಿಸರ್ಜನೆ ಮೂರು ದಿನಗಳ ಹಿಂದೆ ಆಯಿತು. ಅವರು ಯಾವ ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳುತ್ತಾರೆ ಎಂದು ನನಗೆ ಗೊತ್ತಿಲ್ಲ.'],
 ['negated-seizure','PENDING',{seizure:false},'He has no seizure today.','आज उन्हें दौरा नहीं पड़ा है।','ಇಂದು ಅವರಿಗೆ ಸೆಳೆತ ಬಂದಿಲ್ಲ.'],
 ['historical-bleeding','PENDING',{heavy_bleeding:false},'There was heavy bleeding last year, but there is no bleeding now.','पिछले साल बहुत खून बहा था, लेकिन अभी खून नहीं बह रहा है।','ಕಳೆದ ವರ್ಷ ತುಂಬಾ ರಕ್ತಸ್ರಾವವಾಗಿತ್ತು, ಆದರೆ ಈಗ ರಕ್ತಸ್ರಾವ ಇಲ್ಲ.'],
];
export const corpus:EvalCase[]=rows.flatMap(([category,expectedTier,expectedFields,...texts])=>(['en','hi','kn'] as const).map((language,i)=>({id:`${language}-${category}`,language,text:texts[i]!,expectedTier,expectedFields,category})));
