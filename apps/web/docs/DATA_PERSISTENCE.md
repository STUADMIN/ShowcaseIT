# Where ShowcaseIt stores data

## PostgreSQL (Prisma / `DATABASE_URL`)

Durable app data:

- **Users** — profile, notification toggles, **preferred workspace**, **recording mic default**, **UI prefs** (`ui_preferences` JSON, e.g. liquid glass).
- **Workspaces & members** — teams, roles.
- **Projects & guides** — guide metadata, **steps** (titles, descriptions, annotations, export flags, etc.).
- **Recordings** — metadata; **video/screenshot files** live in Supabase Storage (URLs in DB).
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

## Deploy checklist

- Set `DATABASE_URL` / `DIRECT_URL` and run **`npx prisma migrate deploy`** so all columns exist.
- Set Supabase env vars for auth and storage.
