/**
 * Remove generated Prisma engine folder so `prisma generate` can rewrite DLLs
 * (fixes EPERM rename on Windows when something held the old file).
 */
const fs = require('fs');
const path = require('path');

const webRoot = path.join(__dirname, '..');
const monorepoRoot = path.join(webRoot, '..', '..');

const candidates = [
  path.join(monorepoRoot, 'node_modules', '.prisma'),
  path.join(webRoot, 'node_modules', '.prisma'),
];

for (const dir of candidates) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log('Removed:', dir);
    }
  } catch (e) {
    // Windows: DLL still locked by next dev / antivirus — still run `prisma generate` after this script.
    console.warn('Could not remove (close Node/antivirus, then delete manually):', dir);
    console.warn(String(e && e.message ? e.message : e));
  }
}
