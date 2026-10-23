# Voice and text reports

Completed 23 October 2026. The local synthetic dashboard accepts typed reports and short audio recordings/uploads in English, Hindi and Kannada. Your configured Sarvam, Groq and Supabase credentials worked in live synthetic checks; no further credentials are needed for this phase.

## Try it

Run `pnpm dev`, open http://127.0.0.1:3000 and choose **Caregiver check-in**. Select a synthetic patient and report language. Record up to 25 seconds, upload a supported clip of at most 30 seconds/2 MB, or choose **Type a report**. Confirm the input is invented before submitting. Microphone recording requires browser permission; upload and text work without it.

Only invented reports belong in this prototype. Audio goes to Sarvam; transcripts go to Groq and are stored with observations, evidence quotes, rule traces and events in Supabase. The application does not retain audio in a database or file. Provider-side handling follows each provider's own policies. The local audio preview remains in the browser until navigation/replacement; no automatic playback occurs.

## Processing and safety behavior

1. Sarvam speech-to-text uses `saaras:v4`, verbatim mode and the selected language. Supported containers are WAV, WebM, Ogg, MP3 and M4A. Byte signatures and size are checked; WAV duration is checked locally, other container/codec durations are validated by Sarvam.
2. After transcription (or immediately for text), persist the source and run the independent draft keyword safety net **before** requesting structured extraction. The pending report is visible in the queue.
3. Groq's `openai/gpt-oss-120b` uses a strict JSON schema. It extracts observations only. Every retained observation must have a typed value, confidence and an exact contiguous quote from the source. Missing facts stay unknown. Invalid responses fail closed to human review.
4. The deterministic adult demo protocol evaluates validated observations. Narrative reports always need human review and cannot become GREEN. Existing RED flags and previously raised reasons are retained. If extraction raises the tier after acknowledgement/resolution, the report reopens and resets its demo escalation interval.
5. Transcript, structured check-in fields, evaluation and audit changes persist in Supabase. Failed extraction retains the source and safety flags; the queue offers **Retry extraction**. It does not retranscribe audio already checkpointed.

The model does not diagnose, select the tier or generate family guidance. The keyword list is incomplete and deliberately conservative about negation. Exact quotes establish provenance, not semantic correctness. These checks are engineering tests, not evidence of clinical accuracy or multilingual validation. Protocol approval, language review and the paediatric pack remain outstanding.

## Retry and concurrency

A browser attempt retains its request ID and unchanged payload for a retry. Completed duplicates return the same report without another model call. Extraction uses a database lease lasting 90 seconds; overlapping jobs cannot both complete or overwrite source evidence. Expired leases can be retried. Higher-tier results reset acknowledgement atomically; revision checks still protect care-team actions.

Providers are not retried automatically. A speech failure occurs before a report can be saved: retain the clip and retry or use text/buttons. A model failure occurs after saving, so check the queue and retry extraction there. Closing a browser after an ambiguous timeout can lose the client request ID: inspect the queue before submitting a new report. Two simultaneous audio submissions before transcription is saved can each call Sarvam; post-transcription extraction is deduplicated. There is no background recovery worker.

## Configuration and migrations

Set `SAATHI_STORAGE=supabase`, `SARVAM_API_KEY`, `GROQ_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` in `apps/web/.env.local`, then restart. Legacy valid service-role keys are also supported. All provider and server keys remain server-side. Do not commit the environment file.

For an existing project with migrations 001–004, run `pnpm supabase:analysis` with the management access token configured. Migration 005 adds extraction leases and lookup/claim/complete RPCs. All nine demo RPCs deny PUBLIC, anon and authenticated execution and allow service_role only. Fresh `pnpm supabase:apply` includes all five migrations and seed. This is still loopback-only with a simulated doctor; public deployment requires real authentication and authorization.

## Verification

- 108 automated tests pass, including invalid/translated evidence rejection, schema/type errors, empty transcription, provider failures, no automatic retries, audio validation, durable keyword flags, duplicate extraction claims, expired/wrong leases, source immutability, reopening and transactional check-in updates.
- Type checking and production build pass. All four live reports and their 12 audit events survived a restart into the production server. Completed concurrent retries returned the existing report without extra events. Browser assets and staged source were checked against the configured secret values.
- Live English text and generated English WAV both completed speech/extraction as applicable, with W4 and four extra doses producing R2 + A1 and RED. Hindi and Kannada text both completed with original-script evidence and the same expected observations. Four synthetic reports remain as inspectable demo history.
- Browser submission verified the Hindi source, original quotes, complete status, matched rules and creation/start/completion audit events.
- Hosted inspection confirmed all nine demo RPCs are executable only by service_role, not anon/authenticated.

To repeat a live check against a running app: `pnpm exec tsx eval/narrative-smoke.ts`. This creates three synthetic text reports and sends three Groq requests. Optionally set `SAATHI_EVAL_AUDIO` to a synthetic WAV path to also exercise Sarvam and one more extraction. Unit tests never use service credentials.

WhatsApp/Telegram, real login, Realtime, background escalation, notifications and clinical approval remain future phases.
