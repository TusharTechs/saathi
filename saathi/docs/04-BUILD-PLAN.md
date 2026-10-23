> 23 Oct update: the public programme guide now lists final submission on **7 Nov 2026**, rather than 8 Nov below. Treat the schedule below as historical; aim to finish implementation by 4 Nov and reserve 5-7 Nov for evaluation, recording and submission. Logged-in portal confirmation remains pending. The first local engine milestone is implemented; see docs/06. Live integrations are still outstanding.

# 04 · Build plan (compressed: 22 Oct → 8 Nov)

The original plan assumed five weeks from 5 Oct. As of 22 Oct **no code exists**, so this plan covers about 17 days. ⚠️ First confirm the final-submission date and the Round 1 result on the portal.

## 1. Priorities
| Priority | Scope |
|---|---|
| **MUST: the core flow** | Telegram + WhatsApp intake (buttons + voice) → STT → extraction → safety net → rules engine → alerts → realtime dashboard queue → C-URG to the family → escalation timer. Synthetic seed data. Audit trail. Eval run |
| **SHOULD** | Medicine chart + one-tap dose logging + reminders · approved care cards with video pop-ups (C2, C6, C12 first) · patient timeline + pre-call summary · POSS + RASS display · children's pack (GREEN/RED) |
| **COULD** | Jitsi consult + NDPS-blocked e-prescription · PPI worksheet · wound photo capture + timeline · map (KMC / Udupi) · protocol editor UI · FHIR export + simulated ABHA |
| **WON'T** | AI wound interpretation, generated advice, IVR/SMS, neurological/renal packs |

## 2. Day plan
| Days | Dates | Deliverable |
|---|---|---|
| 1–2 | 22–23 Oct | Accounts and keys (docs/03 §8). Monorepo scaffold. Supabase schema + RLS + seed (5 synthetic patients, 3 care-team members, meds). `clinical-content` JSON from docs/02. `rules-engine` with unit tests for every R/A rule |
| 3–5 | 24–26 Oct | Telegram webhook first (fastest), then WhatsApp. Button check-in flow (K1–K12). Alerts table. Realtime dashboard queue (RED/AMBER/GREEN). C-URG reply. Escalation tick (pg_cron) |
| 6–8 | 27–29 Oct | Voice: Sarvam STT → Groq extraction (Zod) → keyword safety net (EN/HI/KN) → rules. Low-confidence follow-up buttons. Audit trail view |
| 9–11 | 30 Oct–1 Nov | Medicine chart + dose logging + reminders. Care cards + video pop-ups. Timeline + pre-call summary. Children's pack. **Send Dr. Rao the review link + the batched questions (docs/01 §8)** |
| 12–14 | 2–4 Nov | COULD items in order: Jitsi + e-prescription (NDPS block) → PPI worksheet → wound photos → map → FHIR export. Apply Dr. Rao's edits (config only) |
| 15–17 | 5–8 Nov | Build the eval set + run it. Polish and mobile check. Demo video (3–5 min). README + docs. Update the deck. **Submit** |

**Cut-line:** if the MUST list is not done by 29 Oct, drop all COULD items except Jitsi.

## 3. Eval plan (key differentiator)
- **Data:** about 200 synthetic caregiver messages, roughly 70 each in EN, HI and KN, plus code-mixed ones.
  - Each message is labelled with the expected fields and tier.
  - Over-sample RED (≥60), including tricky phrasings and negations ("he is NOT hard to wake").
- **Voice:** record or synthesise (Sarvam TTS) about 30 of them as audio to test STT end to end.
- **Metrics:**
  - RED recall (target 100% with the safety net); precision.
  - Tier confusion matrix.
  - Per-field accuracy per language.
  - Median processing latency.
- **Validation:** Dr. Rao spot-checks about 50 labels. Only then call them "clinician-validated".

## 4. Definition of done (8 Nov submission)
- Deployed URL (Vercel) + a working Telegram bot (+ WhatsApp on the test number).
- Private GitHub repo shared as required.
- Demo video. Eval report. Updated deck. Docs.
- All family-facing content marked approved or draft, honestly.

## 5. Finale demo script (live, about 3 min)
1. A caregiver sends a Hindi voice note: *"Papa bahut neend mein hain, baat karte karte so jaate hain, aaj 4 baar extra dawai di."* ("Papa is very sleepy, he falls asleep while talking, I gave the extra medicine 4 times today.")
2. Within about 10 s the dashboard flashes **RED**, showing the trace: quote → `wakefulness=W4` → R2, and `rescue_doses_24h=4` → A1.
3. The phone receives C-URG as Hindi audio.
4. The doctor taps call-back, and a Jitsi room opens.
5. The doctor opens the timeline: rescue doses rising over 3 days.
6. The doctor attempts an e-prescription with morphine. It is blocked by the NDPS guardrail, with refill routing to KMC.
7. Close on the eval slide: RED recall and the confusion matrix.

Keep a recorded fallback video in case the venue network fails.

## 6. 90-day pilot metrics (for the pitch)
- Unplanned calls during OPD hours.
- Minutes from a red flag to the doctor's acknowledgement.
- Long trips avoided (km and ₹).
- Doses logged (regular and rescue).
- Correct fentanyl patch application after the video.
- Caregiver usability score (SUS).
