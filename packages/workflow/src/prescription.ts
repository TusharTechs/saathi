import {createHmac} from 'node:crypto';
import {z} from 'zod';
/**
 * Teleconsult prescriptions written by a doctor after a call. The app never suggests medicines; it only blocks
 * drugs that may not be prescribed by teleconsultation (restricted list is data, awaiting Dr. Rao's review).
 */
export const rxItem=z.object({medicine:z.string().trim().min(2).max(80),dose:z.string().trim().min(1).max(40),frequency:z.string().trim().min(1).max(60),days:z.number().int().min(1).max(90),instructions:z.string().trim().max(160).default('')}).strict();
export const rxInput=z.object({patientId:z.string().min(1).max(40),alertId:z.uuid().nullable(),registration:z.string().trim().min(3).max(40),items:z.array(rxItem).min(1).max(10),advice:z.string().trim().max(1000).default(''),attested:z.literal(true)}).strict();
export type RxItem=z.infer<typeof rxItem>;
export type Prescription={id:string;alertId:string|null;patientId:string;prescriber:string;registration:string;items:RxItem[];advice:string|null;signature:string;issuedAt:string};
export {restrictedItems,restrictedList} from './restricted.ts';
/** Canonical text that the signature covers, so any later change to the prescription is detectable. */
export const rxCanonical=(r:Omit<Prescription,'signature'>)=>JSON.stringify([r.id,r.patientId,r.alertId,r.prescriber,r.registration,r.items.map(i=>[i.medicine,i.dose,i.frequency,i.days,i.instructions]),r.advice??'',r.issuedAt]);
export const signRx=(r:Omit<Prescription,'signature'>,secret:string)=>createHmac('sha256','saathi-rx:'+secret).update(rxCanonical(r)).digest('base64url');
export const verifyRx=(r:Prescription,secret:string)=>signRx(r,secret)===r.signature;
