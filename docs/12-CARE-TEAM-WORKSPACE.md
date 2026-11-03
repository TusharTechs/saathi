# Care-team completion milestone · 24 October 2026

## Daily check-in

The web form and shared Telegram/WhatsApp conversation now cover all K1–K12 topics: pain, rescue doses, wakefulness, breathing and a full-minute count, nausea/vomiting with count/appearance, last stool, intake, confusion, swelling, missed medicine doses, concerns and caregiver coping. There are 16 questions because some topics have details. All questions can be skipped; /submit saves partial chat drafts. A RED observation submits immediately instead of waiting for the rest of the questions. Button wording remains English. Free-form text/voice supports the previously configured languages.

A single question catalogue defines web and chat choices, ranges and parsing. The first six chat indexes are unchanged for existing drafts; new questions are appended. Nausea and leg swelling are preserved as observations but do not introduce new escalation thresholds. No medication status or morphine context is guessed. No unused answers become negative defaults. Exact reported days since stool are required; “3+” is not represented as exactly three. Each structured observation points to its saved source wording. Contradictory selections are preserved for human review rather than reconciled automatically. Completing this daily questionnaire does not establish that every possible red flag was assessed; engine follow-up facts can remain unknown.

## Timeline and pre-call summary

Patient timeline displays all saved reports for the selected patient, across web, Telegram and WhatsApp origins, with date/time in IST, status, matched rules, original sources and audit history. The table shows each report's pain and rescue observations with missing values left blank. It does not sum overlapping 24-hour rescue counts or infer a continuous trend.

The copyable summary is deterministic and source-linked. It includes the latest report's observations/confidences and quotes, missing facts, extraction state and earlier unresolved RED reports. Older observations are not silently carried forward into the latest report. This is a record digest, not an LLM-generated clinical assessment. It does not fabricate medicine charts or OP/IP encounters. All data remains synthetic; the operator identity is simulated.

## Automatic demo escalation

`pnpm escalation:check` reads existing open RED reports without modifying them. `pnpm escalation:run` starts a single-host worker that calls the existing transactional tick every 30 seconds. Stop with Ctrl-C. The tick retains the existing 15-minute demo interval, doctor 1 → doctor 2 → coordinator chain, revision checks and audit events. Acknowledged/resolved reports stop escalating. A delayed worker advances one step per actual interval rather than replaying a burst of overdue steps. No email, Telegram, WhatsApp or clinician notification is sent by this worker. It stops when the computer/process stops; it is not an always-on clinical service.

The worker uses configured Supabase storage or explicit local-file mode and a private `.saathi-demo/escalation.worker.lock`. Stop the worker and verify its recorded PID is no longer alive before recovering a stale lock. Failures produce sanitized logs and wait for the next normal tick; ambiguous writes are safe because the database rechecks the deadline under its transaction lock. The UI shows each RED report's demo escalation state. Automatic execution requires the worker to be running.

## Verification

Automated checks cover later-question RED matches, exact source evidence, skipped fields, all chat steps including two-digit indexes, immediate RED submission, cross-patient summary isolation, preservation of earlier unresolved reports, chronology, stale-value exclusion, automatic tick serialization and failure recovery. Existing SQL, WhatsApp, Telegram and extraction regressions remain required.

Browser verification against hosted Supabase saved a synthetic sudden-confusion / two-missed-dose report with R6 + A11 / RED, retained both exact source quotes and displayed it on the queue. Timeline was inspected with prior Telegram reports. See `output/saathi-patient-timeline.png`.

## Still gated or outside this milestone

- WhatsApp credentials and live signed receiver deployment; partner access expected next.
- Clinical sign-off for protocol interpretations, care-card texts/videos, children's thresholds and family guidance. No clinical approval has been invented.
- Authenticated/public care-team deployment, real patient onboarding, always-on notifications and clinical response commitments.
- Medicine-chart prescriptions/reminder schedules need clinician-supplied instructions; patient photos, teleconsultation, FHIR/ABHA and paediatric evaluation remain optional deferred scope.
- Submission assets and clinician-labelled multilingual/voice evaluation remain separately tracked; synthetic engineering checks are not clinical validation.

## Clinical review desk and evaluation

**Clinical review** gives the partner a local review screen with the rule register, outstanding interpretation questions and collapsed C-URG/C2/C6/C12 drafts copied verbatim from the handoff. Every draft is marked unapproved and not for caregiver use. There is no fake approval button. Historical promises in the copied C-URG/C12 draft do not describe actual app capabilities; they require correction before approval. Videos are not embedded or labelled approved.

`pnpm eval:text` runs the no-extraction keyword baseline over 60 authored examples (20 each EN/HI/KN). `pnpm eval:live` calls the existing Groq extractor and deterministic rules for those invented texts only. It makes no database writes or channel sends. Output is in `output/evaluation/`, with corpus checksum, per-language scores, confusion matrices, individual mismatches, and provider failures. The expected labels/translations are engineering-authored and not clinician validated. Labelled-field accuracy does not score hallucinated extra fields or calibrated confidence; speech recognition is not included.

The first baseline found 10/30 expected RED cases; this illustrates why keywords alone are insufficient. Four of 15 expected PENDING cases were conservatively marked RED, including negated/historical phrases. The live evaluation completed one English case, then Groq returned a quota/rate-limit error; one request failed and 58 were explicitly marked NOT_RUN. No automatic retry was performed. The live report is prominently marked INCOMPLETE and cannot establish model recall or precision. The ~200-example and ~30-clip clinician-reviewed evaluation target remains outstanding.

The automatic worker was exercised against hosted synthetic reports: its first tick advanced six overdue reports and the following tick changed zero. It was then stopped. No external notification was sent. Existing acknowledgement/resolution behavior remains unchanged.
