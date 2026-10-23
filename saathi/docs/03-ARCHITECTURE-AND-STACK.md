# 03 · Architecture, ₹0 stack, data model

## 1. Data flow
```
┌──────────────────────── INGESTION ────────────────────────┐
│ WhatsApp Cloud API (test number) · Telegram bot · PWA      │
│ voice / text / photo / button taps                         │
└───────────────┬────────────────────────────────────────────┘
                ▼
   Webhook (Supabase Edge Function) → verify signature → consent check
   → store message + media (Supabase Storage) → enqueue processing
                ▼
┌──────── UNDERSTANDING  ("AI = translator, not decider") ───┐
│ STT: Sarvam Saaras (Kannada/Hindi/English) → translate      │
│ LLM extraction (Groq gpt-oss) → FIXED Zod schema            │
│   every field = {value, confidence, quote}                  │
│ Low confidence on RED-relevant field → button follow-up     │
│ Keyword safety net (EN/HI/KN) runs IN PARALLEL              │
└───────────────┬────────────────────────────────────────────┘
                ▼
┌──────── DECISION (deterministic, doctor-approved data) ────┐
│ rules-engine.evaluate(fields, patientCtx, protocolVersion)  │
│ → { tier: RED|AMBER|GREEN, matched: [ruleIds], reasons }    │
│ RED   → C-URG to family + page on-call + escalation timer   │
│ AMBER → today's review list                                 │
│ GREEN → log + approved care card (verbatim)                 │
└───────────────┬────────────────────────────────────────────┘
                ▼
┌──────── DASHBOARD (Next.js + Supabase Realtime) ───────────┐
│ Priority queue · pre-call summary · OP/IP/home timeline ·  │
│ dose & pain charts · wound photo timeline · POSS + RASS ·  │
│ PPI worksheet (doctor signs) · Jitsi consult · e-Rx (NDPS  │
│ blocked) · protocol editor · audit trail                   │
└───────────────┬────────────────────────────────────────────┘
                ▼
   pg_cron every minute: un-acked RED past N min → next on-call;
   AMBER past window → next handover. Everything → alert_events.
```

**Output guardrails:**
- Family-facing text comes only from `care_cards` with `status='approved'`. During the build, draft cards are sent with a "[DRAFT]" prefix in demo mode only.
- A drug/dose filter rejects any message naming a medicine that is not in the patient's active `medications`.
- The pre-call summary for the doctor may be LLM-written, but it must cite the quotes it uses and contain no recommendations.

## 2. Stack (all free; verified Oct 2026)
| Layer | Choice | Limits / gotchas |
|---|---|---|
| Caregiver channel | **WhatsApp Cloud API** (Meta direct, test number) | Free, no card. **Max 5 recipient numbers** on the test number, which is enough for the demo. Template messages are billed (~₹0.12 utility, India); replies within the 24-hour service window are free. A reported 1 Oct 2026 change (1,000 free service messages/month) is unverified |
| Fallback channel | **Telegram Bot API** | Free and unlimited for us. Use it for wider testing |
| Also | PWA voice recorder (`MediaRecorder`) | Works without either messaging API |
| Speech-to-text / TTS / translation | **Sarvam AI** (Saaras STT, Bulbul v3 TTS, Sarvam-Translate) | **₹100 free credits, non-expiring** ≈ 3 h of STT (₹30/h). TTS ₹30 per 10K characters. Translate max 2,000 characters/request. 60 requests/min. Save credits for the demo and eval |
| Bulk Indic speech | **Bhashini** (ULCA API key) | Free for proof-of-concept, 22 languages. Variable latency |
| LLM (extraction only) | **Groq** `gpt-oss-120b` / `gpt-oss-20b` | Free: 30 RPM, 1K RPD. Llama was removed from the free tier on 16 Aug 2026. Whisper-large-v3 is also free (weaker for Kannada) |
| LLM fallback | Gemini Flash (free) | ⚠️ **Free-tier data is used for training: synthetic data only** |
| DB / auth / storage / realtime / functions | **Supabase free** | 500 MB DB, 1 GB storage, pgvector, pg_cron. **Pauses after 7 days idle**, so add a GitHub Actions keep-alive cron |
| Web hosting | **Vercel Hobby** | Non-commercial only (fine). Pauses at limits, never bills |
| Video consult | **Jitsi Meet** (meet.jit.si links) | Free, no accounts |
| Maps | **Leaflet + OpenStreetMap** | Attribution required. Nominatim 1 request/sec, cache results |
| Photo quality | **OpenCV.js** on device (Laplacian variance + brightness) | Zero server cost |
| E-prescription PDF | `pdf-lib` in the browser | |
| Records | FHIR R4 using **NRCeS India profiles** (nrces.in/ndhm/fhir/r4) | ABDM sandbox not available (see docs/01). Show "Link ABHA (simulated)" |

**Avoid:**
- Cerebras: needs a card.
- OpenRouter: 50 requests/day free.
- Railway: no free tier.
- Render: free Postgres expires after 30 days.
- Cloudflare R2: likely needs a card.
- SMS/IVR in India: needs DLT registration and is paid.
- Twilio sandbox: limited to 100 messages, and the join code expires every 3 days.

**Production story for judges:** the open-weight LLM can run on hospital servers, and no PHI leaves the hospital.

## 3. Repo layout (pnpm monorepo)
```
saathi/
  apps/
    web/                     # Next.js (App Router): doctor dashboard + caregiver PWA (/c/*)
  supabase/
    migrations/              # SQL schema, RLS, pg_cron jobs
    functions/
      whatsapp-webhook/      # verify + store + enqueue
      telegram-webhook/
      process-message/       # STT → extraction → safety net → rules → actions
      escalation-tick/       # called by pg_cron every minute
      send-reminders/        # medicine reminders
    seed/                    # synthetic patients, care team, meds
  packages/
    clinical-content/        # protocol JSON (versioned), care cards, check-in questions, keywords EN/HI/KN
    rules-engine/            # pure TS evaluate(); 100% unit-tested
    extraction/              # Zod schema + prompt + LLM client (Groq/Gemini switchable)
    shared/                  # types, i18n strings, FHIR mappers
  eval/
    messages.jsonl           # ~200 synthetic labelled caregiver messages (EN/HI/KN)
    run-eval.ts              # recall/precision per tier, confusion matrix, per-field accuracy
  docs/                      # these handoff docs
```

## 4. Data model (Postgres; RLS on: care team sees only their patients)
```sql
care_team_members(id, auth_user_id, name, role /*doctor|nurse|coordinator*/, phone_e164, reg_no, on_call_order)
centres(id, name, type /*rmi|palliative_centre|pharmacy*/, lat, lng, district, morphine_status, last_confirmed_at)
patients(id, display_name, age, sex, diagnosis_label, pack /*adult|paediatric*/, language /*en|hi|kn*/,
         registered_centre_id, usual_pain_score, abha_simulated, status, created_at)
caregivers(id, patient_id, name, relation, phone_e164, channel /*whatsapp|telegram|pwa*/, consent_at)
protocol_versions(id, pack, version, rules_json, status /*draft|approved*/, approved_by, approved_at)
patient_overrides(id, patient_id, rule_id, params_json, set_by, set_at)
medications(id, patient_id, name, form /*liquid|tablet|patch*/, schedule_slots text[], is_rescue, is_ndps,
            photo_path, audio_path, active)
dose_logs(id, patient_id, medication_id, kind /*regular|rescue*/, given_at, source /*tap|voice|doctor*/)
messages(id, patient_id, caregiver_id, direction, channel, kind /*text|voice|image|button*/, body,
         media_path, transcript, translation, created_at)
checkins(id, patient_id, fields_json /*{field:{value,confidence,quote}}*/, source_message_ids uuid[], completed_at)
alerts(id, patient_id, checkin_id, tier, matched_rules text[], reasons_json, protocol_version_id,
       status /*open|acked|resolved*/, escalation_level, created_at, acked_by, acked_at)
alert_events(id, alert_id, event, actor, details_json, at)          -- audit trail
care_cards(id, code, pack, language, title, body_md, video_ids text[], status, approved_by, approved_at, version)
card_deliveries(id, patient_id, card_id, message_id, sent_at)
wound_photos(id, patient_id, storage_path, blur_score, brightness, answers_json, taken_at)
assessments(id, patient_id, kind /*rass|ppi*/, inputs_json, sources_json, total, signed_by, signed_at)
consults(id, patient_id, jitsi_room, started_by, started_at, notes)
prescriptions(id, patient_id, consult_id, items_json, rmp_reg_no, pdf_path, created_at) -- NDPS rejected at API + DB check
```
**FHIR export mapping:**

| Saathi data | FHIR resource |
|---|---|
| patients | Patient |
| check-in fields | Observation (one per item) |
| dose_logs | MedicationAdministration |
| medications | MedicationRequest / MedicationStatement |
| wound_photos | Media |
| alerts | Flag + Communication |
| prescriptions | MedicationRequest |
| PPI / RASS | Observation |

Bundle them as an NRCeS OPConsultRecord or WellnessRecord.

## 5. Extraction schema (Zod sketch)
```ts
const F = <T extends z.ZodTypeAny>(t: T) =>
  z.object({ value: t.nullable(), confidence: z.number().min(0).max(1), quote: z.string().nullable() });

export const CheckinFields = z.object({
  pain_now: F(z.number().int().min(0).max(10)),
  rescue_doses_24h: F(z.number().int().min(0)),
  wakefulness: F(z.enum(['W1','W2','W3','W4','W5'])),
  breathing: F(z.enum(['normal','breathless_moving','breathless_rest','very_slow_or_pauses','noisy_rattling'])),
  resp_rate_per_min: F(z.number().int().min(0).max(80)),
  nausea_vomiting: F(z.enum(['none','nausea','vomited'])),
  vomit_count: F(z.number().int().min(0)),
  vomit_appearance: F(z.enum(['food','green_yellow','blood_or_coffee'])),
  last_stool: F(z.enum(['today','1d','2d','3plus'])),
  intake: F(z.enum(['usual','less','mouthfuls_sips','nothing'])),
  confusion: F(z.enum(['no','gradual','sudden','hallucinations'])),
  leg_swelling: F(z.enum(['no','same','more'])),
  meds_given: F(z.enum(['all','missed_some'])),
  caregiver_coping: F(z.enum(['managing','struggling','not_coping'])),
  concerns_text: F(z.string()),
  flags: z.object({ /* heavy_bleeding, seizure, back_pain_leg_weakness, bladder_bowel_loss, fever_c,
    chemo_within_weeks, med_error, self_harm_or_crisis, jerking, face_neck_swelling, blue_lips,
    swollen_belly_no_stool, wound_change{bleeding,smell,discharge,redness} — each F(...) */ }),
});
```
The extraction prompt must say:
- Extract only what the speaker said.
- Leave everything else null.
- Never infer a diagnosis.
- Quote the exact words.

## 6. Rule format (data in `packages/clinical-content/protocols/adult.v1.json`)
```json
{ "id": "A1", "tier": "AMBER", "status": "confirmed",
  "label": "≥3 rescue doses in 24h",
  "when": { "all": [ { "field": "rescue_doses_24h", "op": ">=", "value": 3 } ] } }
{ "id": "R3", "tier": "RED", "status": "confirmed",
  "when": { "any": [ { "field": "resp_rate_per_min", "op": "<=", "value": 12 },
                     { "field": "breathing", "op": "in", "value": ["very_slow_or_pauses"] } ] } }
```
- Operators: `== != < <= > >= in exists`.
- Combinators: `all` / `any` / `not`.
- Context fields: `patient.pack`, `patient.usual_pain_score`, `history.*` (for example, `wakefulness_new_since_dose_increase_72h`, `caregiver_struggling_streak`).
- The paediatric pack maps every adult AMBER rule to RED.

## 7. Escalation state machine
`open → acked → resolved`. When RED is not acked within N min, `escalation_level++` notifies the next `on_call_order`. Every transition writes to `alert_events`.

## 8. Accounts and env checklist
| Service | What to create | Env vars |
|---|---|---|
| Supabase | Project (region: Mumbai) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Meta for Developers | App → WhatsApp → test number; add up to 5 recipients; webhook verify token | `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET` |
| Telegram | @BotFather → new bot | `TELEGRAM_BOT_TOKEN` |
| Sarvam | dashboard.sarvam.ai API key | `SARVAM_API_KEY` |
| Bhashini | bhashini.gov.in/ulca → profile → API key | `BHASHINI_USER_ID`, `BHASHINI_API_KEY` |
| Groq | console.groq.com key | `GROQ_API_KEY` |
| Gemini (optional, synthetic only) | AI Studio key | `GEMINI_API_KEY` |
| Vercel | Import the GitHub repo | (same env) |
| GitHub | Private repo; Actions keep-alive cron pinging Supabase | — |
