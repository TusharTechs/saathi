# Adult protocol implementation contract

Local milestone implemented 23 October 2026. This is an unsigned **demo-only** transcription of the handoff, not a clinically validated protocol. `source_status` records what the handoff reports; `approved_by` and `approved_at` remain null. All execution outputs carry `mode: demo_only`. There is no production execution path.

## Rule-to-field matrix

`context.*` facts must come from dated patient records or event history in a future adapter, not guesses by an extractor. Reported facts carry value, confidence, verbatim quote and source message ID. The current validator checks quote presence, not whether the quote semantically supports the value.

| Rule | Tier | Required fact paths | Source status |
|---|---|---|---|
| R1 | RED | `wakefulness` | accepted_pending_review |
| R2 | RED | `wakefulness` | accepted_pending_review |
| R3 | RED | `breathing`, `breathing_new`, `resp_count_full_minute`, `resp_rate_per_min`, `wakefulness` | confirmed_in_handoff |
| R4 | RED | `blue_lips`, `breathing`, `breathlessness_sudden_severe`, `face_neck_swelling` | accepted_pending_review |
| R5 | RED | `back_pain_leg_weakness`, `bladder_bowel_loss` | accepted_pending_review |
| R6 | RED | `confusion` | accepted_pending_review |
| R7 | RED | `seizure` | accepted_pending_review |
| R8 | RED | `black_stools`, `heavy_bleeding`, `vomit_appearance` | accepted_pending_review |
| R9 | RED | `no_stool_or_wind`, `swollen_belly`, `vomit_count_24h` | accepted_pending_review |
| R10 | RED | `chemo_within_weeks`, `fever_c` | accepted_pending_review |
| R11 | RED | `pain_now`, `pain_sudden`, `rescue_not_helped` | accepted_pending_review |
| R12 | RED | `med_error` | accepted_pending_review |
| R13 | RED | `caregiver_coping`, `self_harm_or_crisis` | accepted_pending_review |
| A1 | AMBER | `rescue_doses_24h` | confirmed_in_handoff |
| A2 | AMBER | `context.usual_pain_score`, `pain_despite_medicines`, `pain_now` | accepted_pending_review |
| A3 | AMBER | `cannot_keep_medicines_down`, `vomit_count_24h` | accepted_pending_review |
| A4 | AMBER | `context.on_morphine`, `days_since_stool` | accepted_pending_review |
| A5 | AMBER | `intake`, `reduced_intake_hours` | accepted_pending_review |
| A6 | AMBER | `wakefulness`, `wakefulness_new_since_dose_increase_72h` | accepted_pending_review |
| A7 | AMBER | `jerking` | accepted_pending_review |
| A8 | AMBER | `confusion` | accepted_pending_review |
| A9 | AMBER | `context.wound_photo_available`, `wound_more_bleeding`, `wound_new_discharge`, `wound_spreading_redness`, `wound_stronger_smell` | accepted_pending_review |
| A10 | AMBER | `breathing`, `breathing_new` | accepted_pending_review |
| A11 | AMBER | `context.morphine_supply_days`, `context.on_morphine`, `missed_regular_doses` | accepted_pending_review |
| A12 | AMBER | `context.caregiver_struggling_streak` | accepted_pending_review |
| A13 | AMBER | `context.unanswered_card_attempts` | accepted_pending_review |
| A14 | AMBER | `context.days_since_checkin` | accepted_pending_review |
| A15 | AMBER | `resp_count_full_minute`, `resp_rate_per_min` | draft |

## Reconciliation decisions requiring review

- R3 includes the omitted new noisy-breathing plus drowsiness branch. The demo interprets drowsiness as W3-W5. Counted rate requires confirmation that counting lasted a full minute. The <=12 branch is recorded as confirmed in the handoff; the full executable composite is not signed.
- R9 interprets “repeated” as >=2 vomiting episodes. This is an engineering placeholder for review, not a confirmed clinical threshold.
- R4 interprets face/neck swelling with breathlessness using the existing moving/rest breathlessness choices. R5 uses the handoff's combined observable back-pain/leg-symptom flag.
- A9 follows the prose's “with photo” condition. Whether a missing photo should delay this match must be resolved clinically. No production delivery exists here.
- A15 remains present as draft data and is never executed. Paediatric input returns `unsupported_pack` without applying adult rules.
- Per-patient overrides are deliberately not accepted by this evaluator. They need an authenticated, audited authoring path before introduction.

## Completeness and precedence

Conditions use three-valued logic: true, false, unknown. Missing/null evidence is unknown; it is never coerced to zero or false. A false branch settles an AND, and a true branch settles an OR. All branches are recorded for inspection.

A positive report can match even below the demo confidence threshold (0.8), with follow-up requested. An uncertain negative cannot clear a condition. This threshold is an engineering setting, not calibrated model confidence. Any missing or low-confidence evaluated fact requests follow-up, conservatively including facts on otherwise settled branches.

Known RED/AMBER matches are retained while follow-up is pending. RED takes precedence over AMBER, with every matched ID preserved. GREEN requires no match and no outstanding evidence. `tier` and completeness `status` are separate; a RED can still have `needs_followup`.

The negative test fixture supplies explicit observations solely to exercise the engine. These are not defaults for unanswered caregiver questions. Inputs are schema-checked and source quotes must appear verbatim in the referenced message; quotes do not establish clinical truth or model correctness.

## Demonstration and limits

Run from this folder:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm demo
```

The demo uses one synthetic English text message and a **hand-authored extraction fixture**. It produces a console alert showing R2 + A1, RED precedence, protocol version, quotes and pending facts. It does not claim speech recognition, general language understanding, notification delivery or clinical validation. Emergency guidance is withheld because C-URG is draft.

Phase 1 historical status (superseded by the local workflow in docs/07): no network API keys or paid services were needed. At that point, not implemented: multilingual keyword safety net, live STT/LLM extraction, dashboard, database, authenticated approvals, channel webhooks, persistent alerts, scheduled escalation, and external delivery. In particular, the rules engine alone cannot rescue an extractor miss: the independent safety net remains a required next milestone.

Before deployment: resolve interpretations above, review extraction fields and language wording with the clinician, obtain signed protocol/card versions, add negation-aware multilingual safety-net evaluation, and implement delivery failure handling and patient-scoped access control. Finite synthetic tests do not establish clinical safety or 100% recall.
