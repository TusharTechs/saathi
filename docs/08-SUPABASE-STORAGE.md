# Supabase-backed synthetic dashboard

Completed 23 October 2026. The configured app now reads and writes its synthetic queue in Supabase, with server-only credentials and the existing localhost access restriction. No new credentials are needed for this storage phase.

## Configuration and running

`apps/web/.env.local` now selects `SAATHI_STORAGE=supabase`. The server uses `NEXT_PUBLIC_SUPABASE_URL` plus `SUPABASE_SECRET_KEY` (preferred) or a valid legacy `SUPABASE_SERVICE_ROLE_KEY`. Credentials are not returned to the browser. Management access is used only by setup commands, not by dashboard requests.

Run `pnpm dev` from the project folder and open http://127.0.0.1:3000. The banner and queue footer identify Supabase storage. `pnpm build` and `pnpm start` also work, with the same loopback restriction. Queue refresh still polls every five seconds; Supabase Realtime is not connected.

Set `SAATHI_STORAGE=local` and restart only when deliberately choosing the offline file adapter. Supabase failures never silently switch to local storage or show an empty successful response.

## Database flow

Migration `202610230003_demo_storage.sql` adds synthetic patient display keys, idempotency/revision metadata, and six service-only RPCs. It uses the existing messages, check-ins, alerts, protocol versions, patients and audit-event tables rather than introducing a second report store.

- Submit: evaluate on the server, then atomically insert the message, check-in, protocol version, evaluation and creation event. A transaction advisory lock serializes retries of the same request ID. A matching retry returns the existing report; a conflicting payload is rejected.
- Acknowledge/resolve: lock the alert row, compare the expected revision, enforce status order, then update status and append its audit event together. Actions retain the explicitly simulated doctor identity.
- Manual escalation: database time and row locks advance open RED reports through the demo chain. Acknowledged/resolved reports do not escalate. There is still no scheduler, paging or external notification delivery.
- Queue: one database statement reads reports and their events from a consistent snapshot, along with the seeded synthetic patient list and team labels.

Migration `202610230004_conflict_responses.sql` uses explicit PostgREST `PT409` domain conflicts so stale requests receive HTTP 409 instead of being treated as server/serialization failures. No automatic write retries occur in the adapter. On an ambiguous timeout, refresh or retry using the same request ID.

All six demo functions explicitly revoke EXECUTE from PUBLIC, anon and authenticated, including Supabase's direct default grants; only service_role receives execution rights. RLS remains enabled on the eight core tables. These functions are not a replacement for real authenticated user authorization: the server remains loopback-only and the demo doctor is simulated. A hosted public app, login, patient/team onboarding and scoped user sessions remain future work.

## Existing local history

The three validated synthetic local records were copied to Supabase once. Original report IDs, request IDs, creation times, statuses, revisions and audit events were retained. Each copied record adds an `imported` audit event. The local source file at `apps/web/.saathi-demo/queue.json` was not changed.

`pnpm supabase:import-local` validates the entire source before writing. The importer is idempotent: a repeated run skipped all three existing records. It never overwrites newer cloud actions. If interrupted partway, retrying the same source safely skips completed entries. Unknown actors, invalid references or incompatible protocol content fail rather than inventing history.

`pnpm supabase:storage` applies the forward storage migration to a core-initialized project and checks the conflict-response correction. Fresh `pnpm supabase:apply` bootstraps all current migrations and seed in order; it refuses to overwrite existing Saathi core tables.

## Verification

- 98 tests pass, including SQL constraints and role grants, transactional rollback, idempotency, revision conflicts, escalation intervals, history imports, adapter failures and secret-safe error messages.
- Live hosted HTTP smoke passed: concurrent submission creates one record; concurrent acknowledgement has one winner; stale resolution is rejected; resolution and audit events persist. The synthetic smoke reports remain in the database as test history.
- All five current cloud records and their complete queue payload survived a development-server-to-production-server restart unchanged. The local source file hash also stayed unchanged.
- Hosted anonymous queue RPC returned HTTP 401. Database inspection confirmed no anon or authenticated execution rights on all six demo RPCs.
- Production build and TypeScript checking pass. The built browser assets contain none of the configured server, management, Sarvam or Groq secrets.
- Browser inspection verified the Supabase banner, stored reports and a persisted resolve action after reload.

To repeat live smoke against a running localhost app: `pnpm exec tsx eval/storage-smoke.ts`. This creates one synthetic report, exercises concurrency, and resolves it. Unit tests do not use cloud credentials.

Sarvam/Groq voice extraction, messaging channels, clinical approval, background escalation and external notifications remain outside this storage milestone.
