# Marketing renders (recordings → branded / motion / AI video)

ShowcaseIt can produce **marketing-style outputs** from a screen recording in several pipelines:

| Mode | Worker behavior today |
|------|------------------------|
| `branded_screen` | **Implemented:** letterbox to 16:9 using Brand Kit **primary** as pad color, H.264 MP4, max duration cap (see options), upload to Supabase `recordings` bucket. |
| `branded_plus_motion` | Same as `branded_screen` for now; motion pass logged as future work. |
| `full_stack` | Same as `branded_screen` for now; motion + AI logged as future work. |
| `motion_walkthrough` | **Not implemented** — job fails with a clear message. |
| `ai_enhanced` | **Not implemented** — job fails with a clear message. |

## Data model

- Table: **`marketing_render_jobs`** (Prisma: `MarketingRenderJob`).
- Fields: `recordingId`, `userId`, `mode`, `status` (`queued` \| `processing` \| `ready` \| `failed`), `outputUrl`, `error`, `options` (JSON).

`options.maxSeconds` — optional number, clamped **10–600**, default **180** (ffmpeg `-t`).

## API

- `GET /api/recordings/[recordingId]/marketing-renders?userId=...` — list recent jobs.
- `POST /api/recordings/[recordingId]/marketing-renders` — body `{ userId, mode, options? }` — creates a **`queued`** job. **`motion_walkthrough`** and **`ai_enhanced`** return **400** until implemented (avoids jobs stuck in `queued` without a worker).
- `GET /api/marketing-renders/[jobId]?userId=...` — poll status.
- `POST /api/cron/marketing-renders` — header `Authorization: Bearer <CRON_SECRET>` — processes **one** queued job **only if not on Vercel** (or if `MARKETING_RENDER_VERCEL=1`). See below.

## Run the worker (recommended)

With the same **`.env` / `.env.local`** as the app (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, ffmpeg via `ffmpeg-static`):

**From the monorepo root** (recommended):

```bash
npm install
npm run worker:marketing
```

**Or from `apps/web`:**

```bash
cd apps/web
npm install
npm run worker:marketing
```

- **Loop** (default): polls every ~4s for `queued` jobs.
- **Single pass:** `npm run worker:marketing -- --once` (from root or `apps/web`)

`scripts/load-env.cjs` preloads `.env.local` then `.env` before Prisma runs.

## Vercel

- **`VERCEL=1`** and **`MARKETING_RENDER_VERCEL` not set:** queued jobs are **not** encoded on Vercel. `executeMarketingRenderJob` marks them **`failed`** with instructions if invoked; the **cron route returns `skipped: true`** without processing.
- **`MARKETING_RENDER_VERCEL=1`:** allows cron / inline processing on Vercel (only for **short** tests — timeouts and missing ffmpeg often break production).

Production: run **`worker:marketing`** on a small VM, GitHub Action, or Railway job against the **same Postgres + Supabase** credentials.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `MARKETING_RENDER_INLINE=1` | After `POST` job creation, run the processor **immediately** in the API process (OK on **local** dev; avoid long videos). |
| `MARKETING_RENDER_USE_STUB=1` | Force old “stub failed” behavior (tests). |
| `MARKETING_RENDER_VERCEL=1` | Allow ffmpeg path on Vercel (discouraged). |

## Implementation files

- `src/lib/marketing-render/run-job.ts` — download, ffmpeg, Supabase upload, Prisma updates.
- `src/lib/marketing-render/process-job.ts` — cron / inline entry, stub toggle.
- `src/scripts/marketing-render-worker.ts` — CLI poll loop.

## Deploy checklist

1. `npx prisma migrate deploy` (includes `marketing_render_jobs`).
2. **`npx prisma generate`** — client is emitted under **`apps/web/src/generated/prisma`** (see `schema.prisma` `output`) to reduce Windows **EPERM** on `node_modules/.prisma`. Restart `next dev` after generate.
3. Ensure Supabase bucket **`recordings`** allows service-role upload (same as screen uploads).
4. Run **`npm run worker:marketing`** (or equivalent) where ffmpeg and network access to `videoUrl` are available.
