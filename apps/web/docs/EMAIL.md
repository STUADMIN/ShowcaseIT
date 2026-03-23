# Email — Resend

ShowcaseIt sends **all application email** through **[Resend](https://resend.com)**.

## Environment variables

| Variable | Required for sending | Purpose |
|----------|----------------------|---------|
| `RESEND_API_KEY` | Yes | API key from Resend dashboard |
| `RESEND_FROM_EMAIL` | Yes | From address on a **verified domain** (e.g. `ShowcaseIt <updates@yourdomain.com>`) |

Without these, routes that send mail (e.g. weekly digest cron) **run but skip delivery** — check server logs.

## Current usage

- **Weekly digest** — `GET|POST /api/cron/weekly-digest` (Vercel cron + `CRON_SECRET`). See root `README.md`.

## Future (roadmap)

- Transactional: invites, password reset (if not fully delegated to Supabase), notifications.
- **Marketing campaigns** — same Resend account; lists/templates/scheduling per [ROADMAP_EPICS_OUTBOUND_VOICE.md](../../docs/ROADMAP_EPICS_OUTBOUND_VOICE.md) Epic 3.
- **Webhooks** — delivery/bounce/open/click → optional `POST /api/webhooks/resend` (to be implemented).

## Domain setup

Add and verify your sending domain in the Resend dashboard (SPF/DKIM) before production `RESEND_FROM_EMAIL`.
