# Deploying the web app to Vercel

The **Next.js app** lives in `apps/web`, but the repo is an **npm workspace monorepo**. Vercel must run installs and builds from the **repository root** so `npm run build:web` and `@showcaseit/shared` resolve correctly.

## Common failure: `npm run build:web` exited with 1

If the Vercel project’s **Root Directory** is set to `apps/desktop` (or any folder that is not the monorepo root), that folder’s `package.json` **does not define** `build:web`. The command fails immediately.

**Fix (pick one):**

1. **Recommended — separate project for the website**  
   - New Vercel project → import the same GitHub repo.  
   - **Root Directory:** leave empty or `.` (repository root).  
   - The root [`vercel.json`](../vercel.json) already sets `installCommand`, `buildCommand`, and `outputDirectory`.

2. **Adjust an existing project**  
   - **Settings → General → Root Directory** → clear it (must be the repo root, not `apps/desktop`).  
   - **Build & Development Settings** should use:
     - Install: `npm install` (or default)
     - Build: `npm run build:web`
     - Output: `apps/web/.next`
     - Framework: can stay “Other” / Next if auto-detected from output.

3. **Do not** point the **web** deploy at `apps/desktop`. That package is Electron (`electron-vite build`), not Next.js.

## Environment variables

Configure these in Vercel for **Production** (and Preview if needed). Exact names are defined in your app’s `.env.example` / code; typical ones include:

- `DATABASE_URL` — Postgres (Prisma)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `CRON_SECRET` (weekly digest cron)
- Optional: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

After schema changes, run migrations against the production DB (e.g. `npx prisma migrate deploy` in `apps/web` with `DATABASE_URL` set).

## Project naming

A project named `showcase-it-desktop` is fine **only if** its root directory is still the **monorepo root** for a web deployment. If it was created for Electron, create another Vercel project for the **web** app or fix Root Directory as above.

### `showcase-it-desktop` with Root Directory `apps/desktop`

If the Vercel project’s **Root Directory** is set to `apps/desktop` (common for a misnamed “desktop” project), the default `npm run build:web` fails because that script exists only on the **repository root**. This repo includes [`apps/desktop/vercel.json`](../apps/desktop/vercel.json), which runs `npm install` and `npm run build:web` from the monorepo root and copies `apps/web/.next` into `apps/desktop/.vercel-next-output` so the deploy matches what the root [`vercel.json`](../vercel.json) does.

**Preferred long-term fix:** set the project’s **Root Directory** to the repo root (empty / `.`) and rely on the root `vercel.json` only—no copy step.
