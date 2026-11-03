/**
 * Service settings an organisation would configure. Call-back targets are the values Dr. Rao gave on the
 * 3 Nov call and await her written confirmation (review pack item A5). Fees are optional: free services turn them off.
 */
export const service={
  callbackMinutes:{RED:60,AMBER:360,GREEN:1440,PENDING:1440} as Record<string,number>,
  callbackTargetsConfirmed:false,
  fees:{enabled:true,currency:'INR',audioCall:500,videoCall:500,followUpWithinDays:15,followUpFactor:0.5},
};
export const callbackDue=(createdAt:string,tier:string|null)=>Date.parse(createdAt)+(service.callbackMinutes[tier??'PENDING']??1440)*60000;
/** Stable, human-friendly Saathi ID for a patient, shared with the family at registration (FNV-1a, browser-safe). */
export const saathiId=(patientId:string)=>{let h=0x811c9dc5;for(const c of 'saathi-id:'+patientId){h^=c.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0;}return 'SA-'+h.toString(36).toUpperCase().padStart(6,'0').slice(-6);};
