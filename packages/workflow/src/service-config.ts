/**
 * Service settings an organisation would configure. Call-back targets are the values Dr. Rao gave on the
 * 3 Nov call and await her written confirmation (review pack item A5). Fees are optional: free services turn them off.
 */
export const service={
  callbackMinutes:{RED:60,AMBER:360,GREEN:1440,PENDING:1440} as Record<string,number>,
  callbackTargetsConfirmed:false,
  fees:{enabled:true,currency:'INR',audioCall:500,videoCall:500,followUpWithinDays:15,followUpFactor:0.5},
};
// Dr. Rao's wording from the 3 Nov call, awaiting written confirmation (review pack B1). Sent to families on every RED.
export const RED_FAMILY_MESSAGE='The patient’s condition may be critical and cannot be managed through teleconsultation. Please seek urgent medical care at the nearest hospital now. If breathing stops or you cannot wake the patient, call 108. Our on-call doctor has also been alerted.';
export const RIDER='If the patient is very sick, go to the nearest hospital or call 108.';
const hours=(m:number)=>m>=1440?`${m/60} hours`:m>=120?`${m/60} hours`:`${m} minutes`;
/** Family-facing reply after a report is saved: fixed text only, never generated advice. */
export function familyReply(tier:string|null,extraction?:string){
  if(tier==='RED')return RED_FAMILY_MESSAGE;
  if(extraction&&extraction!=='complete')return `We received your message. A member of the care team will review it and call you back. ${RIDER}`;
  return `Thank you. Your concern has been recorded and the care team will call you back within ${hours(service.callbackMinutes[tier??'PENDING']??1440)}. ${RIDER}`;
}
export const GREETING=`Hello, this is Saathi, the support line of your palliative care team. What is worrying you today? Type it in your own words or send a voice note, and the care team will call you back. ${RIDER}`;
export const callbackDue=(createdAt:string,tier:string|null)=>Date.parse(createdAt)+(service.callbackMinutes[tier??'PENDING']??1440)*60000;
/** Stable, human-friendly Saathi ID for a patient, shared with the family at registration (FNV-1a, browser-safe). */
export const saathiId=(patientId:string)=>{let h=0x811c9dc5;for(const c of 'saathi-id:'+patientId){h^=c.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0;}return 'SA-'+h.toString(36).toUpperCase().padStart(6,'0').slice(-6);};
