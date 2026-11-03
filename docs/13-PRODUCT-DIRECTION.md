# 13 · Product direction from the clinical lead (call, 3 Nov 2026)

Recorded from Tushar's call with Dr. Krithika S Rao. Items marked **(confirm)** are in the clinical review pack v2 (`output/Saathi-Clinical-Review-v2.pdf`, source `docs/review/clinical-review-v2.html`) for her written confirmation. Nothing here is a signed clinical approval.

## What Saathi is

An extended, out-of-hours support and continuity service for patients discharged home on palliative care. It **triages caregiver concerns into a teleconsultation call-back**; it is not a fully automated advice service. It keeps the patient connected to the treating team across hospital, home and hospice, and documents every contact for continuity and research.

Typical day at KMC: consultants work 9 am to 5 pm. After 5 pm a junior doctor (postgraduate) is on call and covers admitted patients. Home patients with sudden complications phone the on-call number with no history in hand, or do not call because they do not know what to do.

## Flow (confirm)

1. **Check in to Saathi.** At the end of an OPD visit the doctor clicks "Check in to Saathi" in the hospital information system (HIS/EMR). Saathi receives demographics, prescription, notes and the follow-up plan (for example a phone follow-up after 2 weeks and an OPD visit after 1 month). Consent is taken in OPD with a leaflet; only consenting patients are marked for Saathi. The demo uses a dummy hospital page with one synthetic case written by Dr. Rao, because real hospital data cannot leave the hospital without an MOU.
2. **Reminders on WhatsApp:** itemised morning and evening medicine reminders, refill reminders, OPD appointment reminders and phone follow-up reminders.
3. **Caregiver concern.** The family sends "Hi", chooses a language (English only for the demo) and is asked what the concern is. They type or send a voice note; AI transcribes and extracts it. Free text is preferred over menus, because drop-down lists confuse families. A web page offers the same, after signing in with a Saathi ID or a one-time code.
4. **Triage.** The deterministic protocol sets RED, AMBER or GREEN.
   - **RED:** the family immediately receives a fixed message that the condition may be critical, cannot be managed by teleconsultation and they should seek urgent care at the nearest hospital (Dr. Rao's wording, confirm). The on-call doctor is alerted at once.
   - **AMBER and GREEN:** handled the next working day. The nurse in charge or coordinator assigns a doctor, nurse or psychologist based on the identified need.
5. **Acknowledge** means accepted into the call-back list, not closed. Call-back targets (confirm): RED within 1 hour, AMBER within 6 hours (6 or 8), GREEN within 24 hours.
6. **Call and close.** The clinician calls (phone, WhatsApp call or WhatsApp video), then records call notes and the advice given, and closes the report. Clarification happens on the phone, not in the chatbot.
7. **Prescription (optional).** After a teleconsult the doctor may issue a digitally signed prescription sent on WhatsApp. Following the Telemedicine Practice Guidelines 2020, Schedule X, narcotic and psychotropic drugs and anti-cancer drugs are blocked.
8. **Approved automated replies.** Simple nursing advice may be sent automatically only when it matches a question, and only using text the clinicians have written and fed in. The model never writes advice.

## Dashboard requirements

- A clearly marked urgent list ("Needs immediate review") with date and time stamps and open/closed status. Closed reports move to "Closed today".
- **Oldest first** within each urgency, so the team clears calls in the order they arrived.
- A **date selector** to see any day's reports and how many came in.
- A **demographics header** on each report: name, age, address, phone, hospital ID and health ID (ABHA, simulated in the demo), plus call buttons.
- The **patient timeline** opens in a second browser tab as read-only text, so the report and call buttons stay visible.
- Daily **pain-score chart** and **medicine-compliance chart** (from reminder responses) instead of reading every entry.
- The call log keeps: created at, symptoms reported, acknowledged by whom and when, advice given, closed.
- Staff can enter a report on a family's behalf during a phone call.
- Voice recording is not needed on the doctor's side; uploading a file to transcribe is enough.

## Roles and logins (confirm)

1. **Medical staff** (doctor, nurse, psychologist): full medical data.
2. **Non-medical staff** (call manager, project manager): no clinical data. They see date-wise counts by urgency, acknowledged and completed, patient name, hospital ID and what was done, spot missed calls, and export a daily PDF report.
3. **Patients and families:** one-time code by mobile number **or email** (for relatives abroad without a working Indian number).

## Fees (optional per organisation)

Paid services can ask for a call-back fee when a family requests a call (audio or video), for example a full fee for the first consult and half fee for a follow-up within 15 days. NGOs and free services switch fees off. The admin sees a fee-paid checklist and follows up after emergency calls. The demo collects no payments.

## Compliance and liability

- Teleconsultation in India extends support to patients who are haemodynamically stable. Every registration and reply carries a **rider**: if the patient is very sick, go to the nearest hospital. Registration includes a service agreement; Dr. Rao will ask a lawyer friend about the wording.
- Telemedicine Practice Guidelines 2020 (NMC): no Schedule X, narcotic, psychotropic or anti-cancer prescriptions by teleconsult. When an emergency is detected, the doctor must advise immediate in-person or emergency care. Records are retained for 3 years. Platforms must follow the DPDP Act and IT rules.
- Hospital data cannot be linked without an MOU. A third-party home-care organisation registers each patient itself, from the referral letter and reports, and then documents follow-ups.

## Business model

- **Need:** India has only about 120–130 MD palliative medicine specialists (per Dr. Rao), while palliative care must continue across hospital, home and hospice. The same gap exists across lower- and middle-income countries.
- **Customers:**
  - home-based palliative care organisations and new home-care businesses, which can triage home visits and use staff time better
  - hospitals, which can install the same API alongside their HIS as a ready-made ("bana banaya") product
  - NGOs and community services, with fees switched off
- **Value:** continuity, so the team does not lose the patient after discharge; structured documentation for audit and research; fewer unnecessary visits; earlier action on emergencies.
- **Revenue:** organisations charge families per teleconsult or follow-up (hospital pricing pattern: full first fee, a cheaper follow-up within 15 days). The platform's running cost per family message is a fraction of a rupee, against consult fees of ₹500–2,000.
- Dr. Rao is herself planning a home-care service and sees Saathi as its platform.

## Demo evidence plan

One synthetic case written by Dr. Rao, checked in from a dummy hospital page, running through reminders, a caregiver concern, RED triage, on-call acknowledgement, call notes and closure. Plus the 60-case text evaluation, which Dr. Rao will review.

## Next contact

Dr. Rao travels on the evening of 5 Nov. Reviews: 5 Nov evening (link only, no laptop) or 6 Nov afternoon. She will send the dummy case, videos and her annotations on the review pack.
