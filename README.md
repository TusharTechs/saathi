# Saathi – Home Palliative Care Companion

A WhatsApp-first companion for families caring for palliative cancer patients at home, with a care-team dashboard. Built for Health-a-thon 2026 (IIT Bombay KCDH · Koita Foundation · National Cancer Grid), Cancer track.

**AI listens. The doctor decides.** The LLM only transcribes and extracts caregiver reports. Escalation follows a deterministic protocol approved by the palliative physician, and families receive only approved guidance.

- Start here: `docs/01-PROJECT-CONTEXT.md`.
- Clinical source of truth: `docs/02-CLINICAL-PROTOCOL.md`.
- Architecture and stack: `docs/03-ARCHITECTURE-AND-STACK.md`.
- Plan: `docs/04-BUILD-PLAN.md`.
- `assets/`: Round 1 pitch deck and the clinical review pack sent to the clinical lead.

Team: Tushar Agarwal (tech lead) · Dr. Krithika S Rao (clinical lead, Palliative Care, Kasturba Medical College, Manipal).

## Local rules-engine milestone (23 Oct 2026)

From this directory, run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, and `pnpm demo` (Node 22+, pnpm 11.25.0).

The workspace contains shared Zod schemas, versioned adult protocol data, a pure deterministic evaluator, rule and boundary tests, and a synthetic fixture-to-alert console demo. Everything is demo-only; there is no signed clinical approval or external message delivery. See [the implementation contract](docs/06-IMPLEMENTATION-CONTRACT.md) for the rule/field matrix, unresolved interpretations and remaining integrations.

## Local caregiver and care-team app

Run `pnpm dev` and open http://127.0.0.1:3000. Submit a synthetic button check-in, inspect rule traces, acknowledge and resolve reports. The local queue persists across restarts. Run `pnpm build` for a production-build check.

See [the local workflow guide](docs/07-LOCAL-WORKFLOW.md) for scope, database policies, verification and credential setup. Copy `apps/web/.env.example` to `apps/web/.env.local` when preparing service keys; voice/text reports now call Sarvam and Groq when configured (see below).

## Supabase storage connected

The configured `.env.local` now uses `SAATHI_STORAGE=supabase`. The dashboard stores reports, actions and audit history in the configured project; three previous synthetic local reports have been copied with their history preserved. `SAATHI_STORAGE=local` remains an explicit offline option. See [the Supabase storage guide](docs/08-SUPABASE-STORAGE.md) for configuration, migration commands and verification.

## Voice and text extraction connected

Caregiver check-in now supports short recorded/uploaded audio and typed English, Hindi or Kannada reports. Sarvam transcribes; Groq extracts schema-validated observations with original source quotes; the deterministic engine evaluates them. Source reports and independent keyword flags are saved before extraction. Failures stay visible for review and retry. See [the voice/text guide](docs/09-VOICE-AND-TEXT.md) for limits, data flow, migrations and verification. All narrative reports require human review; clinical guidance and external notifications remain disabled.

## Telegram intake

A local worker now supports privately paired, consenting synthetic Telegram chats, with text/voice and six button questions feeding the same Supabase queue. Run `pnpm telegram:check`, create a private link with `pnpm telegram:pair --patient demo-ramesh --language hi-IN`, and run `pnpm telegram:run --send` when ready to enable replies. See [the Telegram guide](docs/10-TELEGRAM-INTAKE.md) for setup, migration, consent, limits and delivery recovery. No public deployment or webhook is required.

## WhatsApp intake prepared

The signed Meta webhook, private Supabase inbox, patient consent flow, text/voice/button worker and deployment commands are implemented. Live activation is pending Meta test-app credentials, additional project-scoped Functions/Secrets permissions and approval to publish the receiver. No WhatsApp messages have been sent. See [the WhatsApp readiness guide](docs/11-WHATSAPP-INTAKE.md) for setup, verification and remaining checks.

## Complete daily intake and patient history

The web and channel check-ins cover K1–K12, with skipped facts remaining unknown and RED answers saved immediately in chats. The new **Patient timeline** view brings together saved reports, per-report pain/rescue values, original sources and audit history, plus a copyable pre-call summary. `pnpm escalation:run` enables automatic demo escalation checks every 30 seconds; it sends no notifications and requires this computer to stay running. See [the workspace guide](docs/12-CARE-TEAM-WORKSPACE.md).

**Clinical review** shows unsigned rules, outstanding clinical questions and the handoff's care-card drafts for your partner to review locally. `pnpm eval:text` runs the 60-example EN/HI/KN keyword baseline; `pnpm eval:live` runs real extraction when Groq capacity is available. The first live run stopped on a quota/rate-limit error and is explicitly incomplete; see `output/evaluation/`. No evaluation result is labelled clinician-validated.
