#!/usr/bin/env tsx
/**
 * hr:generate — full HR documentation pipeline.
 *
 * 1. Runs the Playwright HR runner to capture video recordings + tour screenshots
 *    on the Xertilox HR Platform (localhost:3001).
 * 2. Creates/updates guides directly from the tour screenshots.
 *    Each screenshot becomes a guide step with its tour label as the title.
 * 3. Tags guides with [hr-doc:{id}] for idempotent re-runs.
 *
 * Usage:
 *   npm run hr:generate                        # all entries
 *   npm run hr:generate -- --role=org-admin     # one role only
 *   npm run hr:generate -- --only=org-admin-managing-users
 *   npm run hr:generate -- --skip-capture       # reuse .hr-report.json
 *   npm run hr:generate -- --skip-guide         # capture only
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
const webRoot = path.resolve(__dirname, '..', '..');
for (const name of ['.env.local', '.env']) {
  dotenv.config({ path: path.join(webRoot, name), override: false });
}

import * as fs from 'fs';
import { PrismaClient } from '../../src/generated/prisma';
import { runHRDocs } from './hr-runner';
import { HR_ROLE_PROJECT_NAME, type HRRole } from './hr-manifest';
import type { RunReport, EntryReport } from './types';

const REPORT_PATH = path.resolve(__dirname, '.hr-report.json');
const HR_DOC_TAG_PREFIX = '[hr-doc:';

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function taggedDescription(entryId: string, description: string): string {
  return `${description}\n${HR_DOC_TAG_PREFIX}${entryId}]`;
}

async function findExistingGuide(entryId: string) {
  const guides = await prisma.guide.findMany({
    where: { description: { contains: `${HR_DOC_TAG_PREFIX}${entryId}]` } },
    take: 1,
  });
  return guides[0] ?? null;
}

async function resolveUserAndWorkspace(): Promise<{
  userId: string;
  workspaceId: string;
}> {
  const devBypass = await prisma.user.findFirst({
    where: { id: 'dev-user-1' },
    select: { id: true },
  });
  if (devBypass) {
    const devMember = await prisma.workspaceMember.findFirst({
      where: { userId: devBypass.id },
      orderBy: { joinedAt: 'desc' },
    });
    if (devMember) return { userId: devBypass.id, workspaceId: devMember.workspaceId };
  }

  const preferredUser = await prisma.user.findFirst({
    where: { preferredWorkspaceId: { not: null } },
    select: { id: true, preferredWorkspaceId: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (preferredUser?.preferredWorkspaceId) {
    return { userId: preferredUser.id, workspaceId: preferredUser.preferredWorkspaceId };
  }

  const member = await prisma.workspaceMember.findFirst({
    orderBy: { joinedAt: 'desc' },
  });
  if (!member) throw new Error('No workspace member found — run seed or sign in first.');
  return { userId: member.userId, workspaceId: member.workspaceId };
}

async function resolveBrandKit(workspaceId: string): Promise<string | null> {
  const kits = await prisma.brandKit.findMany({
    where: { workspaceId },
    select: { id: true },
    take: 5,
  });
  if (kits.length === 0) return null;
  if (kits.length === 1) return kits[0].id;
  const projects = await prisma.project.findMany({
    where: { workspaceId, brandKitId: { not: null } },
    select: { brandKitId: true },
    take: 1,
    orderBy: { createdAt: 'desc' },
  });
  return projects[0]?.brandKitId ?? kits[0].id;
}

async function ensureProject(
  workspaceId: string,
  name: string,
  brandKitId: string | null,
): Promise<string> {
  const existing = await prisma.project.findFirst({
    where: { workspaceId, name },
  });
  if (existing) return existing.id;

  const project = await prisma.project.create({
    data: { workspaceId, name, brandKitId },
  });
  console.log(`  Created project "${name}" → ${project.id}`);
  return project.id;
}

async function getOrgKey(projectId: string): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: true },
  });
  return project?.workspace?.orgKey ?? null;
}

/**
 * Derive the role from entryId prefix.
 * E.g. 'org-admin-managing-users' → 'org-admin'
 */
function roleFromEntryId(entryId: string): HRRole {
  if (entryId.startsWith('org-admin-')) return 'org-admin';
  if (entryId.startsWith('manager-')) return 'manager';
  if (entryId.startsWith('employee-')) return 'employee';
  if (entryId.startsWith('partner-admin-')) return 'partner-admin';
  return 'org-admin';
}

/* ------------------------------------------------------------------ */
/*  Guide creation / update                                            */
/* ------------------------------------------------------------------ */

async function ensureRecording(
  entry: EntryReport,
  videoMeta: { videoUrl: string; durationMs: number; videoSize: number } | undefined,
  projectId: string,
  userId: string,
  orgKey: string | null,
): Promise<string | null> {
  if (!videoMeta) return entry.recordingId;

  const existing = await prisma.recording.findFirst({
    where: { title: `[HR-doc] ${entry.title}`, projectId },
    select: { id: true },
  });
  if (existing) {
    await prisma.recording.update({
      where: { id: existing.id },
      data: { videoUrl: videoMeta.videoUrl, duration: videoMeta.durationMs, status: 'ready' },
    });
    return existing.id;
  }

  const rec = await prisma.recording.create({
    data: {
      projectId,
      userId,
      title: `[HR-doc] ${entry.title}`,
      videoUrl: videoMeta.videoUrl,
      duration: videoMeta.durationMs,
      width: 1440,
      height: 900,
      mouseEvents: [],
      clickEvents: [],
      hasVoiceover: false,
      status: 'ready',
      orgKey,
    },
  });
  console.log(`  Created recording "${rec.title}" → ${rec.id}`);
  return rec.id;
}

async function processEntry(
  entry: EntryReport,
  videoUrls: Record<string, { videoUrl: string; durationMs: number; videoSize: number }>,
  projectId: string,
  userId: string,
  orgKey: string | null,
): Promise<'created' | 'updated' | 'skipped'> {
  if (entry.steps.length === 0) {
    console.log(`  Skipping ${entry.entryId} — no screenshots captured.`);
    return 'skipped';
  }

  const recordingId = await ensureRecording(entry, videoUrls[entry.entryId], projectId, userId, orgKey);

  const existing = await findExistingGuide(entry.entryId);

  if (existing) {
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
        recordingId,
        title: entry.title,
        description: taggedDescription(entry.entryId, entry.description),
        isDocumentation: true,
      },
    });

    console.log(`  Updated guide "${entry.title}" (${entry.steps.length} steps)`);
    return 'updated';
  }

  const guide = await prisma.guide.create({
    data: {
      projectId,
      userId,
      recordingId,
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

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const only = onlyArg?.split('=')[1] || process.env.HR_ONLY || undefined;
  const roleArg = args.find((a) => a.startsWith('--role='));
  const role = (roleArg?.split('=')[1] || process.env.HR_ROLE || undefined) as HRRole | undefined;
  const skipCapture = args.includes('--skip-capture') || process.env.HR_SKIP_CAPTURE === '1';
  const skipGuide = args.includes('--skip-guide') || process.env.HR_SKIP_GUIDE === '1';

  let report: RunReport;

  if (skipCapture) {
    if (!fs.existsSync(REPORT_PATH)) {
      console.error('No .hr-report.json found — run without --skip-capture first.');
      process.exit(1);
    }
    report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8')) as RunReport;
    console.log(`Using existing report from ${report.generatedAt}\n`);
  } else {
    console.log('=== Phase 1: Capture (HR Platform) ===\n');
    report = await runHRDocs({ only, role });
    console.log();
  }

  if (skipGuide) {
    const withRecording = report.entries.filter((e) => e.recordingId).length;
    console.log(
      `Capture complete. ${withRecording} recording(s) uploaded. --skip-guide active, stopping.`,
    );
    await prisma.$disconnect();
    return;
  }

  console.log('=== Phase 2: Generate guides ===\n');

  const { userId, workspaceId } = await resolveUserAndWorkspace();
  const brandKitId = await resolveBrandKit(workspaceId);
  console.log(`Using workspace ${workspaceId}, user ${userId}, brandKit ${brandKitId ?? '(none)'}\n`);

  const videoUrls: Record<string, { videoUrl: string; durationMs: number; videoSize: number }> =
    (report as any).__videoUrls || {};

  // Build project cache per role
  const projectCache = new Map<string, string>();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of report.entries) {
    const entryRole = roleFromEntryId(entry.entryId);
    const projectName = HR_ROLE_PROJECT_NAME[entryRole] ?? 'HR Documentation';

    if (!projectCache.has(projectName)) {
      const pid = await ensureProject(workspaceId, projectName, brandKitId);
      projectCache.set(projectName, pid);
    }
    const projectId = projectCache.get(projectName)!;
    const orgKey = await getOrgKey(projectId);

    const result = await processEntry(entry, videoUrls, projectId, userId, orgKey);
    if (result === 'created') created++;
    else if (result === 'updated') updated++;
    else skipped++;
  }

  console.log(`\nDone: ${created} created, ${updated} updated, ${skipped} skipped.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
