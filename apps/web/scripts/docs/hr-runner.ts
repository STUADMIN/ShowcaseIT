#!/usr/bin/env tsx
/**
 * hr-runner — Playwright browser automation that walks the HR manifest,
 * records video of each tour on the Xertilox HR Platform, uploads the
 * video to ShowcaseIT as a Recording, and takes key screenshots.
 *
 * Environment:
 *   HR_BASE_URL              — default http://localhost:3001
 *   DOCS_BASE_URL            — ShowcaseIT app, default http://localhost:3000
 *   DOCS_AUTH_EMAIL           — Supabase sign-in for ShowcaseIT uploads
 *   DOCS_AUTH_PASSWORD        — Supabase sign-in password
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
const webRoot = path.resolve(__dirname, '..', '..');
for (const name of ['.env.local', '.env']) {
  dotenv.config({ path: path.join(webRoot, name), override: false });
}

import * as fs from 'fs';
import * as os from 'os';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { PrismaClient } from '../../src/generated/prisma';
import { hrManifest, filterHREntries, HR_CREDENTIALS, type HRDocEntry, type HRRole, type SetupContext } from './hr-manifest';
import type { TourStep, StepResult, EntryReport, RunReport } from './types';

const HR_BASE_URL = process.env.HR_BASE_URL || 'http://localhost:3001';
const REPORT_PATH = path.resolve(__dirname, '.hr-report.json');
const VIEWPORT = { width: 1440, height: 900 };

/* ------------------------------------------------------------------ */
/*  HR platform database connection (for setup hooks)                  */
/* ------------------------------------------------------------------ */

function getHRDatabaseUrl(): string | null {
  if (process.env.HR_DATABASE_URL) return process.env.HR_DATABASE_URL;

  const hrEnvPath = path.resolve(
    __dirname, '..', '..', '..', '..', '..', 'hr_platform', 'apps', 'admin-web', '.env',
  );
  if (fs.existsSync(hrEnvPath)) {
    const env = dotenv.parse(fs.readFileSync(hrEnvPath, 'utf-8'));
    if (env.DATABASE_URL) return env.DATABASE_URL;
  }
  return null;
}

async function resolveHRContext(
  hrPrisma: PrismaClient,
): Promise<{ orgId: string; userMap: Map<string, string> }> {
  const orgs = await hrPrisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Organization" WHERE slug = 'platform-demo' LIMIT 1`,
  );
  if (!orgs[0]) throw new Error('platform-demo org not found in HR database');
  const orgId = orgs[0].id;

  const users = await hrPrisma.$queryRawUnsafe<{ id: string; fullName: string }[]>(
    `SELECT id, "fullName" FROM "User" WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
    orgId,
  );
  const userMap = new Map<string, string>();
  for (const u of users) userMap.set(u.fullName, u.id);

  return { orgId, userMap };
}

/* ------------------------------------------------------------------ */
/*  Wait for page to finish loading (no more skeletons / spinners)     */
/* ------------------------------------------------------------------ */

const LOADING_INDICATORS = [
  '[class*="animate-shimmer"]',
  '[class*="animate-pulse"]',
  '[class*="skeleton"]',
  '[class*="Skeleton"]',
  '[role="progressbar"]',
  '[class*="spinner"]',
  '[class*="Spinner"]',
].join(', ');

/**
 * Polls the page until all skeleton / spinner elements have disappeared,
 * then waits a short settle period for any final paint. Falls back to a
 * maximum timeout so a stuck spinner can't block the whole run.
 */
async function waitForPageStable(page: Page, maxMs = 15_000): Promise<void> {
  const deadline = Date.now() + maxMs;
  const pollInterval = 400;
  const settleMs = 600;

  while (Date.now() < deadline) {
    const loadingCount = await page.evaluate((sel) => {
      return document.querySelectorAll(sel).length;
    }, LOADING_INDICATORS);

    if (loadingCount === 0) {
      await page.waitForTimeout(settleMs);
      return;
    }
    await page.waitForTimeout(pollInterval);
  }
  // Timed out waiting for loaders to clear — continue anyway
  await page.waitForTimeout(settleMs);
}

/* ------------------------------------------------------------------ */
/*  Supabase screenshot uploads                                        */
/* ------------------------------------------------------------------ */

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars for storage upload');
  return createSupabaseAdmin(url, key);
}

async function uploadScreenshot(
  entryId: string,
  stepIndex: number,
  buffer: Buffer,
): Promise<string> {
  const sb = supabaseAdmin();
  const storagePath = `hr-docs/${entryId}/step-${stepIndex + 1}.png`;
  const { error } = await sb.storage
    .from('screenshots')
    .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Screenshot upload failed (${storagePath}): ${error.message}`);
  const { data } = sb.storage.from('screenshots').getPublicUrl(storagePath);
  return data.publicUrl;
}

/* ------------------------------------------------------------------ */
/*  Video upload to Supabase storage                                   */
/* ------------------------------------------------------------------ */

async function uploadVideo(
  entryId: string,
  videoPath: string,
): Promise<string> {
  const sb = supabaseAdmin();
  const videoBuffer = fs.readFileSync(videoPath);
  const storagePath = `hr-docs/${entryId}/video.webm`;
  const { error } = await sb.storage
    .from('recordings')
    .upload(storagePath, videoBuffer, { contentType: 'video/webm', upsert: true });
  if (error) throw new Error(`Video upload failed (${storagePath}): ${error.message}`);
  const { data } = sb.storage.from('recordings').getPublicUrl(storagePath);
  return data.publicUrl;
}

/* ------------------------------------------------------------------ */
/*  HR Platform login (runs inside the recording context)              */
/* ------------------------------------------------------------------ */

/**
 * Log in to the HR platform directly on the given page.
 * This keeps the session alive within the same browser context that
 * records video, avoiding the storageState-transfer problem.
 */
async function loginInPage(page: Page, role: HRRole): Promise<void> {
  const creds = HR_CREDENTIALS[role];

  await page.goto(`${HR_BASE_URL}/?org=platform-demo`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await waitForPageStable(page);

  if (page.url().includes('/dashboard')) return;

  try {
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10_000 });
  } catch {
    if (page.url().includes('/dashboard')) return;
    await waitForPageStable(page);
  }

  await page.fill('input[type="email"], input[name="email"]', creds.email);
  await page.fill('input[type="password"], input[name="password"]', creds.password);
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")');

  try {
    await page.waitForURL('**/dashboard**', { timeout: 15_000 });
  } catch {
    await page.waitForTimeout(5000);
  }
  await waitForPageStable(page);
}

/* ------------------------------------------------------------------ */
/*  Tour execution (mirrors docs-runner.ts executeTour)                 */
/* ------------------------------------------------------------------ */

async function executeTour(
  page: Page,
  entry: HRDocEntry,
  baseUrl: string,
): Promise<{ steps: StepResult[]; durationMs: number }> {
  const results: StepResult[] = [];
  let stepIdx = 0;
  const startTime = Date.now();

  await page.goto(`${baseUrl}${entry.route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await waitForPageStable(page);

  const tour: TourStep[] =
    entry.tour.length > 0 ? entry.tour : [{ action: 'screenshot', label: entry.title }];

  for (const step of tour) {
    switch (step.action) {
      case 'screenshot': {
        if (step.waitFor) {
          try {
            await page.waitForSelector(step.waitFor, { timeout: 8000 });
          } catch {
            console.warn(`  [${entry.id}] waitFor timed out: ${step.waitFor}`);
          }
        }
        await waitForPageStable(page, 10_000);
        const buf = await page.screenshot({ fullPage: false, type: 'png' });
        const url = await uploadScreenshot(entry.id, stepIdx, Buffer.from(buf));
        results.push({ label: step.label, screenshotUrl: url });
        stepIdx++;
        break;
      }
      case 'click': {
        try {
          const selectors = step.selector.split(',').map((s) => s.trim());
          let clicked = false;
          for (const sel of selectors) {
            try {
              await page.click(sel, { timeout: 3000 });
              clicked = true;
              break;
            } catch {}
          }
          if (!clicked) {
            await page.click(selectors[0], { timeout: 5000 });
          }
          await waitForPageStable(page);
        } catch (e) {
          console.warn(`  [${entry.id}] click failed: ${step.selector} — ${e instanceof Error ? e.message : e}`);
        }
        if (step.label) {
          await waitForPageStable(page, 10_000);
          const buf = await page.screenshot({ fullPage: false, type: 'png' });
          const url = await uploadScreenshot(entry.id, stepIdx, Buffer.from(buf));
          results.push({ label: step.label, screenshotUrl: url });
          stepIdx++;
        }
        break;
      }
      case 'type': {
        try {
          const selectors = step.selector.split(',').map((s) => s.trim());
          let filled = false;
          for (const sel of selectors) {
            try {
              await page.fill(sel, step.text);
              filled = true;
              break;
            } catch {}
          }
          if (!filled) {
            await page.fill(selectors[0], step.text);
          }
          await page.waitForTimeout(300);
        } catch (e) {
          console.warn(`  [${entry.id}] type failed: ${step.selector} — ${e instanceof Error ? e.message : e}`);
        }
        break;
      }
      case 'wait': {
        await page.waitForTimeout(step.ms);
        break;
      }
      case 'navigate': {
        await page.goto(`${baseUrl}${step.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await waitForPageStable(page);
        break;
      }
      case 'scroll': {
        try {
          if (step.selector) {
            const el = await page.$(step.selector);
            if (el) {
              await el.evaluate(
                (node, opts) =>
                  node.scrollTo({
                    top: opts.y ?? node.scrollTop + (opts.deltaY ?? 600),
                    behavior: 'smooth',
                  }),
                { y: step.y, deltaY: step.deltaY },
              );
            }
          } else {
            await page.evaluate(
              (opts) =>
                window.scrollTo({
                  top: opts.y ?? window.scrollY + (opts.deltaY ?? 600),
                  behavior: 'smooth',
                }),
              { y: step.y, deltaY: step.deltaY },
            );
          }
          await page.waitForTimeout(800);
        } catch (e) {
          console.warn(`  [${entry.id}] scroll failed: ${e instanceof Error ? e.message : e}`);
        }
        if (step.label) {
          await waitForPageStable(page, 10_000);
          const buf = await page.screenshot({ fullPage: false, type: 'png' });
          const url = await uploadScreenshot(entry.id, stepIdx, Buffer.from(buf));
          results.push({ label: step.label, screenshotUrl: url });
          stepIdx++;
        }
        break;
      }
    }
  }

  return { steps: results, durationMs: Date.now() - startTime };
}

/* ------------------------------------------------------------------ */
/*  Main runner                                                        */
/* ------------------------------------------------------------------ */

export async function runHRDocs(opts?: {
  only?: string;
  role?: HRRole;
}): Promise<RunReport> {
  const entries = filterHREntries(opts);

  // Connect to the HR platform database for setup hooks
  let setupCtx: SetupContext | null = null;
  let hrPrisma: PrismaClient | null = null;
  const hrDbUrl = getHRDatabaseUrl();
  const hasSetupEntries = entries.some((e) => e.setup);

  if (hrDbUrl && hasSetupEntries) {
    hrPrisma = new PrismaClient({ datasourceUrl: hrDbUrl });
    try {
      const { orgId, userMap } = await resolveHRContext(hrPrisma);
      setupCtx = { prisma: hrPrisma, orgId, userMap };
      console.log(`HR database connected (org ${orgId}, ${userMap.size} users)`);
    } catch (e) {
      console.warn(`HR database setup unavailable: ${e instanceof Error ? e.message : e}`);
    }
  } else if (hasSetupEntries) {
    console.warn('HR_DATABASE_URL not available — setup hooks will be skipped');
  }

  const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'showcaseit-hr-docs-'));
  console.log(`Video temp dir: ${videoDir}`);
  console.log(`HR Platform: ${HR_BASE_URL}`);
  console.log('Launching browser...\n');

  const browser = await chromium.launch({ headless: true });

  // Group entries by role for logging
  const roleGroups = new Map<HRRole, HRDocEntry[]>();
  for (const entry of entries) {
    const group = roleGroups.get(entry.role) ?? [];
    group.push(entry);
    roleGroups.set(entry.role, group);
  }

  const report: RunReport = {
    generatedAt: new Date().toISOString(),
    baseUrl: HR_BASE_URL,
    entries: [],
  };

  for (const [role, roleEntries] of roleGroups) {
    console.log(`\n=== Role: ${role} (${roleEntries.length} entries) ===\n`);

    for (const entry of roleEntries) {
      console.log(`▸ ${entry.id} — ${entry.title}`);

      const entryVideoDir = path.join(videoDir, entry.id);
      fs.mkdirSync(entryVideoDir, { recursive: true });

      const context: BrowserContext = await browser.newContext({
        viewport: VIEWPORT,
        colorScheme: 'dark',
        recordVideo: { dir: entryVideoDir, size: VIEWPORT },
      });

      const page = await context.newPage();
      let recordingId: string | null = null;
      let steps: StepResult[] = [];

      try {
        // Run prerequisite data setup if the entry has one
        if (entry.setup && setupCtx) {
          try {
            await entry.setup(setupCtx);
          } catch (e) {
            console.warn(`  [setup] failed: ${e instanceof Error ? e.message : e}`);
          }
        }

        if (!entry.skipPreLogin) {
          console.log(`  Logging in as ${HR_CREDENTIALS[role].email}...`);
          await loginInPage(page, role);
          console.log(`  Logged in, starting tour...`);
        } else {
          console.log(`  skipPreLogin — tour performs sign-in from ${entry.route}`);
          await page.goto(`${HR_BASE_URL}${entry.route}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30_000,
          });
          await waitForPageStable(page);
        }

        const result = await executeTour(page, entry, HR_BASE_URL);
        steps = result.steps;

        await page.close();
        await context.close();

        const videoFiles = fs.readdirSync(entryVideoDir).filter((f) => f.endsWith('.webm'));
        if (videoFiles.length > 0) {
          const videoPath = path.join(entryVideoDir, videoFiles[0]);
          const videoSize = fs.statSync(videoPath).size;
          console.log(`  Uploading video (${(videoSize / 1024).toFixed(0)} KB)...`);
          const videoUrl = await uploadVideo(entry.id, videoPath);
          console.log(`  Video uploaded: ${videoUrl}`);
          (report as any).__videoUrls = (report as any).__videoUrls || {};
          (report as any).__videoUrls[entry.id] = { videoUrl, durationMs: result.durationMs, videoSize };
        } else {
          console.warn('  No video file produced.');
        }

        console.log(`  ${steps.length} screenshot(s) captured.`);
      } catch (e) {
        console.error(`  ERROR: ${e instanceof Error ? e.message : e}`);
        try {
          await page.close();
        } catch {}
        try {
          await context.close();
        } catch {}
      }

      report.entries.push({
        entryId: entry.id,
        title: entry.title,
        description: entry.description,
        recordingId,
        steps,
      });
    }
  }

  await browser.close();

  if (hrPrisma) {
    await hrPrisma.$disconnect();
  }

  try {
    fs.rmSync(videoDir, { recursive: true, force: true });
  } catch {}

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${REPORT_PATH}`);

  return report;
}

/* ------------------------------------------------------------------ */
/*  CLI entry point                                                    */
/* ------------------------------------------------------------------ */

if (require.main === module) {
  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const roleArg = args.find((a) => a.startsWith('--role='));

  runHRDocs({
    only: onlyArg?.split('=')[1],
    role: roleArg?.split('=')[1] as HRRole | undefined,
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
