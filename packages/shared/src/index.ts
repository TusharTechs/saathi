import { z } from 'zod';
const observed = <T extends z.ZodType>(value: T) => z.object({
  value: value.nullable(), confidence: z.number().min(0).max(1),
  quote: z.string().min(1), messageId: z.string().min(1),
}).strict();
export const fieldsSchema = z.object({
  nausea_vomiting: observed(z.enum(["none", "feels_sick", "vomited"])).optional(),
  leg_swelling: observed(z.enum(["no", "same", "more"])).optional(),
  pain_now: observed(z.number().int().min(0).max(10)).optional(),
  rescue_doses_24h: observed(z.number().int().nonnegative()).optional(),
  wakefulness: observed(z.enum(["W1", "W2", "W3", "W4", "W5"])).optional(),
  breathing: observed(z.enum(["normal", "breathless_moving", "breathless_rest", "very_slow_or_pauses", "noisy_rattling"])).optional(),
  resp_rate_per_min: observed(z.number().int().nonnegative()).optional(),
  resp_count_full_minute: observed(z.boolean()).optional(),
  breathing_new: observed(z.boolean()).optional(),
  breathlessness_sudden_severe: observed(z.boolean()).optional(),
  face_neck_swelling: observed(z.boolean()).optional(),
  blue_lips: observed(z.boolean()).optional(),
  back_pain_leg_weakness: observed(z.boolean()).optional(),
  bladder_bowel_loss: observed(z.boolean()).optional(),
  confusion: observed(z.enum(["no", "gradual", "sudden", "hallucinations"])).optional(),
  seizure: observed(z.boolean()).optional(),
  heavy_bleeding: observed(z.boolean()).optional(),
  vomit_appearance: observed(z.enum(["none", "food", "green_yellow", "blood_or_coffee"])).optional(),
  black_stools: observed(z.boolean()).optional(),
  vomit_count_24h: observed(z.number().int().nonnegative()).optional(),
  swollen_belly: observed(z.boolean()).optional(),
  no_stool_or_wind: observed(z.boolean()).optional(),
  fever_c: observed(z.number().min(25).max(50)).optional(),
  chemo_within_weeks: observed(z.number().int().nonnegative()).optional(),
  pain_sudden: observed(z.boolean()).optional(),
  rescue_not_helped: observed(z.boolean()).optional(),
  med_error: observed(z.boolean()).optional(),
  self_harm_or_crisis: observed(z.boolean()).optional(),
  caregiver_coping: observed(z.enum(["managing", "struggling", "not_coping"])).optional(),
  pain_despite_medicines: observed(z.boolean()).optional(),
  cannot_keep_medicines_down: observed(z.boolean()).optional(),
  days_since_stool: observed(z.number().int().nonnegative()).optional(),
  intake: observed(z.enum(["usual", "less", "mouthfuls_sips", "nothing"])).optional(),
  reduced_intake_hours: observed(z.number().int().nonnegative()).optional(),
  wakefulness_new_since_dose_increase_72h: observed(z.boolean()).optional(),
  jerking: observed(z.boolean()).optional(),
  wound_more_bleeding: observed(z.boolean()).optional(),
  wound_stronger_smell: observed(z.boolean()).optional(),
  wound_new_discharge: observed(z.boolean()).optional(),
  wound_spreading_redness: observed(z.boolean()).optional(),
  missed_regular_doses: observed(z.number().int().nonnegative()).optional(),
}).strict();
export const contextSchema = z.object({
  pack: z.enum(['adult','paediatric']),
  usual_pain_score: z.number().int().min(0).max(10).nullable().optional(),
  on_morphine: z.boolean().nullable().optional(),
  morphine_supply_days: z.number().int().nonnegative().nullable().optional(),
  caregiver_struggling_streak: z.number().int().nonnegative().nullable().optional(),
  unanswered_card_attempts: z.number().int().nonnegative().nullable().optional(),
  days_since_checkin: z.number().int().nonnegative().nullable().optional(),
  wound_photo_available: z.boolean().nullable().optional(),
}).strict();
export const inputSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) }).strict()),
  fields: fieldsSchema, context: contextSchema,
}).strict().superRefine((input, ctx) => {
  const messages = new Map(input.messages.map(m => [m.id, m.text]));
  if (messages.size !== input.messages.length) ctx.addIssue({code:'custom', message:'Duplicate message ID'});
  for (const [key, field] of Object.entries(input.fields)) {
    if (field && !messages.get(field.messageId)?.includes(field.quote))
      ctx.addIssue({code:'custom', path:['fields',key,'quote'], message:'Quote must occur verbatim in its source message'});
  }
});
export type Input = z.infer<typeof inputSchema>;
export type Fields = z.infer<typeof fieldsSchema>;
export type Context = z.infer<typeof contextSchema>;
export type FieldName = keyof Fields;
export type ContextName = Exclude<keyof Context, 'pack'>;
