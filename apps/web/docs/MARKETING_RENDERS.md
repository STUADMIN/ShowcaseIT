# Marketing renders (recordings → branded / motion / AI video)

ShowcaseIt can produce **marketing-style outputs** from a screen recording in several pipelines:

| Mode | Worker behavior today |
|------|------------------------|
| `branded_screen` | Letterbox to 16:9 using Brand Kit **primary** as pad color, H.264 MP4, max duration cap (see options), upload to Supabase `recordings` bucket. |
| `motion_walkthrough` | Same letterbox as above, plus **short white flashes** at **click** and **step-marker** times (from `recordings.click_events`, timestamps in ms). Desktop captures with real x/y work best; browser markers use the **center** of the framed content. |
| `branded_plus_motion` | Branded letterbox **+** the same click/step highlight pass. |
| `full_stack` | Branded + highlights + a light **ffmpeg grade** (`eq` saturation/contrast/brightness). **Neural** “AI style” on full video via `ai-service` is still future work. |
| `ai_enhanced` | Downloads a **finished** marketing MP4 (another job on the **same** recording) and runs the same light **ffmpeg grade**. Picks the newest ready job in modes `branded_screen`, `motion_walkthrough`, or `branded_plus_motion`, or set `options.baseMarketingJobId` to a specific ready job. Output object key: `ai-polish.mp4`. |

## Data model

- Table: **`marketing_render_jobs`** (Prisma: `MarketingRenderJob`).
- Fields: `recordingId`, `userId`, `mode`, `status` (`queued` \| `processing` \| `ready` \| `failed`), `outputUrl`, `error`, `options` (JSON).

`options.maxSeconds` — optional number, clamped **10–600**, default **180** (ffmpeg `-t`).

`options.baseMarketingJobId` — optional string (UUID). For **`ai_enhanced`** only: use this **ready** job’s `outputUrl` as the source instead of auto-picking the latest eligible job.

## API

- `GET /api/recordings/[recordingId]/marketing-renders?userId=...` — list recent jobs.
- `POST /api/recordings/[recordingId]/marketing-renders` — body `{ userId, mode, options? }` — creates a **`queued`** job for any supported mode. For **`ai_enhanced`**, the API returns **400** if there is no eligible **ready** base job (same recording) so you don’t enqueue a job that cannot run.
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
- `src/lib/marketing-render/click-highlights-vf.ts` — click / step-marker → ffmpeg `drawbox` chain.
- `src/lib/marketing-render/process-job.ts` — cron / inline entry, stub toggle.
- `src/scripts/marketing-render-worker.ts` — CLI poll loop.

## Deploy checklist

1. `npx prisma migrate deploy` (includes `marketing_render_jobs`).
2. **`npx prisma generate`** — client is emitted under **`apps/web/src/generated/prisma`** (see `schema.prisma` `output`) to reduce Windows **EPERM** on `node_modules/.prisma`. Restart `next dev` after generate.
3. Ensure Supabase bucket **`recordings`** allows service-role upload (same as screen uploads).
4. Run **`npm run worker:marketing`** (or equivalent) where ffmpeg and network access to `videoUrl` are available.
