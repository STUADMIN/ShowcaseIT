/**
 * If a Vercel project uses Root Directory "apps/desktop", the dashboard often runs
 * `npm run build:web` from this package. The Next.js site must be built from
 * `apps/web` (or the monorepo root), or Vercel will not run the Next runtime → 404.
 */
console.error(`
[Vercel] This package is Electron only — it cannot deploy the Next.js web app.

Fix: Vercel → Project → Settings → General:
  • Set "Root Directory" to:  apps/web
  • Clear custom Install / Build / Output overrides (use apps/web/vercel.json)

Or set Root Directory to the repository root (empty) and use the root vercel.json.

See docs/VERCEL.md in the repo.
`);
process.exit(1);
