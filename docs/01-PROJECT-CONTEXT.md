# 01 · Project context and where we stand

_Last updated: 3 Nov 2026._ _Earlier: 23 Oct 2026. Original handoff retained below; implementation updates are explicitly dated._

## 1. One-paragraph summary
Families of advanced cancer patients at KMC Manipal travel from across Karnataka. Between visits, their only channel is an unstructured phone call that interrupts OPD and gives the doctor no objective history. Low-literacy caregivers struggle with oral morphine, fentanyl patches and spotting oversedation.

**Saathi** works like this:
- Families do a two-minute daily check-in on WhatsApp in Kannada, Hindi or English, by tapping buttons or sending a voice note.
- They get a picture medicine chart with one-tap dose logging, and care cards with embedded videos.
- An LLM only turns voice into structured check-in fields.
- A deterministic protocol, written and signed by the palliative physician, routes each check-in:
  - **RED:** goes to the 24/7 on-call doctor immediately.
  - **AMBER:** joins a same-day review list.
  - **GREEN:** is logged, and the family gets an approved care card.
- Doctors get a prioritised list, a pre-call summary and one OP/IP/home timeline.
- Every alert is traceable from the caregiver's words to the rule to the human response.

**Pitch line:** *"AI listens. The doctor decides."*

## 2. Status snapshot (22 Oct 2026)
| Area | Status |
|---|---|
| Research (hackathon rules, free stack, clinical scales, Indian regulation) | ✅ Done |
| Product concept and scope reframing (assistive only) | ✅ Done |
| Clinical review pack sent to Dr. Rao | ✅ Done. She liked it and answered all 12 questions (see §6) |
| Round 1 submission texts + 8-slide pitch deck | ✅ Prepared (`docs/05`, `assets/Saathi-Pitch-Deck.pdf`). ⚠️ **Confirm on the portal that it was submitted, and whether we are shortlisted** |
| Caregiver video research | ✅ Done (list in docs/02 §9) |
| ABDM sandbox | ❌ Individual application rejected (needs an official organisational email). KMC cannot share access yet. **Decision: FHIR R4 records plus a clearly labelled simulated ABHA link** |
| Accounts and API keys (WhatsApp, Sarvam, Bhashini, Groq, Gemini, Supabase, Vercel) | ⬜ Not created yet. Checklist in docs/03 §8 |
| Code | 23 Oct: rules engine plus local Next.js intake/dashboard, persistent synthetic reports, draft keyword safety net, audit/state workflow and tested Supabase core migration. 83 tests pass. Live services remain unconnected. See docs/06 and docs/07 |

## 3. Hackathon facts
- **Event:** Health-a-thon 2026, India's first doctor × technologist health hackathon.
  - Site: https://healthathon.reskilll.com · Contact: healthathon@reskilll.com
  - Organisers: IIT Bombay Koita Centre for Digital Health (KCDH), Koita Foundation, National Cancer Grid (also RSSDI and FOGSI).
  - Prizes: ₹54 lakh+.
- **Team rule:** 2–5 members, with at least one practising doctor and at least one technologist. Our team is Tushar and Dr. Rao. Add any other members here.
- **Timeline** (published plan; ⚠️ verify on the portal, because Round 1 closed around 4 Oct, later than first announced):
  - Build sprint: 5 Oct – 8 Nov.
  - **Final submission (functional MVP + documentation): 8 Nov.**
  - Finalists announced: 21 Nov.
  - **Grand finale, in person at IIT Bombay: 28 Nov.** Dr. Rao confirmed she can attend.
- **Judging criteria** (no weights published): Innovation, Human-Centered Design, Workflow Impact, Feasibility, Measurable Outcomes. Outcomes must be measurable within 60–90 days.
- **Out of scope:** diagnosis, treatment recommendations, clinical decision support, clinical risk scoring, interpretation of medical data, autonomous clinical advice.
- **Tech guidance:** recommended, not mandated. Open source is encouraged, and ABDM/ABHA integration is encouraged but not required.

## 4. The product: what makes it stand out
1. **Doctor-written protocol ("Protocol Studio").** Escalation rules are versioned, signed data. The LLM is only a translator. Every alert shows its trace, for example: `voice note → "falls asleep while talking" → wakefulness=W4 (conf 0.91) → Rule R2 v3 → RED → acked by Dr X in 2m14s`.
2. **On-stage safety evaluation.**
   - About 200 synthetic caregiver messages in English, Hindi and Kannada, labelled against the protocol.
   - Show red-flag recall (target ≈100% with the keyword safety net), the confusion matrix, and per-field extraction accuracy.
3. **Morphine access built in.** India has no national RMI map, and only about 49% of 911 listed palliative centres had morphine (Pallium India).
   - v1 maps each patient to their registered hospital (KMC is an RMI) and covers Udupi district.
   - Other RMIs come later.
4. **Low-literacy first.** Voice in, voice out, a picture medicine chart, one-tap logging, and video care cards.

**Pitch numbers:**
- About 7 million Indians need palliative care each year, and only 1–4% can access it (Lancet Commission).
- India's opioid use is 221 S-DDD per million inhabitants per day, against an Asia-Pacific average of about 558.

## 5. People and working agreement
- **Tushar:** builds end to end on a ₹0 budget.
- **Dr. Rao:** said she prefers to review once the project is done.
  - Batch questions to her into one message.
  - Final review of the built app around 1–3 Nov.
  - She will attend the finale.
  - She asked how the team is formed and who is on it, so answer her.
- **Never** label content as approved by Dr. Rao unless she approved it.

## 6. Dr. Rao's confirmed answers (call around 3 Oct, follow-up around 6 Oct)
| # | Topic | Her answer |
|---|---|---|
| Q1 | Languages | English, Hindi, Kannada |
| Q2 | Response | Someone is on call at all times, and patients can call the on-call person at any time |
| Q3 | Rescue doses | ≥3 rescue doses in 24 h → AMBER is right. **Same threshold for patients just starting morphine** |
| Q4 | Breathing | **≤12 breaths/min → RED, report to hospital.** She described 12–15/min as the concern band (see open item 1) |
| Q5 | Red flags | The ones covered are good, mainly for cancer. Add others to the right category as needed |
| Q6 | Care cards | **C12 (counting breaths, checking sedation, with drop-downs) is the main card.** Remove nothing |
| Q7 | Sedation | The doctor should see **both RASS and POSS** |
| Q8 | PPI / PaP | **Keep the PPI worksheet**, signed by the doctor and updated at regular visits. **Remove PaP** |
| Q9 | Morphine refills | KMC is an RMI. Families refill there. **The app maps patients to their registered hospital.** Other RMIs come later |
| Q10 | Packs | **Adult cancer and paediatric cancer now. Neurological and renal later** |
| Q11 | Map region | **Udupi district / Karnataka.** Patients come from anywhere in Karnataka to KMC Manipal |
| Q12 | Finale | Yes, she can attend on 28 Nov |

Other points from the call:
- **Paediatric pack:**
  - Use **behavioural pain signs** that parents can observe and report.
  - **Only GREEN and RED, no AMBER.** The threshold for contacting a doctor is very low.
- **Videos** sit inside each care card and open as a pop-up that returns to the same card. "Embed videos wherever possible."
- **C2 becomes "Giving opioid medicines":** a short description of morphine, plus how to apply a **transdermal fentanyl patch**, with a video. Wrong patch application is a frequent problem, and the team keeps retraining families on it.
- She said the remaining draft rules and thresholds were fine.

## 7. Decisions log
| Date | Decision |
|---|---|
| 2 Oct | Concept reframed to assistive-only. The LLM only extracts. Deterministic, doctor-signed rules. No AI wound interpretation. PPI is a doctor-run worksheet. NDPS drugs blocked on teleconsult prescriptions |
| 2 Oct | Caregiver sedation scale is POSS-based (W1–W5), because RASS has no validated caregiver version |
| 2 Oct | ₹0 stack chosen (docs/03) |
| 3 Oct | Name "Saathi – Home Palliative Care Companion". Track: Cancer. Primary user: Patient/Caregiver. Use case: Patient Follow-up & Continuity of Care |
| 3 Oct | Dr. Rao's answers adopted (§6). PaP dropped. Paediatric pack is GREEN/RED only |
| ~6 Oct | ABDM sandbox rejected for an individual applicant. KMC cannot provide access. Use FHIR R4 (NRCeS) records plus a simulated ABHA link labelled as such |
| ~6 Oct | R3 threshold set to ≤12 breaths/min (from a placeholder of 8) |
| 23 Oct | Implement unsigned adult demo protocol only. Keep A15 disabled; reject paediatric evaluation. Separate follow-up status from tier; retain missing-data uncertainty. See docs/06 for implementation assumptions. |

| 23 Oct | Add loopback-only demo workflow; poll local persistent queue. Supabase SQL is tested locally but unapplied. Authenticated shared storage and external delivery are deferred. See docs/07. |
| 3 Nov | Move the workspace from `saathi/` to the repository root. |
| 3 Nov (call with Dr. Rao) | Reframe Saathi as an out-of-hours triage and continuity service feeding a teleconsultation call-back, attached to the hospital EMR via "Check in to Saathi". Acknowledge means queued for a call; call-back targets RED 1 h, AMBER 6 h, GREEN 24 h (to confirm). RED families get her fixed "seek urgent care at the nearest hospital" message. Three logins (medical, non-medical, patient OTP by phone or email). Optional fees. English-only demo; Telegram dropped from the story. Dummy EMR page with one case she writes. See docs/13. |
| 3 Nov | Connect WhatsApp through a Saathi app and WABA created in a friend's Meta business portfolio, where Tushar can create apps, using a dedicated synthetic-demo number (never the clinic's patient-facing number) and a non-expiring system-user token. Replies stay inside the free 24-hour service window; no templates. See docs/11. |
| 3 Nov | Three simulated sign-ins (medical, call manager, family by one-time code to phone or email plus Saathi ID) with signed cookies and per-route role checks. Call managers see counts, status and fees only and may change only fee status. Families must accept the draft service terms (`/terms`, awaiting legal review). Hosted demo mode (`SAATHI_PUBLIC_DEMO=1`) needs a session secret and a staff access code. |
| 3 Nov | Replace the separate `/tour` page with an in-dashboard walkthrough for judges: a fictional guide doctor ("Dr. Asha", never presented as Dr. Rao) highlights each part of the live dashboard; skippable, opens once per browser or with `/?tour=1`. |
| 3 Nov | Host on Vercel Hobby (https://saathi-mauve.vercel.app) with Supabase; move the WhatsApp worker to a serverless function woken by the receiver and pg_cron, with its state in Supabase. Real accounts: email and password (scrypt) and mobile verified by a WhatsApp "LOGIN" message (free, no SMS), sign-up for all three roles, plus one-click demo accounts for judges. Typed WhatsApp messages are labelled by script; voice notes auto-detect language. See docs/14. |

## 8. Open items (batch these into one message to Dr. Rao)
1. **13–15 breaths/min:** make it **AMBER** for adults? Proposed, not yet confirmed.
2. **Paediatric breathing thresholds by age.** The adult ≤12 rule must not be used for children. Also approve the behavioural pain-sign list (docs/02 §6).
3. **Response targets:** call-back minutes for RED, review hours for AMBER, and the order of the on-call chain.
4. Approve full texts for the remaining care cards, especially C2 (opioids + fentanyl patch) and C12, which are drafted in docs/02.
5. Approve each video (docs/02 §9). Consider recording 2-minute Kannada videos at KMC for the fentanyl patch and C12, since no Indian-language ones exist.
6. Check the Hindi and Kannada wording.
7. A typical medication regimen format, for seeding realistic synthetic patients.
8. **For Tushar:** confirm the Round 1 result and the current portal deadlines. List any other team members.
9. **Optional:** email the organisers (healthathon@reskilll.com) asking whether KCDH can sponsor ABDM sandbox access for teams.

## 9. Links
- Clinical review pack: the reviewed PDF is in `assets/` (it includes the R3 update).
- Pitch deck: `assets/Saathi-Pitch-Deck.pdf`.
- `assets/Saathi-Pitch-Deck.pdf`: the Round 1 deck.
- `assets/Saathi-Clinical-Review-Pack-v1-sent-to-Dr-Rao.pdf`: the version she reviewed. It still shows the old R3 placeholder of 8.

## 10. Timeline verification (23 Oct)

The public programme guide at https://healthathon.reskilll.com/guide currently lists build sprint/final submission as 10 Oct-7 Nov and top teams by 14 Nov, differing from the historical dates above. Plan conservatively for 7 Nov; the team's actual submission/shortlisting state remains unverified and requires the logged-in portal.

## 11. Hosted Supabase setup (23 Oct)

Public and server API keys verified. The core schema and synthetic seed were applied to the configured Supabase project, followed by migration 202610230002 to remove explicit anonymous function grants introduced by Supabase default privileges. Verified: five synthetic patients, three unlinked team members, RLS on all eight core tables, anonymous patient access denied and anonymous transition/helper execution denied. Authenticated transition permission is retained, with membership checks enforced by the RPC.

84 local tests pass, including a regression harness that emulates Supabase default function privileges. The dashboard still uses the local file adapter; hosted storage, authenticated user/team links and Realtime are not yet wired. Sarvam and Groq keys are saved but have not been validated or used by these setup operations. Secrets are kept out of source control and outputs.

## 12. Dashboard storage connected (23 Oct)

The app is now configured for Supabase-backed synthetic storage. Migrations 003 and 004 implement server-only transactional submission, status actions, manual escalation, queue snapshots, idempotent local import and explicit HTTP 409 conflicts. Three local reports were copied with original IDs/timestamps/history retained. Hosted concurrency, restart persistence, anonymous denial and client-secret checks passed. 98 tests pass. See docs/08. The site is still localhost-only, doctor identity simulated, queue refresh polled and external clinical messaging disabled.

## 13. Voice and text extraction connected (23 Oct)

Sarvam verbatim STT and Groq structured extraction now feed the deterministic adult demo protocol. The source transcript and keyword flags are saved before model extraction; source quotes are validated and extraction updates are atomic with audit events. Migration 005 adds service-only lookup and leased analysis completion. Narratives never become GREEN and always need human review. Live English text/audio and Hindi/Kannada text passed; 108 automated tests pass. See docs/09 for configuration, limits and retry behavior. Real auth, messaging and clinical approval remain outstanding.

## 14. Telegram intake connected (23 Oct)

A single-host local poller now supports private single-use patient links, synthetic-only consent, text and voice notes, six English button questions, stable update IDs, persistent cursor/outbox recovery and explicit retry. Known RED button observations save immediately. Migration 006 preserves Telegram origin/channel through extraction, and all ten demo/channel RPCs are service-only. Live private pairing, consent, text extraction, Supabase persistence, dashboard traces and a Telegram receipt passed using @SaathiHelperBot. 131 automated tests pass. See docs/10 for commands, limits and recovery. No public webhook/deployment, care-team paging or approved clinical guidance is connected.

## 15. WhatsApp intake readiness (23 Oct)

Prepared a Meta-signature-verified Edge receiver, consent-filtered durable inbox, shared conversation adapter and local text/voice/button worker. Migration 007 is applied. A simulated hosted report verified R2 + A1 / RED, idempotency and persisted resolution/audit; the source explicitly labels it as simulated. 144 automated tests include a signed-webhook-to-PostgreSQL-to-worker check with mocked Meta transport. The user is creating the Meta app; the three Meta credentials are still absent, while a private verification token has been generated locally. Existing Supabase management credentials return 403 for Edge Functions access. No public receiver was deployed and no WhatsApp messages were sent. See docs/11 for the remaining activation steps.

## 16. Care-team workspace update · 24 October 2026

Completed the K1–K12 daily-topic questionnaire for web and shared channel intake, patient timeline and deterministic source-linked pre-call summary, a local automatic demo-escalation worker, and a clinician review desk containing unsigned rule/card drafts and unresolved decisions. 152 tests, type checks and production build passed. Browser verification saved a new synthetic R6 + A11 / RED report with exact source evidence to hosted Supabase. A local escalation-worker smoke advanced six overdue synthetic reports, then made zero duplicate changes; it was stopped afterward. All external clinical notifications remain disabled.

Added 60 provisional multilingual evaluation cases, a keyword-only baseline and a real extraction runner with per-language metrics and explicit failed/unrun outcomes. Keyword baseline matched 10/30 expected REDs and overcalled four expected PENDING examples; live Groq evaluation completed one case then stopped on quota/rate-limit, leaving one failed and 58 unrun. This is not a completed model or speech evaluation. See docs/12 and output/evaluation.

WhatsApp activation is deferred while the user expects the doctor partner to share an existing WhatsApp Business account. Meta's test-account creation returned API 200003 / code 2494067 (“Business WABA Limit reached”) despite TechTush's visible account list being empty; no payment or verification changes were made by the agent. The app remains private to loopback, with simulated operator identity. Public authentication/deployment, clinical approvals, prescription/reminder inputs and the optional features in docs/04 remain outstanding.

## 17. WhatsApp Business Account support · 3 November 2026

Moved the workspace to the repository root. Added read-only `pnpm whatsapp:check` readiness for a shared WhatsApp Business Account. It covers token validity, app, expiry, permissions and WABA grant; WABA membership; Cloud API registration; display name and quality; webhook subscription; and multi-number WABAs. It can also discover the app and WABA IDs from the token. Explicit `whatsapp:subscribe --confirm` and `whatsapp:register --confirm` handle the two account changes. 158 tests pass. The stored access token was rejected by Meta (HTTP 401), so a new system-user token, `WA_APP_ID` and `WA_BUSINESS_ACCOUNT_ID` are needed. Senders identified only by a business-scoped user ID are not yet supported. No account changes were made and no messages were sent.

**Update, same day:** the Meta account is ready. The Saathi app (`1410072904540511`) lives in the vastradrip business portfolio. It uses a non-expiring Employee system-user token, and its Messaging account `1712663776883547` holds the Meta test number +1 555-058-8156. The number is registered for Cloud API (CONNECTED, GREEN) and the app is subscribed to the account's webhooks; `pnpm whatsapp:check` reports ready. The Business settings "WhatsApp accounts" asset has a different ID that the API rejects. Remaining: restore the paused Supabase project, give the management token Edge Functions/Secrets permissions, publish the receiver, set the Meta callback URL, then pair and run the worker. No WhatsApp message has been sent.

**Live, same day:** the receiver is published on Supabase, Meta's webhook callback verified, and the `messages` field subscribed. The privacy policy and data-deletion pages are public on GitHub Pages (tushartechs.github.io/saathi-privacy). With `pnpm whatsapp:run --send` running, a private pairing link from `pnpm whatsapp:pair` linked the tester's own WhatsApp to `demo-ramesh`. The signed `/start` webhook reached the inbox, the worker replied with the synthetic-only consent message, the consent button was accepted, and the help message was delivered. This is the first live WhatsApp round trip; a full check-in and voice note are next.

## 18. Call preparation and on-call alerts · 3 November 2026

Added a 16-step guided tour at `/tour` for presenting Saathi, with live workspace counts, deep links, honest feature status, talking points and the questions to ask Dr. Rao. Any report now exports as a FHIR R4 bundle with a clearly simulated ABHA number and HL7 test-data labels; NRCeS profile conformance is not claimed. The live evaluation runner waits out Groq rate limits and resumes from a checkpoint. On-call WhatsApp alerts for every new RED, with an Acknowledge button, are implemented and tested (167 tests). The inbox filter migration 008 is applied to the hosted project; a live alert round trip still needs the worker restarted and the on-call phone registered. Alerts are free only within 24 hours of the on-call phone's last message; lapsed alerts are recorded and never sent as paid templates.

**Live evaluation completed (3 Nov):** all 60 authored text cases ran through Groq extraction, the keyword safety net and the deterministic rules, with no errors. RED recall was 27/30 (90%): English 10/10; Hindi missed hallucinations and caregiver not coping; Kannada missed caregiver not coping. All 15 AMBER cases matched. There were 4 false REDs, all negated or historical phrases caught by the conservative keyword net (no seizure in EN/HI/KN; past bleeding in EN). Labelled-field accuracy was 91.7% and median latency about 1.8 s. The keyword-only baseline caught 10/30. Labels are engineering drafts, not clinician-validated; no speech-to-text or real patient data was involved. The three missed REDs point to Hindi and Kannada safety-net phrases for hallucinations and caregiver distress. Adding them needs Dr. Rao's review, and they must be tested on new cases rather than tuned to this set.

## 19. Roles, family web page and judges' walkthrough · 3 November 2026

- **Sign-in (simulated):** `/login` offers medical staff, call manager and patient/family. Sessions are HMAC-signed cookies (12 h); every API route checks the role, and `proxy.ts` routes pages by role. One-time codes are shown on screen because no SMS or email provider is connected. This is role separation for the demo, not real authentication. The audit trail still records the simulated "Demo doctor 1" as the acting clinician; recording the signed-in name needs a migration to the transition and close functions.
- **Call manager report (`/coordinator`):** date picker, daily counts by urgency, acknowledged, completed and waiting, patient name, hospital ID, what was done, fee checklist and Export PDF (browser print). No symptoms, quotes, rules or call notes.
- **Family web page (`/c`):** confirm the patient, describe the concern in text or a voice note, see the fixed triage reply, medicines, appointments and request status. The 108 rider is always shown. Draft service terms and consent at `/terms`.
- **Judges' walkthrough:** 18 steps on the live dashboard with the WhatsApp story, EMR check-in, queue, demographics, evidence trace, RED family message, call closure, fees, call log, staff intake, clinical review, roles and safety (with the live evaluation numbers). Planned features are described as planned (for example NDPS-blocked e-prescriptions).
- **Hosting:** the app still runs on loopback by default. For a shared link set `SAATHI_PUBLIC_DEMO=1`, `SAATHI_SESSION_SECRET` and `SAATHI_STAFF_CODE`; the local WhatsApp worker keeps running on the laptop. Not yet published.
- 180 tests, type checks and production build pass. Browser-verified: sign-in, the full walkthrough and the call manager report. Role boundaries were verified through the API.

## 20. Hosted, with real accounts · 3 November 2026

Saathi is live at **https://saathi-mauve.vercel.app** (Vercel Hobby + Supabase, ₹0, no laptop needed). Judges open any role in one click; anyone can create an account by WhatsApp-verified mobile or email and password. Migration 010 (accounts, login codes, worker state and lease, named call-log actors) is applied, the WhatsApp receiver is redeployed to verify `LOGIN` codes and wake `/api/worker`, and local worker state was copied to Supabase. Verified on production: demo sign-in for all roles, role boundaries, email sign-up/sign-in/duplicate/wrong-password, staff invite code, WhatsApp code and QR, a worker pass, the walkthrough. 184 tests, type checks and build pass. The 2-minute pg_cron schedule is active and reaching the worker (HTTP 200). Mobile sign-in is number-first (migration 011), and judges have one public test login that switches between the three views. **Pending:** a live WhatsApp `LOGIN` from a phone. See docs/14.

**3 Nov, 21:20 IST:** Meta now answers every Graph call for the Saathi app, WABA and test number with "API access blocked" (OAuthException 200), and stopped delivering webhooks (a real `LOGIN` message never arrived). The block started between 19:03 and 21:19 IST. A signed, simulated webhook proved the receiver and sign-in verification work. Until Meta restores access, WhatsApp sign-in, family chat, reminders and on-call alerts are down; the website, email sign-in and the judge login work. The simulation created one test report, closed with a note; the worker now ignores `LOGIN` messages.

## 21. Closing the gaps from Dr. Rao's call · 3 November 2026 (late)

Checked the build against the call transcript and added what was missing (migration 012, applied):
- **Teleconsult prescriptions:** after acknowledging a report, the doctor can write a prescription (medicine, dose, frequency, days). A data-driven restricted list (`packages/clinical-content/src/restricted-drugs.json`, draft for Dr. Rao's review) blocks narcotic and psychotropic (NDPS), Schedule X and anti-cancer drugs, both as the doctor types and on the server. The doctor enters a registration number and attests the consultation; the prescription is HMAC-signed (tamper check, not a DSC), printable at `/rx/<id>`, and visible to the family on their page.
- **Assignment:** AMBER and GREEN calls can be assigned to a doctor, nurse or psychologist by medical staff or the call manager; shown in the queue and the call manager report.
- **RED alert that flashes:** a new open RED shows a pulsing banner, beeps, blinks the tab title and can raise a desktop notification.
- **Family updates without WhatsApp:** daily pain score (0–10), medicines given or not per dose time, and hospital admission or discharge (discharge shows a follow-up call due in 14 days on the timeline). These feed the pain and compliance charts.
- **Follow-up fee:** the family page shows half the fee for a call within 15 days of the last one.
- **Doctor-side voice:** in-browser recording removed; staff upload a voice note or type what the family said.
- Sign-in no longer uses WhatsApp (Meta blocked the app); mobile number or email with a password.
Still waiting on Dr. Rao: approved automatic nursing replies, care-card texts and videos, the restricted-drug list, her synthetic case, and the legal wording of the terms.

## 22. Online review form for Dr. Rao · 3 November 2026

Replaced the PDF review pack with an online form at `/review` (private link with `SAATHI_REVIEW_TOKEN`, no login). 60 questions in five sections (call decisions, family messages, every triage rule generated from the protocol data, open questions, and new items: the restricted-drug list, automatic nursing replies and legal wording). Each question has tappable choices and an optional note; answers autosave (server and browser) and Submit keeps a copy (migration 013). Tushar reads answers at `/review/responses` (with `SAATHI_REVIEW_ADMIN_TOKEN`), can copy them as Markdown, and `pnpm review:export` writes them to `output/review/`. Review pack v2's sign-in (A6) and prescription delivery (A8) items are corrected in the form. Both links are in `apps/web/env.local`.

## 23. Clinical review applied and final build · 7 November 2026

Dr. Krithika S Rao submitted the online review form (60 answers) and joined a call. Applied:
- **Protocol `adult.v1.2-approved-demo`** (v1.1 with the approver recorded by role; protocol versions are immutable in the database, so any content change needs a new version): all rules are recorded as approved by her for the demo; institutional sign-off is still needed. A6 now covers 48 h after starting opioids or a dose increase; A9 no longer needs a photo; A10 is retired; A15 is on; R8 includes a wound bleed that will not stop. New rules: R14 uncontrolled agitation and R15 a fall (RED); A16 unable to swallow medicines and A17 mouth or throat pain stopping intake (AMBER).
- **Family wording (her text):** the "may be critical" RED message for breathing, unconsciousness, seizure, vomiting, severe pain and sudden new symptoms, with her end-of-life note and the kept emergency card; the Tele-MANAS message for R13; other REDs promise a 30-minute call. Every rider says "call 108 for an ambulance … or seek urgent medical help from your local physician". Non-urgent replies add her C6/C12 cards and links to approved hospice videos (Karunashraya, St Nicholas Hospice; the Doctors' Circle video is left out as not an institutional source).
- **Call-backs:** RED 30 min at any hour; AMBER 6 h counted in duty hours (demo 9:00–17:00 Mon–Sat); GREEN the next working day.
- **Roles:** nurses and psychologists (staff type, migration 014 applied) see everything except prescription changes. The call manager sees contact details for scheduling with copying disabled.
- **Prescriptions:** changes are saved for in-person issue at the OPD within 2–3 working days; nothing is sent to families; anti-cancer drugs refused; NDPS flagged as in-person only.
- **Lifecycle:** doctors close follow-up on death or transfer; reminders stop and families get the OPD message.
- **Dashboard:** Search patient replaces the timeline tab; Clinical review tab and KMC label removed; "care continuity service" wording.
- **Demo case:** her Arjun Mehta case (patient key `demo-ramesh` renamed in the hosted database).
- **Family page:** a WhatsApp-style chat running the same engine and replies as the WhatsApp line, because Meta still blocks the Saathi app (Graph API error 200 since 3 Nov). Not done: children's pack (needs her age thresholds), automatic nursing replies (she will send them), and her labels for the 60-case evaluation (she will review before the finale).

**Evaluation re-run (7 Nov, approved protocol):** 29/30 expected REDs caught (96.7%; EN 10/10, HI 10/10, KN 9/10), 87.9% precision, 95.0% field accuracy, 4 conservative false REDs (negated or historical). The only miss: Kannada caregiver not coping. Part of the change from 27/30 is model variation; labels remain engineering drafts.
