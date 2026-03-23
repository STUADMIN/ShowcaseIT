/**
 * Loads .env then runs the TS worker via tsx (works when tsx is hoisted to repo root).
 * Usage: npm run worker:marketing [-- --once]
 */
require('./load-env.cjs');

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

function findTsxCli() {
  const appRoot = path.join(__dirname, '..');
  const roots = [appRoot, path.join(appRoot, '..', '..')];
  for (const root of roots) {
    const direct = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    if (fs.existsSync(direct)) return direct;
    try {
      const pkgJson = require.resolve('tsx/package.json', { paths: [root] });
      const cli = path.join(path.dirname(pkgJson), 'dist', 'cli.mjs');
      if (fs.existsSync(cli)) return cli;
    } catch {
      /* not resolvable from this root */
    }
  }
  return null;
}

const cwd = path.join(__dirname, '..');
const extra = process.argv.slice(2);
const workerEntry = 'src/scripts/marketing-render-worker.ts';

const tsxCli = findTsxCli();
let r;
if (tsxCli) {
  r = spawnSync(process.execPath, [tsxCli, workerEntry, ...extra], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
} else {
  // Local tsx missing (e.g. npm install failed). npx can run the workspace devDependency.
  r = spawnSync('npx', ['tsx', workerEntry, ...extra], {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (r.status === 1 && r.error) {
    console.error(
      '\nCould not run tsx. From repo root: npm install\n' +
        '(If Prisma EPERM: stop next dev / close editors locking apps/web/src/generated/prisma, then retry.)\n'
    );
  }
}

if (r.status === null) process.exit(1);
process.exit(r.status ?? 1);
