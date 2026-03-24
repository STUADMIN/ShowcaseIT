#!/usr/bin/env tsx
/**
 * docs:runner — Playwright browser automation that walks the docs manifest,
 * records video of each tour, uploads as a ShowcaseIT Recording, and
 * optionally takes key screenshots. Writes a JSON report for the generator.
 *
 * Environment:
 *   DOCS_BASE_URL        — default http://localhost:3000
 *   DOCS_AUTH_EMAIL       — sign-in email
 *   DOCS_AUTH_PASSWORD    — sign-in password
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
 *   SUPABASE_SERVICE_ROLE_KEY (for storage uploads)
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
const webRoot = path.resolve(__dirname, '..', '..');
for (const name of ['.env.local', '.env']) {
  dotenv.config({ path: path.join(webRoot, name), override: false });
}

import * as fs from 'fs';
import * as os from 'os';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { signIn, buildSupabaseCookies } from './auth';
import { docsManifest } from './docs-manifest';
import type { DocEntry, TourStep, EntryReport, RunReport, StepResult } from './types';

const BASE_URL = process.env.DOCS_BASE_URL || 'http://localhost:3000';
const REPORT_PATH = path.resolve(__dirname, '.report.json');
const VIEWPORT = { width: 1440, height: 900 };

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
  buffer: Buffer
): Promise<string> {
  const sb = supabaseAdmin();
  const storagePath = `docs/${entryId}/step-${stepIndex + 1}.png`;
  const { error } = await sb.storage
    .from('screenshots')
    .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Screenshot upload failed (${storagePath}): ${error.message}`);
  const { data } = sb.storage.from('screenshots').getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Fetch the first workspace the authenticated user belongs to.
 */
async function fetchUserWorkspaceId(authCookieHeader: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/workspaces`, {
    headers: { Cookie: authCookieHeader },
  });
  if (!res.ok) throw new Error(`Failed to fetch workspaces: HTTP ${res.status}`);
  const workspaces = (await res.json()) as Array<{ id: string }>;
  if (workspaces.length === 0) throw new Error('User has no workspaces');
  return workspaces[0].id;
}

/**
 * Upload a recorded WebM video as a ShowcaseIT Recording via the upload API.
 * Returns the recording id.
 */
async function uploadRecording(
  entryId: string,
  title: string,
  videoPath: string,
  durationMs: number,
  authCookieHeader: string,
  userId: string,
  workspaceId: string
): Promise<string> {
  const videoBuffer = fs.readFileSync(videoPath);
  const blob = new Blob([videoBuffer], { type: 'video/webm' });

  const metadata = JSON.stringify({
    title: `[Auto-doc] ${title}`,
    duration: durationMs,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    clickEvents: [],
    mouseEvents: [],
    hasVoiceover: false,
    userId,
    workspaceId,
  });

  const formData = new FormData();
  formData.append('video', blob, `doc-${entryId}.webm`);
  formData.append('metadata', metadata);

  const res = await fetch(`${BASE_URL}/api/recordings/upload`, {
    method: 'POST',
    body: formData,
    headers: { Cookie: authCookieHeader },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(
      `Recording upload failed for ${entryId}: ${typeof err.error === 'string' ? err.error : JSON.stringify(err)}`
    );
  }

  const recording = (await res.json()) as { id: string };
  return recording.id;
}

async function executeTour(
  page: Page,
  entry: DocEntry,
  baseUrl: string
): Promise<{ steps: StepResult[]; durationMs: number }> {
  const results: StepResult[] = [];
  let stepIdx = 0;
  const startTime = Date.now();

  await page.goto(`${baseUrl}${entry.route}`, { waitUntil: 'networkidle', timeout: 30_000 });
  // Wait for client-side hydration and rendering to complete
  await page.waitForTimeout(3500);
  // Extra wait for any lazy-loaded images or animations to settle
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch {}
  await page.waitForTimeout(500);

  const tour: TourStep[] =
    entry.tour.length > 0 ? entry.tour : [{ action: 'screenshot', label: entry.title }];

  for (const step of tour) {
    switch (step.action) {
      case 'screenshot': {
        if (step.waitFor) {
          try {
            await page.waitForSelector(step.waitFor, { timeout: 8000 });
            await page.waitForTimeout(500);
          } catch {
            console.warn(`  [${entry.id}] waitFor timed out: ${step.waitFor}`);
          }
        }
        const buf = await page.screenshot({ fullPage: false, type: 'png' });
        const url = await uploadScreenshot(entry.id, stepIdx, Buffer.from(buf));
        results.push({ label: step.label, screenshotUrl: url });
        stepIdx++;
        break;
      }
      case 'click': {
        try {
          await page.click(step.selector, { timeout: 5000 });
          await page.waitForTimeout(1500);
        } catch (e) {
          console.warn(`  [${entry.id}] click failed: ${step.selector} — ${e instanceof Error ? e.message : e}`);
        }
        if (step.label) {
          const buf = await page.screenshot({ fullPage: false, type: 'png' });
          const url = await uploadScreenshot(entry.id, stepIdx, Buffer.from(buf));
          results.push({ label: step.label, screenshotUrl: url });
          stepIdx++;
        }
        break;
      }
      case 'type': {
        try {
          await page.fill(step.selector, step.text);
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
        await page.goto(`${baseUrl}${step.path}`, { waitUntil: 'networkidle', timeout: 30_000 });
        await page.waitForTimeout(step.waitMs ?? 3000);
        try {
          await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch {}
        await page.waitForTimeout(500);
        break;
      }
      case 'scroll': {
        try {
          if (step.selector) {
            const el = await page.$(step.selector);
            if (el) {
              await el.evaluate(
                (node, opts) => node.scrollTo({ top: opts.y ?? node.scrollTop + (opts.deltaY ?? 600), behavior: 'smooth' }),
                { y: step.y, deltaY: step.deltaY }
              );
            }
          } else {
            await page.evaluate(
              (opts) => window.scrollTo({ top: opts.y ?? window.scrollY + (opts.deltaY ?? 600), behavior: 'smooth' }),
              { y: step.y, deltaY: step.deltaY }
            );
          }
          await page.waitForTimeout(800);
        } catch (e) {
          console.warn(`  [${entry.id}] scroll failed: ${e instanceof Error ? e.message : e}`);
        }
        if (step.label) {
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

function filterEntries(only?: string): DocEntry[] {
  if (!only) return docsManifest;
  const ids = new Set(only.split(',').map((s) => s.trim()).filter(Boolean));
  const filtered = docsManifest.filter((e) => ids.has(e.id));
  if (filtered.length === 0) {
    console.error(`No manifest entries match --only=${only}`);
    process.exit(1);
  }
  return filtered;
}

export async function runDocs(only?: string): Promise<RunReport> {
  const entries = filterEntries(only);

  console.log(`Signing in to ${BASE_URL}...`);
  const tokens = await signIn();
  const cookies = buildSupabaseCookies(tokens, BASE_URL);
  const authCookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const userId = tokens.userId;

  console.log('Fetching workspace...');
  const workspaceId = await fetchUserWorkspaceId(authCookieHeader);
  console.log(`  userId=${userId}  workspaceId=${workspaceId}`);

  const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'showcaseit-docs-'));
  console.log(`Video temp dir: ${videoDir}`);
  console.log('Launching browser...\n');

  const browser = await chromium.launch({ headless: true });

  const report: RunReport = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    entries: [],
  };

  for (const entry of entries) {
    console.log(`▸ ${entry.id} — ${entry.title}`);

    const entryVideoDir = path.join(videoDir, entry.id);
    fs.mkdirSync(entryVideoDir, { recursive: true });

    const context: BrowserContext = await browser.newContext({
      viewport: VIEWPORT,
      colorScheme: 'dark',
      recordVideo: { dir: entryVideoDir, size: VIEWPORT },
    });
    await context.addCookies(cookies);

    const page = await context.newPage();
    let recordingId: string | null = null;
    let steps: StepResult[] = [];

    try {
      const result = await executeTour(page, entry, BASE_URL);
      steps = result.steps;

      await page.close();
      await context.close();

      const videoFiles = fs.readdirSync(entryVideoDir).filter((f) => f.endsWith('.webm'));
      if (videoFiles.length > 0) {
        const videoPath = path.join(entryVideoDir, videoFiles[0]);
        console.log(`  Uploading video (${(fs.statSync(videoPath).size / 1024).toFixed(0)} KB)...`);
        recordingId = await uploadRecording(
          entry.id,
          entry.title,
          videoPath,
          result.durationMs,
          authCookieHeader,
          userId,
          workspaceId
        );
        console.log(`  Recording created: ${recordingId}`);
      } else {
        console.warn('  No video file produced.');
      }

      console.log(`  ${steps.length} screenshot(s) captured.`);
    } catch (e) {
      console.error(`  ERROR: ${e instanceof Error ? e.message : e}`);
      try { await page.close(); } catch {}
      try { await context.close(); } catch {}
    }

    report.entries.push({
      entryId: entry.id,
      title: entry.title,
      description: entry.description,
      recordingId,
      steps,
    });
  }

  await browser.close();

  try {
    fs.rmSync(videoDir, { recursive: true, force: true });
  } catch {}

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${REPORT_PATH}`);

  return report;
}

if (require.main === module) {
  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const only = onlyArg?.split('=')[1];
  runDocs(only).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
