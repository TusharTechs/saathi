# 01 · Project context and where we stand

_Last updated: 23 Oct 2026. Original handoff retained below; implementation updates are explicitly dated._

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
