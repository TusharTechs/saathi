# 05 · Round 1 submission (as prepared on 3 Oct 2026)

⚠️ Confirm on the portal that this was submitted, and check the result.

- **Track:** Cancer
- **Primary user:** Patient / Caregiver
- **Use case:** Patient Follow-up & Continuity of Care
- **Existing work:** No, we are building a new solution
- **Deck:** `assets/Saathi-Pitch-Deck.pdf` (8 slides). The PDF is the submitted version.

## Problem (132 words)
More than 7 million Indians need palliative care each year, yet only 1–4% can access it. Most are advanced cancer patients cared for at home by family members, often hundreds of kilometres from their treating centre. At Kasturba Medical College, Manipal, patients come from across Karnataka, and each follow-up visit costs the family a day's wages and exhausts a bedbound patient. Between visits, caregivers, many with low literacy, struggle to give oral morphine correctly, apply fentanyl patches, or recognise warning signs such as excessive sleepiness or slowed breathing. Their only channel is an unstructured phone call that interrupts busy OPD hours and gives the doctor no objective history. Urgent problems surface late, routine worries consume clinic time, and doctors have no continuous view of the patient across outpatient, inpatient and home care.

## Solution name
Saathi – Home Palliative Care Companion

## Solution (145 words)
Saathi is a WhatsApp-first companion for families caring for palliative cancer patients at home, linked to a care-team dashboard. Caregivers complete a two-minute daily check-in in Kannada, Hindi or English by tapping buttons or sending a voice note. They get a picture-based medicine chart with audio reminders, one-tap logging of regular and rescue doses, guided wound photos, and short care cards with embedded videos, such as applying a fentanyl patch or checking drowsiness.

AI only transcribes and translates voice notes into check-in fields, keeping the caregiver's exact words. It never makes clinical decisions. Messages are routed by a protocol the palliative physician writes and signs: urgent reports reach the 24/7 on-call doctor immediately, others join a same-day review list. Families receive only physician-approved guidance. Doctors see a prioritised list, a pre-call summary and one OP/IP/home timeline, with every alert traceable to the caregiver's own words.

## How we will build it (71 words)
Next.js PWA (caregiver app + doctor dashboard) on Vercel. Supabase: Postgres, Auth, Storage, Realtime, pgvector; records in India's FHIR R4 (NRCeS) profiles for future ABHA linking. WhatsApp Cloud API and Telegram Bot API. Sarvam AI and Bhashini for Kannada/Hindi speech-to-text, translation and text-to-speech. Open-weight LLM (gpt-oss via Groq) for schema-constrained extraction only, validated with Zod. Deterministic rule engine for the signed protocol. OpenCV.js photo-quality checks, Jitsi video consults, Leaflet + OpenStreetMap.

## Deck outline
1. Cover: track, team (Tushar Agarwal, tech lead; Dr. Krithika S Rao, clinical lead, KMC Manipal).
2. Problem: 7M+ / 1–4% / ~49% of centres with morphine; distance, caregivers, the doctor.
3. For families: check-in, picture medicine chart, care cards with videos, wound photos and the children's pack.
4. How a voice note becomes a doctor's call: four-step flow, RED/AMBER/GREEN.
5. For the care team: sample priority list, pre-call summary, timeline, POSS + RASS, signed PPI worksheet.
6. AI listens, the doctor decides: what the AI does and never does, traceable alerts, NDPS block.
7. ₹0 stack + five-week plan.
8. 90-day pilot metrics at KMC + clinical co-design.
