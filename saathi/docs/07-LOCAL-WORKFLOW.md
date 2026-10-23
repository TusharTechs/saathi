# Local caregiver intake and care-team queue

> Current update: the configured dashboard now uses Supabase storage. The local adapter below remains available with `SAATHI_STORAGE=local`. See [the Supabase storage guide](08-SUPABASE-STORAGE.md) for the current setup and verified behaviour.

Implemented 23 October 2026. This phase adds a Next.js app and persistent **synthetic-only** local workflow. It does not deploy a site or connect any external accounts.

## Start and review

From the `saathi/` project folder:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:3000. The workspace offers five synthetic patients, a caregiver button check-in, four explicit test scenarios, priority filters, source quotes and rule traces, acknowledgement/resolution, and an append-only application audit trail. Queue updates poll every five seconds; this is not Supabase Realtime yet.

1. Select **New check-in** and a synthetic patient.
2. Choose W4 and enter four extra doses, then save.
3. The queue shows RED with R2 and A1, a draft keyword match and pending facts. Inspect the original wording and protocol version.
4. Acknowledge the report, then mark it resolved. Use the Resolved filter to inspect its history.
5. Try the explicit complete fixture for GREEN and the unanswered fixture for follow-up. The fixtures supply invented observations; unanswered form fields never receive fixture defaults.

The current form covers pain, rescue doses, wakefulness, breathing and an optional counted rate plus free-text concerns. It is not yet the complete K1-K12 daily check-in. Intake labels are English even when a synthetic patient's preferred language is Hindi or Kannada. No voice recorder, STT or LLM runs in this phase.

## Credentials for the next integrations

Copy `apps/web/.env.example` to `apps/web/.env.local` and enter keys locally. Never paste secrets into chat or commit that file. The current app does not consume these placeholders or make API calls yet.

| Priority | Service | Values | Intended use |
|---|---|---|---|
| Next | Sarvam | `SARVAM_API_KEY` | Speech transcription/translation/audio responses |
| Next | Groq | `GROQ_API_KEY` | Schema-constrained extraction from synthetic reports |
| Next | Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Auth, durable shared records and Realtime |
| Later | Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Bot intake and verified webhooks |
| Later | WhatsApp | `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET` | Test-number intake and signed webhooks |
| Optional | Bhashini / Gemini | Listed in template | Fallbacks; not needed for the present milestone |

Use the project's anon/publishable key for the public key field; keep service-role credentials server-only. Restart the development server after changes. No paid account, key validation or quota consumption is performed by this milestone. Use synthetic reports with any future cloud provider.

## Local persistence and operations

Data lives at `apps/web/.saathi-demo/queue.json`, which is ignored by Git. An exclusive directory lock and atomic rename serialize mutations across route bundles and local processes. Requests carry UUID idempotency keys: retrying the same payload yields the original record; changing it under the same key yields 409. Acknowledgement and resolution require the current revision, preventing conflicting writes. No delete/reset endpoint is exposed.

If an interrupted process leaves `transaction.lock`, stop all app instances, back up the data directory, and remove the stale lock directory before restarting. Corrupt data fails visibly and is not overwritten. This file adapter is for a single-host demo, not serverless or production storage; it does not provide database durability, immutable audit protection, backups or authentication. New schema/format versions require migration rather than silently discarding data.

The shipped dev/start commands enable the demo explicitly and bind to loopback. APIs reject non-loopback hosts; mutations also require same-origin JSON with a 16 KB body cap. Do not expose this app through a tunnel or public hosting. The displayed doctor identity is simulated; it is not a login.

## Safety net and escalation

The draft EN/HI/KN keyword safety net covers selected phrases across five red-flag concepts. It retains the original message, matched phrase, concept and language. It is incomplete and has not been clinically or linguistically validated. A nearby negation is recorded as ambiguous; it does not suppress a RED match. This intentionally over-calls examples such as “no seizure”. The raw narrative still requires human review. No-match is not evidence of safety.

Structured synthetic fixtures contain schema keys rather than natural-language reports and bypass keyword scanning; their observations go directly through the rule engine. Real button selections and narrative concerns are scanned. No general free-text extraction is claimed.

Run escalation check evaluates open RED reports against a 15-minute **demo** interval. It advances to demo doctor 2, then demo coordinator, and records exhaustion after another interval. Acknowledged or resolved reports stop escalating. It is a manual tick endpoint, with no background scheduler, paging, message delivery or promised clinical response time.

Emergency care cards remain draft and are not sent. No external notifications, callbacks or treatment instructions are generated.

## Supabase migration

`supabase/migrations/202610230001_core.sql` defines core care-team membership, patient assignments, protocol versions, messages, check-ins, reports and audit events. The seed file adds five synthetic patients and three unlinked team members, with no clinical approval records or invented auth users.

RLS scopes patient records to assigned care-team members. Anonymous clients have no access. Authenticated clients can read scoped rows but cannot directly write reports or audit entries. The `transition_alert` RPC locks the row, checks membership, verifies revision, changes status and appends an audit event in one transaction. A trusted future ingestion service writes input and evaluation records; that service is not implemented here. Medication/centre/care-card tables from the broader architecture are also deferred.

The migration and seed are tested with PGlite's PostgreSQL runtime using a minimal emulation of Supabase auth roles and `auth.uid()`. This verifies SQL, constraints and access-policy behaviour; it is not a hosted Supabase deployment or a full Supabase integration test. The migration has not been applied to any external project.

## Verification

- `pnpm typecheck`: shared code and web app type checking.
- `pnpm test`: 83 passing assertions/subtests, including the original rules, concurrent/idempotent local writes, revision conflicts, escalation boundaries, source evidence, corrupt-store handling, keyword examples, SQL constraints and patient isolation.
- `pnpm build`: optimized Next.js build passes.
- HTTP smoke: intake, duplicate retry, state transitions, stale revision, origin rejection, field validation and manual tick verified against the running app.
- Browser QA: example creation, acknowledgement and caregiver button submission verified; dashboard checked at desktop and 390 px mobile width.

## Next work

Wire Sarvam and Groq behind server-only adapters with schema/source validation, provider failures and timeouts; expand multilingual safety-net evaluation; complete K1-K12 intake; connect Supabase auth/storage/Realtime; then integrate Telegram followed by WhatsApp with signed/secret webhooks, retry handling and durable notification outbox. Clinical review remains required before publishing approved content or piloting.

## Hosted setup commands

`pnpm supabase:check` checks the public/server key without logging values or requesting patient rows. `pnpm supabase:plan` shows the exact bootstrap scope without external writes. `pnpm supabase:apply` uses `SUPABASE_ACCESS_TOKEN` to apply the core migration and synthetic seed and verify five synthetic patients. The management token is separate from project API keys. The command refuses to overwrite pre-existing Saathi tables and does not automatically retry writes. If a write times out, inspect the project before rerunning.

Use `SUPABASE_SECRET_KEY` for a new `sb_secret_...` server key or retain a valid legacy `SUPABASE_SERVICE_ROLE_KEY`. A publishable key alone cannot migrate SQL. These setup commands do not switch the dashboard away from its local file store.

## Hosted setup completed (23 Oct)

The core schema and seed have now been applied to the configured project, along with `202610230002_function_permissions.sql`. Supabase's explicit default grants required revoking `anon` directly on both helper and transition functions; revoking PUBLIC alone was insufficient. Verified eight RLS-protected tables, five synthetic patients, three unlinked team members and blocked anonymous data/function access. The local PostgreSQL harness now emulates these default grants; 84 tests pass.

The bootstrap command includes the permissions correction for fresh projects. Existing projects must receive the forward migration rather than rerunning the core bootstrap. The dashboard is still on its local adapter; this setup does not establish application login, hosted report persistence or Realtime.
