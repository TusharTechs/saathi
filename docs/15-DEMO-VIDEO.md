# 14 · Demo video script (5 minutes) · 7 Nov 2026

Audience: two doctors and one technical judge. Dr. Rao's advice: spend the most time on **how triage filters calls**, then show the build, then the business model.

## Before recording (15 min)

1. Sign in with the judge login on the deployed site, browser at 1440×900, zoom 100 %. Close other tabs and notifications.
2. Clean the queue: close the old 23 Oct test reports so only today's examples show.
3. Have your 3 Nov WhatsApp screenshots ready: pairing, check-in buttons, RED reply and the on-call alert with Acknowledge. Label them "Meta test number, 3 Nov" on screen.
4. Keep these synthetic messages ready to paste in the family chat:
   - RED: *"My father is very hard to wake up and his breathing has become very slow with long pauses."*
   - AMBER: *"His pain is 7 out of 10 even after his medicines."*
   - The 2 am example: *"He has some itching on his arms tonight."*

## Script

| Time | Screen | Say (short) |
|---|---|---|
| 0:00–1:00 | Title, then Dr. Rao (on camera or voice) | India has about 120–130 MD palliative-medicine specialists for millions who need care. After discharge, families phone one duty number at any hour: a 2 am call about itching, the next one a patient who cannot be woken. The calls carry no history, are not documented, and patients get lost between visits. |
| 1:00–1:15 | Login page | Saathi is a care continuity service: one line for families, one queue for the care team, and a record of every contact. **AI listens. The doctor decides.** |
| 1:15–1:35 | Demo hospital EMR → **Check in to Saathi** | At the end of the OPD visit the doctor checks Arjun Mehta in. Saathi receives his prescription and follow-up plan, and reminders start. |
| 1:35–2:05 | WhatsApp screenshots (3 Nov), then the family chat on a phone-sized window | Families use WhatsApp: medicine reminders with Given / Not given, and they describe a worry in their own words or a voice note. (Meta paused our test app's API on 3 Nov, so live judging uses the family web chat, which runs the same engine and sends the same replies.) Type **Hi**, then the RED message: the reply is our clinical lead's approved text and the emergency card. |
| 2:05–2:45 | Doctor queue: RED banner, **Needs immediate review**, the family's words → rule trace | **This is the triage.** The model only extracts facts and quotes the family's words; the rule our clinical lead approved makes it RED. RED goes to the on-call doctor at any hour, with a call-back within 30 minutes. |
| 2:45–3:05 | Send the AMBER and itching messages; show the call-back list and its timers | AMBER and GREEN are scheduled only in duty hours. The 2 am itching question waits for the morning instead of waking the duty doctor. |
| 3:05–3:35 | Acknowledge → Phone call → call notes, "answered by", Close. Then **Save a prescription change** | Acknowledge means "in the call-back list". After the call the doctor records the notes and closes it. A dose change is saved for in-person issue at the OPD; anti-cancer drugs are refused. Nurses and psychologists cannot change prescriptions. |
| 3:35–3:55 | Full record (pain and compliance charts), Search patient, Close follow-up | One record across calls. When a patient dies or moves to another team, the doctor closes follow-up and reminders stop. |
| 3:55–4:10 | Call manager report → Export PDF | The call manager sees counts, status, contacts and fees, with no clinical details, and exports the day's report. |
| 4:10–4:30 | Tour's safety step or a slide | Safety: deterministic rules approved by our clinical lead; a keyword safety net beside the model; live evaluation numbers. Telemedicine Practice Guidelines 2020, DPDP consent, and FHIR R4 export for ABDM-registered hospitals. |
| 4:30–4:55 | Business slide | Home-care organisations triage visits; hospitals add it beside their information system; NGOs switch fees off; oncology teams can use it for chemotherapy patients at home. Revenue: per-teleconsult fees set by each organisation (duty doctor or specialist), with follow-up pricing. Running cost is about ₹4–15 per family per month. |
| 4:55–5:00 | Logo | Saathi. AI listens. The doctor decides. |

## Honesty checklist (say or show)
- All patients are synthetic; nothing is used with real patients.
- The protocol and wording are approved by our clinical lead **for the demo**; institutional and legal review are still needed.
- The WhatsApp screenshots are from 3 Nov; the live line is paused by Meta, and the family web chat uses the same engine.
- The evaluation labels are engineering drafts until Dr. Rao reviews them.
