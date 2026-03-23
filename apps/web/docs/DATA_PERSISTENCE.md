# Where ShowcaseIt stores data

## PostgreSQL (Prisma / `DATABASE_URL`)

The Prisma client is generated into **`src/generated/prisma`** (gitignored) so `npx prisma generate` does not fight Windows file locks on hoisted `node_modules/.prisma`. Imports use `@/generated/prisma` instead of `@prisma/client`.

Durable app data:

- **Users** — profile, notification toggles, **preferred workspace**, **recording mic default**, **UI prefs** (`ui_preferences` JSON, e.g. liquid glass).
- **Workspaces & members** — teams, roles.
- **Projects & guides** — guide metadata, **steps** (titles, descriptions, annotations, export flags, etc.).
- **Recordings** — metadata; **video/screenshot files** live in Supabase Storage (URLs in DB).
- **Marketing render jobs** — `marketing_render_jobs` (queued → processing → ready/fail); **output files** will live in storage when a worker is implemented (see `MARKETING_RENDERS.md`).
- **Brand kits** — colors, logos, banners, social assets.
- **Confluence** — `workspaces.confluence_integration` (connection settings only).
- **Publish logs** — Confluence publish history.

## Supabase Auth — **cookies** (by design)

Sign-in state uses **Supabase** session cookies (via `@supabase/ssr`). Sessions are **not** duplicated in your Postgres `users` table; that’s normal and recommended for Supabase.

## Browser `localStorage` (legacy / guest only)

| Key | Purpose |
|-----|--------|
| `showcaseit:activeWorkspaceId` | **Logged-out / dev only.** Signed-in users use `users.preferred_workspace_id`. |
| `showcaseit:confluence:v1:*` | **Read once** to migrate old Confluence settings into the DB, then removed. **No new writes.** |
| `showcaseit:liquid-glass-prefs` | **Logged-out / dev only** or one-time migrate to `users.ui_preferences`. |
| `showcaseit-recording-mic-enabled` | **Logged-out only**; signed-in users use `users.recording_mic_enabled`. |

## Editor & modals

- **Step fields** (description, annotations, etc.) — saved with existing `PATCH` calls as you edit.
- **Guide title** — debounced save (~900ms), **blur**, **tab hide** (`visibilitychange` / `pagehide` / `beforeunload` best-effort flush).
- **Ephemeral UI** — which modal is open, scroll position in a panel, etc. stays in React state until you interact; that’s intentional to keep the UI simple.

## Confluence pages

Published pages live in **Atlassian Confluence**, not in ShowcaseIt’s database. We only store integration credentials and optional publish logs.

## Email (Resend)

Product email uses **Resend** only. Env vars and behavior: [`EMAIL.md`](./EMAIL.md).

## Deploy checklist

- Set `DATABASE_URL` / `DIRECT_URL` and run **`npx prisma migrate deploy`** so all columns exist.
- Set Supabase env vars for auth and storage.
- For outbound email: `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (see `EMAIL.md`).
