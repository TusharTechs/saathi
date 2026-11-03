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
- **For judges:** one-click buttons for each view, or one public test login (in `apps/web/lib/judge-accounts.ts`, shown on the sign-in page, created by `pnpm accounts:seed-judges`). Judge sessions show a "Judge view" bar to switch between doctor, call manager and family (Ramesh K., synthetic) without signing in again. Real accounts cannot switch.
- **Mobile via WhatsApp:** the person types their number and taps *Verify with WhatsApp*; WhatsApp opens (automatically on phones, by QR on computers) with `LOGIN 123456` already typed, and they tap Send. The code only verifies if it arrives from the number they typed (migration 011); otherwise the page says it came from a different number. Messages to a business are free, so no SMS provider is needed. Codes last 10 minutes and sign in once.
- **Why not a code sent to the phone:** SMS in India needs a paid provider and DLT registration, and Firebase phone auth needs the paid Blaze plan. WhatsApp codes sent by Saathi need a paid authentication template (about ₹0.12 each), a card on the WhatsApp account and, on the test number, only reach 5 registered phones.
- **Email and password**: scrypt hashes; works for relatives abroad. No email is sent (no free mail provider is configured), so addresses are not verified and there is no password reset yet.
- **Sign-up**: staff need the organisation invite code (`SAATHI_ORG_CODE`, demo `SAATHI-DEMO`, shown on the page for judges); families need the patient's Saathi ID (demo `SA-QFH9YB`). Everyone accepts the draft service terms.
- Sessions are HMAC-signed cookies (12 h). Every API route checks the role. Password-guessing limits are per serverless instance.
- The call log now records the signed-in person's name (`saathi_demo_transition_as` / `saathi_demo_close_as`).

## Known limits
- Meta's **test number** can only send to 5 registered phones. Judges can sign in by sending `LOGIN` from any WhatsApp (inbound), but only registered phones receive Saathi's replies. A real number with a display name removes this. Whether Meta delivers webhooks from numbers that have no role on the app depends on the app being in Live mode.
- Replies outside WhatsApp's 24-hour window are recorded, never sent as paid templates.
- Saathi's fixed replies are English until Dr. Rao checks the Hindi and Kannada wording. Families can write or speak in English, Hindi or Kannada: typed messages are labelled by script and voice notes use Sarvam's language auto-detection.

## Commands
`pnpm supabase:accounts` (migration 010) · `pnpm supabase:login-phone` (migration 011) · `pnpm accounts:seed-judges` · `pnpm supabase:schedule` (pg_cron; active since 3 Nov, every 2 minutes) · `pnpm whatsapp:deploy --publish --replace` (receiver and its secrets) · `npx vercel deploy --prod` (from the repository root; `.vercelignore` keeps secrets out).
