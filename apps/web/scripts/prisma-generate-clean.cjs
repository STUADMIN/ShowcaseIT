/**
 * Best-effort remove .prisma folders, then always run prisma generate (cross-platform).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const webRoot = path.join(__dirname, '..');
const monorepoRoot = path.join(webRoot, '..', '..');

const genClient = path.join(webRoot, 'src', 'generated', 'prisma');

const candidates = [
  path.join(monorepoRoot, 'node_modules', '.prisma'),
  path.join(webRoot, 'node_modules', '.prisma'),
  genClient,
];

for (const dir of candidates) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log('Removed:', dir);
    }
  } catch (e) {
    console.warn('Could not remove (stop next dev / Cursor preview, then retry):', dir);
    console.warn(String(e && e.message ? e.message : e));
  }
}

console.log('Running prisma generate…');
execSync('npx prisma generate', { stdio: 'inherit', cwd: webRoot, env: process.env });
