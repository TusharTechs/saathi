# Evidence behind our claims

Every number in the Saathi brief, deck and demo video is listed here with its source. Published figures come first; our own results follow, each linked to the file or system that produced it. Sources were checked on 7 November 2026.

## 1. The problem: published evidence

| # | Claim we make | Source |
|---|---|---|
| E1 | **7–10 million** people in India need palliative care, and **fewer than 4%** have access to it | Naqvi MA, Bhukal J, John J, Rajagopal MR, Zadey S. *Access to palliative care in India: situational analysis and modeling of access from public healthcare centers.* ecancermedicalscience 2025;19:2038. [doi:10.3332/ecancer.2025.2038](https://doi.org/10.3332/ecancer.2025.2038) · [PMC12904676](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12904676/) |
| E2 | India had **526** palliative care centres in 2022, about **4 per 10 million** people; access is far worse in rural areas | Same study as E1 |
| E3 | Only **5.8%** of 223 Indian palliative care centres provide **uninterrupted access to oral morphine** | Ghoshal A, Joad AK, Bhatnagar S, et al. *Situational analysis of the quality of palliative care services across India: a cross-sectional survey.* ecancermedicalscience 2022;16:1486. [doi:10.3332/ecancer.2022.1486](https://doi.org/10.3332/ecancer.2022.1486) · [PMC9934966](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9934966/) |
| E4 | India meets only about **4%** of its need for opioid pain relief; about **7 million** Indians need palliative care | Knaul FM, et al. *Alleviating the access abyss in palliative care and pain relief: an imperative of universal health coverage (Lancet Commission report).* The Lancet 2018;391:1391–1454. [doi:10.1016/S0140-6736(17)32513-8](https://doi.org/10.1016/S0140-6736(17)32513-8) |
| E5 | India projected **1,562,099 new cancer cases** in 2024 | ICMR-NCRP Investigator Group (Nair et al.). *Cancer incidence and mortality across 43 cancer registries in India.* JAMA Network Open 2025;8(8):e2527805 |
| E6 | Worldwide, **56.8 million** people need palliative care each year, and **only about 14%** receive it | World Health Organization. [Palliative care fact sheet](https://www.who.int/news-room/fact-sheets/detail/palliative-care) (2020) |
| E7 | After-hours calls are frequent and mostly about symptoms: **4,434** after-hours triage calls in one year at one hospice; symptom control was the top reason (**25.7%**), and many calls could not be fully resolved by phone | Jiang Y, Gentry AL, Pusateri M, Courtney KL. *A descriptive, retrospective study of after-hours calls in hospice and palliative care.* J Hosp Palliat Nurs 2012;14(5):343–350. [PMC3389760](https://pmc.ncbi.nlm.nih.gov/articles/PMC3389760) |
| E8 | Families are often unsure whom to call out of hours, and generic advice lines cause delays | *Telephone advice lines available out-of-hours to people with palliative and end-of-life care needs* (qualitative study, 2023 preprint, not yet peer reviewed). [medRxiv 10.1101/2023.10.19.23297190](https://www.medrxiv.org/content/10.1101/2023.10.19.23297190) |
| E9 | India has only about **120–130 MD palliative-medicine specialists** | Estimate from our clinical lead, Dr. Krithika S Rao (Palliative Care, KMC Manipal). We found no published national count, so this is labelled as her estimate wherever it appears |

## 2. Rules we follow: regulatory sources

| # | Claim we make | Source |
|---|---|---|
| R1 | Teleconsultation may not prescribe drugs in Schedule X or under the NDPS Act; Saathi issues narcotic changes only in person and refuses anti-cancer drugs | Ministry of Health and Family Welfare. [Telemedicine Practice Guidelines 2020](https://www.mohfw.gov.in/pdf/Telemedicine.pdf) (prohibited list) |
| R2 | Consent at check-in, purpose limitation, a stop command and a data deletion page | Digital Personal Data Protection Act, 2023 (Government of India) · our [data deletion page](https://tushartechs.github.io/saathi-privacy/data-deletion.html) |

## 3. Our own evidence (verifiable)

| # | Claim we make | Where to check it |
|---|---|---|
| O1 | **29 / 30** expected REDs caught (96.7%); 87.9% of RED alerts were real; 95.0% of fields extracted correctly; English 10/10, Hindi 10/10, Kannada 9/10 | [`output/evaluation/live-extraction.md`](../output/evaluation/live-extraction.md) (run of 7 Nov 2026 on protocol `adult.v1.2-approved-demo`); corpus in [`eval/`](../eval) |
| O2 | Keywords alone catch only **10 / 30** REDs | [`output/evaluation/keyword-only.md`](../output/evaluation/keyword-only.md) |
| O3 | **15 RED and 16 AMBER** active rules, each with a unit test | [`packages/clinical-content/src/adult.v1.json`](../packages/clinical-content/src/adult.v1.json), [`tests/rules.test.ts`](../tests/rules.test.ts) |
| O4 | **202 automated tests** pass, including database tests on PGlite | Run `pnpm test`; tests in [`tests/`](../tests) |
| O5 | The model's fields are rejected unless the quote appears word for word | [`packages/shared/src/index.ts`](../packages/shared/src/index.ts) (quote check), [`tests/extraction.test.ts`](../tests/extraction.test.ts) |
| O6 | A model failure cannot drop a RED (keyword safety net) | [`packages/workflow/src/safety-net.ts`](../packages/workflow/src/safety-net.ts); test "safety flags are durably checkpointed before extraction" in [`tests/extraction.test.ts`](../tests/extraction.test.ts); seen live on 7 Nov 2026 when the model provider's daily quota ran out and REDs were still raised |
| O7 | The protocol, thresholds and family wording were reviewed and approved for the demo by our clinical lead (60-question review and call, 7 Nov 2026) | Review record in [`docs/01-PROJECT-CONTEXT.md`](01-PROJECT-CONTEXT.md) §23; approver and date recorded in the protocol file (O3) |
| O8 | Everything shown runs today on synthetic data | [Live demo](https://saathi-mauve.vercel.app) (one-click judge roles) · [source code](https://github.com/TusharTechs/saathi) |

## 4. Cost assumptions (estimates)

| Item | Rate used | Source |
|---|---|---|
| Text extraction (≈4,400 input + ≈600 output tokens per report) | $0.15 per million input and $0.60 per million output tokens for `gpt-oss-120b` | [GroqCloud pricing](https://groq.com/pricing) (as listed in October 2026) |
| Speech-to-text | ₹30 per hour, billed per second | [Sarvam AI pricing](https://docs.sarvam.ai/api-reference-docs/getting-started/pricing) |
| WhatsApp | Replies inside the 24-hour customer-service window are free; utility templates (reminders) outside it are charged per message | [Meta WhatsApp Business pricing](https://developers.facebook.com/docs/whatsapp/pricing) |
| Hosting for production | Vercel Pro $20 and Supabase Pro $25 per month | Vendor pricing pages |
| Exchange rate | ₹85 per US$ | Assumption |

## Limitations we state openly

- The evaluation uses 60 invented messages, and its labels are engineering drafts until our clinical lead labels them. Model runs vary: the same set caught 27/30 on 3 Nov.
- The protocol is approved by our clinical lead for this demo only; institutional sign-off and legal review are needed before real use.
- No real patient has used Saathi. All patients shown are synthetic.
