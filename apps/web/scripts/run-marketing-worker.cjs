/**
 * Loads .env then runs the TS worker via tsx (works when tsx is hoisted to repo root).
 * Usage: npm run worker:marketing [-- --once]
 */
require('./load-env.cjs');

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

function findTsxCli() {
  const roots = [
    path.join(__dirname, '..'),
    path.join(__dirname, '..', '..'),
  ];
  for (const root of roots) {
    const p = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'tsx not found. From repo root run: npm install (ensure "tsx" is a devDependency of @showcaseit/web).'
  );
}

const cwd = path.join(__dirname, '..');
const extra = process.argv.slice(2);
const r = spawnSync(process.execPath, [findTsxCli(), 'src/scripts/marketing-render-worker.ts', ...extra], {
  cwd,
  stdio: 'inherit',
  env: process.env,
});

if (r.status === null) process.exit(1);
process.exit(r.status);
