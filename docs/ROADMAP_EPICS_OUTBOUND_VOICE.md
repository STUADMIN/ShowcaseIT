# Roadmap epics: AI voiceover, scheduled publishing, email campaigns

This document turns three product directions into **concrete epics** you can implement in order. Estimated effort is relative (S/M/L).

## Email provider — **Resend**

All **product email** (transactional today: weekly digest; future: invites, campaign sends) is implemented **only via [Resend](https://resend.com)** — APIs, batch/broadcast features as needed, and **webhooks** for delivery/open/click events when you add analytics.

**Env (already used by digest cron):** `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (verified domain in Resend). See `apps/web/docs/EMAIL.md`.

---

## Epic 1 — High-quality AI voiceover (guides & recordings) — **do first**

**Goal:** User generates **natural TTS** from guide/recording copy, previews voices, and gets a **mixed asset** (new video or audio track) suitable for exports and marketing renders.

### Phase 1A — Script source & job model (S)

- **Script builder**
  - From **Guide:** concatenate step titles + descriptions (respect `includeInExport`), optional intro/outro fields on guide or brand kit.
  - From **Recording (no guide):** use recording title + optional user “narration script” textarea; later: auto-summary (LLM) — optional Phase 1B.
- **Postgres (Prisma)**
  - New model e.g. `VoiceoverJob` / `TtsRenderJob`:
    - `id`, `userId`, `sourceType` (`guide` | `recording`), `sourceId`, `status` (`queued` | `processing` | `ready` | `failed`)
    - `provider` (`openai_tts` | `elevenlabs` | …), `voiceId`, `locale` / `model`
    - `scriptText` (snapshot), `audioUrl` (Supabase Storage), `durationMs`, `error`, `options` JSON (speed, stability, etc.)
    - `createdAt`, `updatedAt`
  - Optional: `guides.aiVoiceoverUrl` or keep all in job table only (cleaner).

### Phase 1B — TTS service (M)

- **Provider choice (pick one for v1)**  
  - **OpenAI TTS API** — simple, good quality, predictable billing.  
  - **ElevenLabs** — often “best” perceived quality; more cost/complexity.  
  - **Azure / Google / Amazon Polly** — enterprise options.
- **`apps/ai-service` (Python)**  
  - New route `POST /tts/synthesize` — body: `{ text, voice_id, format: "mp3"|"wav" }` → returns bytes or temp URL.  
  - Env: provider API keys **server-side only** (never `NEXT_PUBLIC_`).
- **Alternative:** call provider **directly from Next.js Route Handler** with service key if you want to skip Python for TTS only (tradeoff: split vs one AI service).

### Phase 1C — Mux with video (M)

- **Input:** original recording `videoUrl` (WebM/MP4) + generated `audioUrl`.  
- **Worker or long-running job** (same pattern as `worker:marketing`): ffmpeg merge:
  - Replace or mix audio tracks; handle duration mismatch (pad video or trim audio with rules).
- **Output:** upload to Supabase; store URL on `VoiceoverJob` or update recording metadata (versioning: `aiVoiceoverMixUrl` vs overwrite).

### Phase 1D — UI (S–M)

- **Guide editor** or **Recording row:** “AI voiceover” → modal: edit script, voice picker, “Generate” → poll job → play preview → “Attach to export / marketing pipeline.”
- Reuse patterns from **Marketing export** modal (job create + poll).

### Phase 1E — Quality & product polish (ongoing)

- Chunk long scripts (provider limits); normalize SSML/pauses if supported.
- **SSML / markers** for step boundaries → future sync with step transitions in video.

**Dependencies:** `SUPABASE_SERVICE_ROLE_KEY`, storage bucket policy, ffmpeg on worker, provider API key.

**Definition of done (v1):** User generates TTS from guide text, downloads or sees mixed video link, no crash on videos up to N minutes (document limit).

---

## Epic 2 — Scheduled pushes (website, LinkedIn, etc.)

**Goal:** **Queue** outbound posts with `runAt`, retry, and per-channel adapters.

### Phase 2A — Core scheduler (M)

- **Model `ScheduledPublish`** (or generic `OutboundJob`):
  - `channel` (`linkedin` | `x` | `facebook` | `webhook` | …)
  - `payload` JSON (text, media URLs, link to guide/export)
  - `runAt`, `status`, `attempts`, `lastError`, `externalId` / `externalUrl`
  - `userId` / `workspaceId`, `createdBy`
- **Cron** (Vercel Cron or worker): `POST /api/cron/scheduled-publishes` — claim due rows, mark `processing`, call adapter, mark `sent` / `failed`.

### Phase 2B — LinkedIn (L)

- LinkedIn **Marketing API** / Share API — OAuth 2.0, app review, company page vs personal.
- **Outstanding product work:** which asset (link preview, PDF, video snippet)? Map from Export or Marketing render output.

### Phase 2C — “Website” (M–L)

- Usually **not** one API: **webhook** to customer CMS (Contentful, Sanity, custom) or **static deploy hook** (Vercel deploy, Git commit).  
- Define a **generic webhook** channel first (`payload` + HMAC secret); specialize later.

### Phase 2D — Publish UI

- Calendar / list view, “Schedule post,” timezone, cancel/reschedule.

**Dependencies:** OAuth apps per network, CRON_SECRET, idempotency keys.

---

## Epic 3 — Email marketing campaigns

**Goal:** Beyond **transactional** (digest, invites), support **campaigns** (lists, templates, sends).

### Phase 3A — Audience & consent (L)

- **Lists / segments** (workspace-scoped): tags, CSV import, unsubscribe list.
- **Compliance:** unsubscribe link, physical address if required, double opt-in where needed.

### Phase 3B — Composer & sends (M)

- Template storage (HTML + variables), test send, schedule send (reuse Epic 2 scheduler pattern + **Resend** send/broadcast APIs).

### Phase 3C — Analytics (M)

- Opens/clicks via **Resend webhooks** → verify signature → store events in Postgres.

**No alternate ESP in scope** for v1–v2; stay on Resend for simplicity and one billing/dashboard.

---

## Suggested implementation order

1. **Epic 1** — AI voiceover (highest differentiation, reuses job + worker + storage patterns).  
2. **Epic 2** — One channel + scheduler (**webhook** or **LinkedIn** after OAuth is ready).  
3. **Epic 3** — Campaign MVP (one list + one template + batch send).

---

## Traceability to current codebase

| Area | Today | Next step |
|------|--------|-----------|
| Jobs + workers | `marketing_render_jobs`, `worker:marketing`, cron guards | Clone pattern for `VoiceoverJob` / `ScheduledPublish` |
| Storage | Supabase `recordings` | New prefix e.g. `tts/` or `voiceovers/` |
| AI | `apps/ai-service` (blur, style, transcribe placeholder) | Add `/tts/synthesize` or use Node provider SDK |
| Publish UI | Confluence live; social toggles placeholder | Wire Epic 2 adapters behind same “Publish” surface |
| Email | Weekly digest via **Resend** (`RESEND_*` env) | Epic 3: lists/templates/campaigns on same Resend stack |

---

*Maintainers: update this file when epics ship or scope changes.*
