#!/usr/bin/env tsx
/**
 * docs:generate — full auto-documentation pipeline.
 *
 * 1. Runs the Playwright runner to capture video recordings + tour screenshots.
 * 2. Creates/updates guides directly from the tour screenshots (NOT from
 *    video frame extraction). Each screenshot becomes a guide step with
 *    its tour label as the title.
 * 3. Tags guides as documentation (isDocumentation = true) with
 *    an [auto-doc:{id}] fingerprint for idempotent re-runs.
 *
 * Usage:
 *   npm run docs:generate                       # all entries
 *   npm run docs:generate -- --only=recordings  # selective
 *   npm run docs:generate -- --skip-capture     # reuse last .report.json
 *   npm run docs:generate -- --skip-guide       # capture only, no guide gen
 *
 * Environment — same as docs-runner.ts plus DATABASE_URL for Prisma.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
const webRoot = path.resolve(__dirname, '..', '..');
for (const name of ['.env.local', '.env']) {
  dotenv.config({ path: path.join(webRoot, name), override: false });
}

import * as fs from 'fs';
import { PrismaClient } from '../../src/generated/prisma';
import { runDocs } from './docs-runner';
import type { RunReport, EntryReport } from './types';

const REPORT_PATH = path.resolve(__dirname, '.report.json');
const AUTO_DOC_TAG_PREFIX = '[auto-doc:';

const prisma = new PrismaClient();

function taggedDescription(entryId: string, description: string): string {
  return `${description}\n${AUTO_DOC_TAG_PREFIX}${entryId}]`;
}

function cleanDescription(description: string): string {
  return description.replace(/\n?\[auto-doc:[^\]]+\]/g, '').trim();
}

async function findExistingGuide(entryId: string) {
  const guides = await prisma.guide.findMany({
    where: { description: { contains: `${AUTO_DOC_TAG_PREFIX}${entryId}]` } },
    take: 1,
  });
  return guides[0] ?? null;
}

async function resolveProjectAndUser(): Promise<{ projectId: string; userId: string }> {
  const member = await prisma.workspaceMember.findFirst({
    include: { workspace: { include: { projects: { take: 1, orderBy: { createdAt: 'asc' } } } } },
    orderBy: { joinedAt: 'asc' },
  });
  if (!member) throw new Error('No workspace member found — sign in to the app first.');

  let project = member.workspace.projects[0];
  if (!project) {
    project = await prisma.project.create({
      data: { workspaceId: member.workspaceId, name: 'Documentation' },
    });
  }

  return { projectId: project.id, userId: member.userId };
}

/**
 * Create or update a guide using the tour screenshots directly.
 * Each screenshot from the runner report becomes a guide step.
 */
async function processEntry(
  entry: EntryReport,
  projectId: string,
  userId: string
): Promise<'created' | 'updated' | 'skipped'> {
  if (entry.steps.length === 0) {
    console.log(`  Skipping ${entry.entryId} — no screenshots captured.`);
    return 'skipped';
  }

  const existing = await findExistingGuide(entry.entryId);

  if (existing) {
    // Delete old steps and replace with new ones
    await prisma.guideStep.deleteMany({ where: { guideId: existing.id } });

    for (let i = 0; i < entry.steps.length; i++) {
      const step = entry.steps[i];
      await prisma.guideStep.create({
        data: {
          guideId: existing.id,
          order: i + 1,
          title: step.label,
          description: '',
          screenshotUrl: step.screenshotUrl,
          includeInExport: true,
        },
      });
    }

    await prisma.guide.update({
      where: { id: existing.id },
      data: {
        recordingId: entry.recordingId,
        title: entry.title,
        description: taggedDescription(entry.entryId, entry.description),
        isDocumentation: true,
      },
    });

    console.log(`  Updated guide "${entry.title}" (${entry.steps.length} steps)`);
    return 'updated';
  }

  // Create new guide with steps from tour screenshots
  const orgKey = await prisma.project
    .findUnique({ where: { id: projectId }, include: { workspace: true } })
    .then((p) => p?.workspace?.orgKey ?? null);

  const guide = await prisma.guide.create({
    data: {
      projectId,
      userId,
      recordingId: entry.recordingId,
      title: entry.title,
      description: taggedDescription(entry.entryId, entry.description),
      style: 'clean',
      isDocumentation: true,
      orgKey,
    },
  });

  for (let i = 0; i < entry.steps.length; i++) {
    const step = entry.steps[i];
    await prisma.guideStep.create({
      data: {
        guideId: guide.id,
        order: i + 1,
        title: step.label,
        description: '',
        screenshotUrl: step.screenshotUrl,
        includeInExport: true,
      },
    });
  }

  console.log(`  Created guide "${entry.title}" → ${guide.id} (${entry.steps.length} steps)`);
  return 'created';
}

async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const only = onlyArg?.split('=')[1];
  const skipCapture = args.includes('--skip-capture');
  const skipGuide = args.includes('--skip-guide');

  let report: RunReport;

  if (skipCapture) {
    if (!fs.existsSync(REPORT_PATH)) {
      console.error('No .report.json found — run without --skip-capture first.');
      process.exit(1);
    }
    report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8')) as RunReport;
    console.log(`Using existing report from ${report.generatedAt}\n`);
  } else {
    console.log('=== Phase 1: Capture ===\n');
    report = await runDocs(only);
    console.log();
  }

  if (skipGuide) {
    const withRecording = report.entries.filter((e) => e.recordingId).length;
    console.log(`Capture complete. ${withRecording} recording(s) uploaded. --skip-guide active, stopping.`);
    await prisma.$disconnect();
    return;
  }

  console.log('=== Phase 2: Generate guides ===\n');

  const { projectId, userId } = await resolveProjectAndUser();
  console.log(`Using project ${projectId}, user ${userId}\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of report.entries) {
    const result = await processEntry(entry, projectId, userId);
    if (result === 'created') created++;
    else if (result === 'updated') updated++;
    else skipped++;
  }

  console.log(`\nDone: ${created} created, ${updated} updated, ${skipped} skipped.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
