/**
 * Care cards and videos families may receive after a non-urgent (AMBER or GREEN) report. Texts are Dr. Krithika S Rao's
 * approved wording (review form B5, B6, 7 Nov 2026). Videos are only those she ticked (D5) that come from recognised
 * hospice organisations, shared as links to their public YouTube pages (never copied or re-hosted).
 * Nothing here is sent with a RED report, and the end-of-life video is never sent automatically.
 */
export type Video={id:string;title:string;source:string;language:string};
export const VIDEOS={
  wounds:{id:'j48q5jD4l6c',title:'Wound dressing',source:'Karunashraya Hospice, Bengaluru',language:'Kannada'},
  mouth:{id:'5AMHGncd_Tc',title:'Oral (mouth) care',source:'Karunashraya Hospice, Bengaluru',language:'Kannada'},
  pressure:{id:'dGknKlhbH9I',title:'Preventing pressure sores',source:'Karunashraya Hospice, Bengaluru',language:'Kannada'},
  breathFan:{id:'RY4WajFX6bM',title:'Using a handheld fan for breathlessness',source:'St Nicholas Hospice Care, UK',language:'English'},
  breathKn:{id:'TvPMJDoe1gQ',title:'Managing breathlessness',source:'Karunashraya Hospice, Bengaluru',language:'Kannada'},
  selfCare:{id:'r6xga0OY-NQ',title:'Caring for yourself as a caregiver',source:'Karunashraya Hospice, Bengaluru',language:'Kannada'},
  lastDays:{id:'hBTbTrCLSrQ',title:'Care in the last days of life',source:'Karunashraya Hospice, Bengaluru',language:'Kannada'},
} satisfies Record<string,Video>;
export const videoUrl=(v:Video)=>`https://www.youtube.com/watch?v=${v.id}`;
const videoMessage=(...vs:Video[])=>`A short video from a recognised hospice that your palliative care team recommends:\n${vs.map(v=>`• ${v.title} (${v.source}, ${v.language}): ${videoUrl(v)}`).join('\n')}`;
export const C6='Constipation while taking morphine\n1. Morphine almost always causes constipation.\n2. Give the laxative every day, even if the patient has passed stool.\n3. Offer fluids often.\n4. Gentle movement helps.\n5. Tell the team if there is no stool for 3 days, or if there is belly pain or vomiting.';
export const C12='Counting breaths and checking drowsiness\nCounting breaths: wait until the patient is resting quietly. Watch or feel the chest or tummy rise. Count each rise for one full minute by the phone timer.\n• 12 or fewer: immediately alert your palliative care team or your local physician. Do not give further doses of pain medicine.\n• 13 to 15: tell the care team; they will call you back within 6 working hours.\nChecking drowsiness: call their name and talk to them. If they keep falling asleep while talking or eating, or are hard to wake, immediately alert your palliative care team or your local physician.';
/** Extra messages for a non-urgent report, chosen only by matched rules and reported facts; never generated. */
export function careContent(tier:string|null,matched:string[],fields:Record<string,{value:unknown}|undefined>={}):string[]{
  if(tier==='RED')return [];
  const out:string[]=[];
  if(matched.includes('A4'))out.push(C6);
  if(matched.includes('A15'))out.push(C12);
  if(matched.includes('A9'))out.push(videoMessage(VIDEOS.wounds));
  if(matched.includes('A17'))out.push(videoMessage(VIDEOS.mouth));
  if(matched.includes('A12'))out.push(videoMessage(VIDEOS.selfCare));
  if(fields.breathing?.value==='breathless_moving')out.push(videoMessage(VIDEOS.breathFan,VIDEOS.breathKn));
  return out;
}
/** Videos listed on the family web page under "Caring at home". */
export const LIBRARY:Video[]=[VIDEOS.breathFan,VIDEOS.breathKn,VIDEOS.mouth,VIDEOS.pressure,VIDEOS.wounds,VIDEOS.selfCare,VIDEOS.lastDays];
