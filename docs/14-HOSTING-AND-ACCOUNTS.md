# 14 · Hosting, accounts and the serverless WhatsApp worker (3 Nov 2026)

Saathi runs entirely on free tiers with no computer left on.

## Where things run
| Part | Where | Free-tier note |
|---|---|---|
| Web app and APIs | Vercel Hobby, project `saathi`, root `apps/web`: https://saathi-mauve.vercel.app | Non-commercial use; pauses at limits, never bills |
| Database, auth tables, worker state | Supabase (existing project) | Free projects pause after a week without API traffic; the worker schedule keeps it active |
| WhatsApp receiver | Supabase Edge Function `whatsapp-webhook` | Verifies Meta's signature, verifies `LOGIN` codes, stores the inbox, wakes the worker |
| WhatsApp worker | Vercel function `/api/worker` | Woken by each incoming message, and every 2 minutes by Supabase pg_cron (`pnpm supabase:schedule`), plus a daily Vercel cron as a backstop |

The worker's state (chat bindings and consent, on-call registration, reminders) moved from JSON files to `saathi_worker_state` with optimistic versions; a lease (`saathi_worker_lease`) keeps one pass at a time. `pnpm whatsapp:move-state` copied the local files once. `pnpm whatsapp:run --send` still works locally with `SAATHI_WORKER_STATE=supabase` but must not run alongside the cloud worker for long; the lease is only taken by cloud passes.

## Sign-in
- **One-click demo accounts** for judges: doctor, call manager and family (Ramesh K., synthetic).
- **Mobile via WhatsApp ("reverse OTP")**: the site shows `LOGIN 123456`; the person sends it from WhatsApp (link or QR). The receiver marks the code verified for the sender's number. Inbound messages are free, so no SMS provider is needed. Codes last 10 minutes and sign in once.
- **Email and password**: scrypt hashes; works for relatives abroad. No email is sent (no free mail provider is configured), so addresses are not verified and there is no password reset yet.
- **Sign-up**: staff need the organisation invite code (`SAATHI_ORG_CODE`, demo `SAATHI-DEMO`, shown on the page for judges); families need the patient's Saathi ID (demo `SA-QFH9YB`). Everyone accepts the draft service terms.
- Sessions are HMAC-signed cookies (12 h). Every API route checks the role. Password-guessing limits are per serverless instance.
- The call log now records the signed-in person's name (`saathi_demo_transition_as` / `saathi_demo_close_as`).

## Known limits
- Meta's **test number** can only send to 5 registered phones. Judges can sign in by sending `LOGIN` from any WhatsApp (inbound), but only registered phones receive Saathi's replies. A real number with a display name removes this. Whether Meta delivers webhooks from numbers that have no role on the app depends on the app being in Live mode.
- Replies outside WhatsApp's 24-hour window are recorded, never sent as paid templates.
- Saathi's fixed replies are English until Dr. Rao checks the Hindi and Kannada wording. Families can write or speak in English, Hindi or Kannada: typed messages are labelled by script and voice notes use Sarvam's language auto-detection.

## Commands
`pnpm supabase:accounts` (migration 010) · `pnpm supabase:schedule` (pg_cron, run by Tushar) · `pnpm whatsapp:deploy --publish --replace` (receiver and its secrets) · `npx vercel deploy --prod` (from the repository root; `.vercelignore` keeps secrets out).
