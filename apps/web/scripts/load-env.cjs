/**
 * Preload for CLI workers so DATABASE_URL / Supabase exist before Prisma loads.
 * Usage: node -r ./scripts/load-env.cjs …
 */
const path = require('path');
const fs = require('fs');

try {
  const dotenv = require('dotenv');
  const root = path.join(__dirname, '..');
  for (const name of ['.env.local', '.env']) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) {
      dotenv.config({ path: p, override: false });
    }
  }
} catch {
  /* dotenv optional */
}
