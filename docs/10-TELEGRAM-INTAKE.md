# Telegram synthetic intake

Implemented 23 October 2026. A local long-polling worker connects a private Telegram bot to the existing Supabase report pipeline. It supports synthetic text, Telegram voice notes and six English button questions. It creates no public webhook, tunnel or web deployment. The web dashboard remains loopback-only.

## Setup

In `apps/web/.env.local`, configure `TELEGRAM_BOT_TOKEN` from BotFather alongside the existing Supabase, Groq and Sarvam credentials. Set `SAATHI_STORAGE=supabase`. Never paste tokens into chat or commit them. This worker does not use `TELEGRAM_WEBHOOK_SECRET`; that variable is reserved for a future deployed webhook adapter.

1. `pnpm supabase:telegram` applies migration 006 after migrations 001–005. The management access token is used only for this migration. Fresh `pnpm supabase:apply` includes all six migrations and seed.
2. `pnpm telegram:check` validates the token and checks for an existing webhook. It sends no messages and does not consume updates. Existing webhooks are left unchanged; use a separate demo bot if the bot is already used elsewhere.
3. `pnpm telegram:pair --patient demo-ramesh --language hi-IN` generates a private single-use link, valid for 15 minutes. Other supported aliases are `demo-lakshmi`, `demo-fatima`, `demo-suresh` and `demo-meena`; languages are `en-IN`, `hi-IN`, `kn-IN` and `unknown`.
4. When ready to send synthetic replies, run `pnpm telegram:run --send`. Open the pairing link in your own Telegram app, tap Start, then confirm **synthetic reports only**. The link binds that private chat to the selected synthetic patient. Consent lasts 24 hours; a fresh link is needed afterward.
5. Send an invented report or voice note. Use `pnpm dev` to inspect the result at http://127.0.0.1:3000. The report detail labels Telegram as its source and retains original wording, evidence, extraction status and audit events.

If tapping Start opens the bot without pairing, send the complete `/start <code>` command from the pairing URL directly in that bot chat. A bare `/start` returns linking instructions; it does not bind a patient.

The worker must remain running locally to process updates. Ctrl-C stops it. No scheduler, process manager or startup service is installed. Only one worker per bot is allowed. Do not run a second Telegram poller against the same bot. The worker exits on API/polling errors so an operator can investigate; it does not silently switch modes or discard pending work.

## Commands and limits

- `/checkin`: six questions covering wakefulness, breathing, pain, extra doses in 24 hours, breath count and counting for a full minute. These mirror the current web button intake; the full K1–K12 workflow and translated button copy are future work.
- `/submit`: save partial answers. Unknown answers stay missing. A known RED observation saves immediately without waiting for the other questions.
- `/cancel`: discard the unsaved button draft.
- `/language en`, `/language hi`, `/language kn`, `/language auto`: select the narrative language. Button prompts stay English. An active button draft accepts typed numbers only at the dose/count questions; use `/cancel` to stop it before sending a free-text report.
- `/retry`: explicitly retry the last request with its original request ID, patient and language. Completed results are reused; failed extraction can be retried against the saved transcript. A completed voice checkpoint avoids downloading/transcribing again.
- `/stop`: unlink and remove the chat's local session/draft/retry input. Reports already saved to Supabase remain as audit history. No further report is accepted without a fresh link and consent.
- `/help`: show limits and available commands.

Narratives are limited to 4,000 characters; voice notes to 30 seconds and 2 MB. Arbitrary documents/audio attachments, photos, groups, channels, bot messages and edited messages are ignored or rejected. Unlinked chats cannot invoke speech, extraction or report writes, and receive no unsolicited responses. An explicit `/start` receives pairing instructions if its link/code is missing or invalid. A callback must belong to the paired private sender and the current question nonce/step. Old buttons cannot overwrite new answers.

Telegram, Sarvam, Groq and Supabase receive the synthetic content relevant to their services. Pairing/consent is an engineering boundary for this demo, not a production patient identity system. The app does not retain audio files. Clinical content is unsigned: bot receipts contain a fixed demo result and operational status only. They never claim that a clinician was notified, generate treatment advice or send the draft emergency card. Real patient use is outside this implementation.

## Persistence and delivery behavior

Reports use stable IDs derived from the bot/update ID. Button drafts receive a stable ID when started. The same Supabase transaction stores source, structured check-in, evaluation and creation event. Migration 006 adds a service-only `saathi_telegram_submit` wrapper that preserves Telegram channel/external ID and prevents origin changes during extraction. Existing web APIs cannot accept a caller-supplied origin. All ten demo/channel RPCs deny PUBLIC, anon and authenticated execution; service_role is required.

Local files under `apps/web/.saathi-demo/` hold per-bot sessions, hashed invitation codes, consent, update offset, pending work, retry input and the last 100 delivery outcomes. Files are private (0600), atomically replaced and ignored by Git. No bot token is stored in them. Retry text/file IDs remain until replaced or `/stop`; use only invented content. This worker state must stay on the same host for recovery; it is not a distributed queue or a cloud backup. It contains Telegram chat identifiers, so do not share it.

State and planned reply actions are checkpointed before processing. The cursor advances only after processing and reply attempts are recorded. Restarted report processing uses the same idempotent IDs and extraction leases. A crash before transcription is saved can repeat a speech request; this is not an exactly-once provider-billing guarantee.

Before each send, its action is durably marked `sending`. Confirmed sends are recorded `sent`; rejected sends `failed`; timeouts/crashed in-flight sends `unknown`. Failed or unknown sends are **not automatically resent**, avoiding silent duplicates after ambiguous network outcomes. An explicit `/retry` requests a new receipt for the same report. Delivery outcomes are currently local; Supabase's report audit does not claim Telegram receipt delivery. Care-team paging, callback delivery and background escalation are not implemented.

If a crash leaves a `.worker.lock` or `.transaction.lock`, first confirm the worker process is stopped before removing that lock. Preserve the JSON state. Corrupt state fails closed and is not overwritten. Normal shutdown removes the worker lock.

## Verification

131 automated tests pass; type checking and the production build pass. The live Telegram report, origin and audit events survived a development-to-production server restart. Built browser assets contain none of the six configured server secrets. Hosted permission inspection confirmed all ten demo/channel RPCs remain service-only. Public intake routes reject caller-supplied Telegram origin metadata without invoking providers.

Automated tests cover pairing expiry/single-use behavior, consent, private sender checks, group rejection, stable IDs, stale buttons, partial answers, immediate RED submission, language selection, bounded voice download, path traversal rejection, secret-safe errors, webhook preservation, atomic state/restart, update deduplication and uncertain-delivery recovery. Database tests cover Telegram provenance, real channel storage, origin immutability and service-only grants. Live verification passed with @SaathiHelperBot: private pairing and consent, a user-sent invented text report, Groq extraction of W4 and four extra doses, R2 + A1 / RED, original evidence quotes, Telegram channel/external ID storage, consistent structured check-in fields, three audit events and a confirmed Telegram receipt. The browser showed the Telegram source and full rule traces. Report ID: `f3647eb0-e454-432e-90cb-dbabed5b4eeb`. Telegram voice download and button callbacks are covered by automated tests; a live Telegram voice/button session has not yet been verified.

Reference: [official Telegram Bot API](https://core.telegram.org/bots/api), especially getUpdates offsets, getWebhookInfo, getFile and callback queries.
