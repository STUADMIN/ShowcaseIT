# Deploying the web app to Vercel

The **Next.js app** lives in `apps/web`, but the repo is an **npm workspace monorepo**. Vercel must run installs and builds from the **repository root** so `npm run build:web` and `@showcaseit/shared` resolve correctly.

## Common failure: `npm run build:web` exited with 1

If the Vercel project’s **Root Directory** is set to `apps/desktop` (or any folder that is not the monorepo root), that folder’s `package.json` **does not define** `build:web`. The command fails immediately.

**Fix (pick one):**

1. **Recommended — Root Directory `apps/web` (fixes Next.js routing on Vercel)**  
   - **Settings → General → Root Directory** → `apps/web`.  
   - Clear custom Install / Build / Output overrides in **Build & Development Settings** so Vercel uses [`apps/web/vercel.json`](../apps/web/vercel.json): install from monorepo root, then `npm run build` in the web app.  
   - Framework should detect **Next.js** from `apps/web/package.json`.  
   - Do **not** set Output Directory manually unless you know what you’re doing—Next deployments need Vercel’s Next builder, not a copied `.next` folder from another path.

2. **Alternative — repository root**  
   - **Root Directory:** empty or `.`.  
   - The root [`vercel.json`](../vercel.json) sets `installCommand`, `buildCommand`, and `outputDirectory: apps/web/.next`.

3. **Do not** use **`apps/desktop`** as the Vercel root for the website. That package is Electron only. Pointing a project named `showcase-it-desktop` at `apps/desktop` leads to failed builds or **`404: NOT_FOUND`** (Vercel does not run Next.js routing when the app root is wrong).

### `404: NOT_FOUND` on `*.vercel.app`

Usually the deployment is **not** a valid Next.js app output: e.g. Root Directory was `apps/desktop` and only static build artifacts were uploaded. Set **Root Directory** to **`apps/web`** (or repo root as in option 2) and redeploy.

## Environment variables

Configure these in Vercel for **Production** (and Preview if needed). Exact names are defined in your app’s `.env.example` / code; typical ones include:

- `DATABASE_URL` — Postgres (Prisma)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `CRON_SECRET` (weekly digest cron)
- Optional: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

After schema changes, run migrations against the production DB (e.g. `npx prisma migrate deploy` in `apps/web` with `DATABASE_URL` set).

## Project naming

A Vercel project named `showcase-it-desktop` is only a label. For the **Next.js site**, set **Root Directory** to **`apps/web`** or the repo root—never `apps/desktop`.
