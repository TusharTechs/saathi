import { z } from 'zod';
/**
 * Synthetic care plan received from the demo hospital record through "Check in to Saathi".
 * Real hospital data cannot be linked without an MOU, so every plan is invented and labelled.
 */
export const SLOTS=['morning','afternoon','evening','night'] as const;
export type Slot=typeof SLOTS[number];
export const SLOT_TIME:Record<Slot,string>={morning:'08:00',afternoon:'14:00',evening:'20:00',night:'22:00'};
export const medicationSchema=z.object({
  key:z.string().regex(/^[a-z0-9_-]{1,40}$/),name:z.string().min(1).max(80),dose:z.string().min(1).max(80),route:z.string().max(40).default('oral'),
  slots:z.array(z.enum(SLOTS)).max(4).default([]),instructions:z.string().max(300).default(''),rescue:z.boolean().default(false),
}).strict();
export const appointmentSchema=z.object({kind:z.enum(['opd_visit','phone_followup','refill']),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.string().regex(/^\d{2}:\d{2}$/).optional(),note:z.string().max(200).default('')}).strict();
export const carePlanSchema=z.object({
  synthetic:z.literal(true),
  hospital:z.object({name:z.string().max(80),hospitalId:z.string().max(40),department:z.string().max(80),consultant:z.string().max(80)}).strict(),
  demographics:z.object({name:z.string().max(80),age:z.number().int().min(0).max(120),sex:z.enum(['female','male','other']),address:z.string().max(200),phone:z.string().regex(/^\d{8,15}$/).optional(),email:z.email().optional(),caregiver:z.string().max(80),relation:z.string().max(40)}).strict(),
  diagnosis:z.string().max(200),summary:z.string().max(2000),usualPainScore:z.number().int().min(0).max(10).optional(),
  medications:z.array(medicationSchema).max(20),appointments:z.array(appointmentSchema).max(20),
  consent:z.object({leafletGiven:z.boolean(),consented:z.boolean(),recordedBy:z.string().max(80)}).strict(),
  // Dr. Rao (7 Nov): follow-up is closed when the patient dies or moves to another primary palliative care team.
  closure:z.object({reason:z.enum(['died','transferred','other']),note:z.string().max(300).default(''),closedAt:z.string(),closedBy:z.string().max(80)}).strict().optional(),
}).strict();
export type CarePlan=z.infer<typeof carePlanSchema>;
export type CarePlanEntry={plan:CarePlan;checkedInAt:string};
export type DoseLog={doseKey:string;dueDate:string;slot:Slot;status:'given'|'not_given';reportedAt:string};
