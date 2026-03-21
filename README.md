# ShowcaseIt

Beautiful branded user manuals from screen recordings.

## Architecture

ShowcaseIt is a hybrid platform:

- **Web App** (`apps/web`) — Next.js 16 editor for managing guides, branding, export, and publishing
- **Desktop Agent** (`apps/desktop`) — Electron app for screen recording, mouse tracking, and capture
- **AI Service** (`apps/ai-service`) — Python FastAPI microservice for style transfer, frame extraction, and transcription

## Getting Started

### Prerequisites

- Node.js >= 20
- Python >= 3.11 (for AI service)

### Install

```bash
cd showcaseit
npm install
```

### Run the Web App

```bash
cd apps/web
npx next dev
```

Open http://localhost:3000

### Run the Desktop Agent

```bash
cd apps/desktop
npx electron-vite dev
```

### Run the AI Service

```bash
cd apps/ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Project Structure

```
showcaseit/
  apps/
    desktop/          # Electron capture agent
    web/              # Next.js web application
    ai-service/       # Python FastAPI microservice
  packages/
    shared/           # Shared TypeScript types and constants
```

## Notifications & weekly digest

- **Settings → Notifications** persists to Postgres (`users.notify_*` columns).
- **Weekly digest** emails are sent by `POST|GET /api/cron/weekly-digest` (schedule in `apps/web/vercel.json` for Vercel).
- Set **`CRON_SECRET`** and call the route with header `Authorization: Bearer <CRON_SECRET>`.
- Optional: **`RESEND_API_KEY`** + **`RESEND_FROM_EMAIL`** to deliver email; without them the cron still runs but skips sending (see server logs).
- Local test: `curl -X POST "http://localhost:3000/api/cron/weekly-digest?dryRun=1" -H "Authorization: Bearer dev"` (with `CRON_SECRET=dev` in `.env.local`).

After pulling schema changes:

```bash
cd apps/web
npx prisma migrate deploy
npx prisma db seed
```

## GitHub

See [docs/GITHUB.md](docs/GITHUB.md) for creating the remote and first push.

## Features

- Screen recording with mouse tracking and click detection
- Voiceover recording with auto-transcription
- Step-by-step guide generation from recordings
- Interactive HTML walkthroughs with animated mouse cursor
- Brand kit system (colors, fonts, logos)
- Visual style engine (clean, corporate, modern, minimal)
- Blur/redact sensitive screen regions
- Export to HTML, PDF, Word
- Publish to YouTube, LinkedIn, X, Facebook, Instagram
