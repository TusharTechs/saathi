# 02 · Clinical protocol (source of truth)

Status key:
- **✅ Confirmed:** Dr. Rao confirmed this specifically.
- **🟢 Accepted:** she said "the rest are fine". Re-confirm at final review.
- **🟡 Draft:** not yet reviewed.

Everything here becomes seed data in `packages/clinical-content`. The `status` and `approved_by` fields must reflect these labels honestly.

## 1. Daily check-in (families answer by buttons or voice)
Based on ESAS-r and IPOS. Families can also send free voice or text at any time.

| ID | Question | Answer options | Field (`fields.*`) | Status |
|---|---|---|---|---|
| K1 | How bad is the pain right now? | 0–10 (faces) | `pain_now` | 🟢 |
| K2 | Extra (rescue) doses since yesterday's check-in? | 0/1/2/3/4+ (pre-filled from "Extra dose given" taps) | `rescue_doses_24h` | 🟢 |
| K3 | How awake is he/she today? | W1–W5 (§2) | `wakefulness` | 🟢 |
| K4 | How is the breathing? | normal / breathless when moving / breathless sitting still / very slow or long pauses / noisy or rattling | `breathing` | 🟢 |
| K4b | (C12 guide) Breaths counted in one full minute | integer | `resp_rate_per_min` | ✅ used by R3 |
| K5 | Nausea or vomiting? | none / feels sick / vomited (count; looked like food, green-yellow, or blood/coffee-coloured) | `nausea_vomiting`, `vomit_count`, `vomit_appearance` | 🟢 |
| K6 | Last stool? | today / yesterday / 2 days ago / 3+ days ago | `last_stool` | 🟢 |
| K7 | Eating and drinking? | as usual / less than usual / only mouthfuls or sips / nothing | `intake` | 🟢 |
| K8 | New confusion or restlessness? | no / a little, came on slowly / yes, suddenly / seeing or hearing things | `confusion` | 🟢 |
| K9 | Feet or legs swollen? | no / same as before / more than before | `leg_swelling` | 🟢 |
| K10 | All regular medicines given today? | all / missed some (which) (pre-filled from "Given" taps) | `meds_given`, `missed_meds` | 🟢 |
| K11 | Anything else worrying you? | free voice or text | `concerns_text` | 🟢 |
| K12 | How are *you* coping? | managing / struggling / not coping | `caregiver_coping` | 🟢 |

Extra flag fields that the extraction fills from free text: `heavy_bleeding`, `seizure`, `back_pain_leg_weakness`, `bladder_bowel_loss`, `fever_c`, `chemo_within_weeks`, `med_error`, `self_harm_or_crisis`, `jerking`, `face_neck_swelling`, `blue_lips`, `swollen_belly_no_stool`, `wound_change{bleeding,smell,discharge,redness}`.

## 2. Wakefulness scale for families (POSS-based)
The doctor sees **both** the family's POSS-based level and the doctor's own **RASS** entry ✅.

| ID | Family wording | POSS | Approx. RASS (doctor confirms) | Tier |
|---|---|---|---|---|
| W1 | Awake and talking normally | 1 | 0 | GREEN |
| W2 | Sleeping, wakes easily when called | S | 0 to −1 | GREEN |
| W3 | A little drowsy, wakes easily and stays awake | 2 | −1 | GREEN (AMBER if new after a dose increase, A6) |
| W4 | Keeps falling asleep while talking or eating | 3 | −2 to −3 | **RED** (R2) |
| W5 | Very hard to wake, or cannot be woken | 4 | −4 to −5 | **RED** + "call 108" message (R1) |

## 3. Escalation rules: adult pack
Response: **24/7 on-call doctor; families can call any time** ✅. Still needed: the RED call-back target in minutes, the AMBER review window in hours, and the on-call chain order. Until confirmed, use these as configurable defaults: RED call-back 15 min, then escalate to the next on-call; AMBER same working day.

### RED: call back now
| ID | Condition | Rationale | Status |
|---|---|---|---|
| R1 | Wakefulness W5 | POSS 4, possible opioid toxicity | 🟢 |
| R2 | Wakefulness W4 | POSS 3, "unacceptable" level | 🟢 |
| R3 | **Respiratory rate ≤12/min** (counted for one full minute per C12), or very slow breathing with long pauses, or new noisy breathing with drowsiness | Opioid-induced respiratory depression | ✅ (≤12) |
| R4 | Sudden severe breathlessness at rest, blue lips, or face/neck swelling with breathlessness | Respiratory distress; SVC obstruction | 🟢 |
| R5 | New back pain with leg weakness or numbness, or new loss of bladder/bowel control | Possible metastatic spinal cord compression | 🟢 |
| R6 | Sudden new confusion or agitation, or hallucinations | Acute delirium or opioid neurotoxicity | 🟢 |
| R7 | Seizure | Oncological emergency | 🟢 |
| R8 | Heavy bleeding; vomiting blood or coffee-ground material; black stools | Haemorrhage | 🟢 |
| R9 | Repeated vomiting + swollen belly + no stool or wind | Possible bowel obstruction | 🟢 |
| R10 | Fever ≥38°C with chemotherapy in the last 6 weeks | Possible neutropenic sepsis | 🟢 |
| R11 | Sudden pain ≥8/10 not helped by the rescue dose | Pain crisis | 🟢 |
| R12 | Extra or double dose given by mistake, or a child swallowed medicine | Medication error | 🟢 |
| R13 | Mention of wanting to die, self-harm, or "cannot cope at all" | Psychological crisis; needs a human | 🟢 |

### AMBER: doctor review today
| ID | Condition | Status |
|---|---|---|
| A1 | **≥3 rescue doses in 24 h (same for new morphine starters)** | ✅ |
| A2 | Pain ≥7 despite medicines, or ≥3 points above the patient's usual score | 🟢 |
| A3 | Vomited ≥3 times in 24 h, or cannot keep medicines down | 🟢 |
| A4 | No stool ≥3 days while on morphine | 🟢 |
| A5 | Only sips or nothing for ≥24 h | 🟢 |
| A6 | W3 that is new within 72 h of a dose increase | 🟢 |
| A7 | New jerking or twitching of the limbs (myoclonus) | 🟢 |
| A8 | Confusion that came on slowly | 🟢 |
| A9 | Wound: more bleeding, stronger smell, new discharge or spreading redness (with photo) | 🟢 |
| A10 | New breathlessness at rest | 🟢 |
| A11 | Regular medicines missed ≥2 times, or morphine runs out within 5 days | 🟢 |
| A12 | Caregiver "struggling" on 2 check-ins in a row | 🟢 |
| A13 | A question the approved cards did not answer after 2 tries | 🟢 (her "1–2 prompts" idea) |
| A14 | No check-in for 2 days in a row | 🟢 |
| A15 | **Respiratory rate 13–15/min** | 🟡 proposed, ask Dr. Rao |

### GREEN
Matches no RED or AMBER rule. The check-in is logged, the matching approved care card is sent, and the family gets "Your care team can see today's update."

**Precedence:** RED > AMBER > GREEN. Report every matched rule, not just the highest.

## 4. Engine behaviour that matters clinically
- **Red flags skip the chatbot.** A RED sends C-URG immediately and pages the on-call doctor.
- **Keyword safety net:** an EN/HI/KN keyword and phrase list for the RED concepts runs in parallel. Any hit with no structured match → RED, with reason `safety_net:<term>`. Better to over-call than to miss.
- **Low-confidence extraction** on a RED-relevant field → ask a button follow-up. Do not silently downgrade.
- **Per-patient threshold overrides** are allowed (for example, a different A1 limit for one patient), but only by a doctor, and they are audited.

## 5. Escalation chain
| Tier | Action |
|---|---|
| RED | Dashboard (realtime + sound) and a WhatsApp/Telegram alert to on-call #1. Not acknowledged within N min → on-call #2 → coordinator. Family gets C-URG with the on-call number |
| AMBER | Added to today's review list. Not reviewed by the end of the working day → shown in the next morning's handover |

## 6. Paediatric cancer pack
- **Tiers: GREEN and RED only ✅.** Any condition that is AMBER in the adult pack is **RED** for children.
- **Breathing thresholds must be age-specific.** 🟡 Ask Dr. Rao; do not reuse the adult ≤12.
- **Behavioural pain signs for parents** (🟡 draft, adapted from FLACC-style observation; FLACC itself is a clinician tool):
  - crying or whimpering that won't settle
  - grimacing, frowning or a clenched jaw
  - guarding a body part, or not wanting to be touched or moved
  - restless, rigid or curled up
  - unusually quiet or withdrawn, or stops playing
  - changes in sleep or feeding
  - irritability
- Any sign present, or any parental worry → RED.

## 7. Care cards
Rules for all cards:
- Short, plain, read aloud in the family's language.
- Each card has `status` (draft/approved), `approved_by`, `approved_at`, `language`, `video_url[]`.
- Videos open in a pop-up and return to the same card ✅.

| Group | Cards |
|---|---|
| Pain & medicines | C1 Using the medicine chart · **C2 Giving opioid medicines (morphine + fentanyl patch)** ✅ scope · C3 What a rescue dose is · C4 Storing morphine safely · C5 Missed or vomited dose |
| Bowels & stomach | C6 Constipation on morphine · C7 Nausea and vomiting · C8 Mouth care · C9 Small meals, poor appetite |
| Breathing | C10 Easing breathlessness (sit up, fan, fresh air) · C11 Breathlessness and panic · **C12 Counting breaths and checking drowsiness (MAIN card, drop-downs)** ✅ |
| Skin & wounds | C13 Turning and pressure care · C14 Wound dressing basics · C15 Wound smell · C16 Taking a good wound photo |
| Mind & family | C17 Confusion at home · C18 Sleep · C19 Caregiver self-care · C20 Talking with children |
| Last days | C21 Signs of the last days · C22 Comfort care · C23 Who to call, and what happens after death |
| Practical | C24 What to bring to a hospital visit · C25 Papers to collect morphine · C26 Using Saathi |
| Packs | C27 Children's pack ✅ in scope · C28 Neurological ⏸ later · C29 Renal ⏸ later · C30 open |

### Drafted card texts (🟡 all need Dr. Rao's approval)
**C-URG (sent with every RED):**
1. Your care team has been alerted. A doctor will call you within [N] minutes. You can also call the on-call doctor now: [on-call number].
2. Do not give another extra dose of pain medicine until the doctor speaks to you.
3. Stay with the patient. If they are lying down, turn them gently onto their side.
4. If breathing becomes very slow or stops, or you cannot wake them, call **108** now.
5. Keep the medicine box and this phone with you.

**C2 · Giving opioid medicines:**
- *About morphine:* morphine is a strong pain medicine. Used as prescribed, it is safe and controls pain. Common effects are constipation (always give the laxative) and some sleepiness in the first days.
- *Liquid morphine:*
  1. Use only the oral syringe from the hospital, never a kitchen spoon.
  2. Draw up exactly the amount on the chart.
  3. Give it slowly into the side of the mouth, with the patient sitting up.
  4. Tap "Given".
  5. Give a rescue dose only for breakthrough pain, as the chart says, and tap "Extra dose given".
  6. If the patient is very sleepy, do not give it. Tell the team.
- *Fentanyl patch:*
  1. Apply it to clean, dry, non-hairy, unbroken skin on the upper arm, chest or upper back. Clip hair; don't shave.
  2. Don't cut the patch.
  3. Press it firmly with your palm for 30 seconds.
  4. Write the date and time on the patch or the chart.
  5. Change it on the schedule on the chart (usually every 3 days), using a new spot each time.
  6. Keep heat away (hot-water bottle, heating pad, hot bath, sunbathing). Heat makes more medicine enter the body.
  7. Fold a used patch in half, sticky sides together, and store or return it as the team tells you. Keep it away from children.
  8. If a patch falls off, apply a new one and tell the team.
  9. If the patient becomes very sleepy or breathes slowly, remove the patch and call the doctor.
- Videos: see §9 (patch video options are English only, so consider recording one at KMC).

**C6 · Constipation while taking morphine:**
1. Morphine almost always causes constipation.
2. Give the laxative every day, even if the patient has passed stool.
3. Offer fluids often.
4. Gentle movement helps.
5. Tell the team if there is no stool for 3 days, or if there is belly pain or vomiting.

**C12 · Counting breaths and checking drowsiness (main card):**
- *Counting breaths:* wait until the patient is resting quietly. Watch or feel the chest or tummy rise. Count each rise for **one full minute** by the phone timer, then pick the number in the app.
  - **12 or fewer → RED:** the app alerts the doctor, and you call the on-call number.
  - 13–15 → the team reviews today (🟡 pending confirmation).
- *Checking drowsiness:* call their name and talk to them. Then pick the drop-down level that fits best (W1–W5). If they keep falling asleep while talking or eating, or are hard to wake, the app alerts the doctor immediately.

## 8. Other clinical components
- **PPI worksheet (✅ keep; doctor completes and signs at regular visits; no automatic alerts):**
  - PPS 10–20 = 4, 30–50 = 2.5, ≥60 = 0 (doctor enters).
  - Oral intake: mouthfuls or less = 2.5, moderately reduced = 1, normal = 0 (from K7, doctor confirms).
  - Oedema = 1 (K9). Dyspnoea at rest = 3.5 (K4). Delirium = 4 (doctor decides; K8 shown as background).
  - Published cut-offs (Morita 1999: >6 → under 3 weeks; >4 → under 6 weeks) appear only as reference text.
- **PaP:** ❌ removed.
- **Wound photos:**
  - Guided capture: 2 photos (close and wide), daylight, a scale sticker, same time of day.
  - On-device blur and brightness check only, then a side-by-side timeline for the doctor.
  - Four family questions: more bleeding? stronger smell? new discharge? more pain at dressing change? The AI never comments on the wound.
- **E-prescription:**
  - Doctor's registration number + e-signature, as a PDF.
  - **NDPS drugs hard-blocked** (TPG 2020 Prohibited List).
  - Morphine refills are handled at the registered hospital (KMC, an RMI).
- **Map:**
  - v1 shows each patient's registered centre (KMC Manipal), covering Udupi district and Karnataka.
  - Data model ready for more RMIs with a weekly one-tap stock confirmation.

## 9. Videos for care cards
Embed with `https://www.youtube.com/embed/<ID>`. All IDs passed a YouTube oEmbed check as public and embeddable (Oct 2026). They have **not been watched or clinically checked**: Dr. Rao must approve each one. For a real pilot, ask Karunashraya and NHSRC for permission and credit them.

| Card | Video ID · source · language · length |
|---|---|
| C2 fentanyl patch | `aPN7DmI_bqY` Singapore General Hospital, EN, 2:57 · `qerJ6B0kJ3I` Alexandra Hospital SG, EN, 2:10 |
| C2 liquid morphine | `2TilV4mXTtw` Cipla Palliative Care, likely HI, 5:49 · `d470Uy_L7eY` Tan Tock Seng Hospital, EN, 2:12 |
| C12 counting breaths | `01hB9RoSphc` EN 2:38 · `IDFaPKFbIO8` EN 5:33 (generic nursing clips) |
| C12 drowsiness / opioid effects | `dxad9YP2ULY` Agrace hospice, EN, 5:54 · `_DGgPDYq9J4` AIIMS Jodhpur, likely HI, 7:55 |
| C8 mouth care | `5AMHGncd_Tc` Karunashraya, **KN**, 5:46 · `vVoG0WFtNTg` NHSRC, **HI**, 3:03 · EN versions `b5shy1jTfgc`, `gZVUBQVoyrI` |
| C13 pressure care | `dGknKlhbH9I` Karunashraya, **KN**, 12:49 · `o-GSFo6XBVM` NHSRC, **HI**, 4:29 · EN versions `YZ2wSGkMn-4`, `55aJnhJRwT0` |
| C10 breathlessness | `TvPMJDoe1gQ` Karunashraya, **KN**, 6:50 · `RY4WajFX6bM` handheld fan, EN, 1:59 · `SxnX38Nk-FA` positioning, EN, 1:13 · EN `l5_ciOFDrLM` |
| C6 constipation | `7sd1qQlyIuM` Dr Rajasekhar M R, EN, 0:58 · `JMwTLCIj-yM` EN, 5:19 |
| C14/C15 wounds | `j48q5jD4l6c` Karunashraya, **KN**, 5:37 · `FlYNgZCXawI` Sri Shankara Cancer Hospital, **HI**, 6:20 · `BvcXO6s_gbs` Aster CMI, EN, 2:44 |
| C21/C22 last days | `hBTbTrCLSrQ` Karunashraya, **KN**, 13:04 · `slNShkHNNpw` Marie Curie, EN, 9:19 · `67TLxQn4Fw4` breathing changes, EN, 2:39 · EN `TK9gt9dDlrs` |
| C19 caregiver self-care | `r6xga0OY-NQ` Karunashraya, **KN**, 5:28 · `cN9ZZb2gv3A` CanSupport, EN, 37:51 · EN `8a9DcvdBmFk` |
| C27 children's pain | `FyzLRaVNpiQ` Indian Childhood Cancer Initiative, EN, 2:05 |

**Gaps:** no Hindi or Kannada fentanyl-patch video, no family-oriented sedation video, and no Indian-language constipation video. Recording 2-minute Kannada videos at KMC would fill these.

Website resources:
- Karunashraya YouTube: https://www.youtube.com/@karunashrayabht5415
- NHSRC palliative training: https://nhsrcindia.org/elderly-palliative-care-cho-sn-end-life-care
- IAPC caregivers page: https://www.palliativecare.in/caregivers/2/

## 10. Sources
- Morita 1999 (PPI).
- Pasero (POSS).
- Sessler 2002 (RASS).
- Watanabe 2011 (ESAS-r).
- IPOS (pos-pal.org; Hindi version validated, PMC10021115).
- Telemedicine Practice Guidelines 2020, Appendix 5.
- NDPS Amendment Act 2014 and NDPS Rules 2015.
- Pallium India, *Guidelines for stocking and dispensing ENDs*.
- Lancet Commission on Global Access to Palliative Care.
