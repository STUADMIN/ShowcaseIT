#!/usr/bin/env tsx
/**
 * import-md-guides — Import markdown user manuals into ShowcaseIt as guides.
 *
 * Each ## section in a markdown file becomes a separate Guide.
 * Each ### sub-section becomes a GuideStep within that guide.
 * Sections like "Table of Contents" and "Quick Reference" are skipped.
 *
 * Usage:
 *   npm run guides:import                    # import all configured files
 *   npm run guides:import -- --dry-run       # preview without writing to DB
 *   npm run guides:import -- --file=01       # import only files matching "01"
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
const webRoot = path.resolve(__dirname, '..', '..');
for (const name of ['.env.local', '.env']) {
  dotenv.config({ path: path.join(webRoot, name), override: false });
}

import * as fs from 'fs';
import { PrismaClient } from '../../src/generated/prisma';

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

const MD_SOURCE_DIR = path.resolve(
  webRoot,
  '..', '..', '..', 'hr_platform', 'docs', 'user-manuals',
);

const SOURCE_FILES = [
  { filename: '01-organisation-admin-guide.md', projectName: 'Organisation Admin Guide' },
  { filename: '02-manager-guide.md', projectName: 'Manager Guide' },
  { filename: '03-employee-guide.md', projectName: 'Employee Guide' },
  { filename: '04-partner-admin-guide.md', projectName: 'Partner Admin Guide' },
];

const SKIP_HEADINGS = ['table of contents', 'quick reference'];

const MD_IMPORT_TAG_PREFIX = '[md-import:';

/* ------------------------------------------------------------------ */
/*  Markdown parsing                                                   */
/* ------------------------------------------------------------------ */

interface SubSection {
  heading: string;
  content: string;
}

interface Section {
  heading: string;
  rawContent: string;
  subSections: SubSection[];
}

function shouldSkip(heading: string): boolean {
  const lower = heading.toLowerCase();
  return SKIP_HEADINGS.some((skip) => lower.includes(skip));
}

function parseSections(markdown: string): Section[] {
  const lines = markdown.split('\n');
  const sections: Section[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      if (current) {
        sections.push(buildSection(current.heading, current.lines));
      }
      current = { heading: line.replace(/^## /, '').trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    sections.push(buildSection(current.heading, current.lines));
  }

  return sections.filter((s) => !shouldSkip(s.heading));
}

function buildSection(heading: string, lines: string[]): Section {
  const rawContent = lines.join('\n').trim();
  const subSections = parseSubSections(lines);
  return { heading, rawContent, subSections };
}

function parseSubSections(lines: string[]): SubSection[] {
  const subs: SubSection[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (current) {
        subs.push({ heading: current.heading, content: current.lines.join('\n').trim() });
      }
      current = { heading: line.replace(/^### /, '').trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    subs.push({ heading: current.heading, content: current.lines.join('\n').trim() });
  }

  return subs;
}

/* ------------------------------------------------------------------ */
/*  DB helpers                                                         */
/* ------------------------------------------------------------------ */

function makeTag(filename: string, sectionIndex: number): string {
  return `${MD_IMPORT_TAG_PREFIX}${filename}:${sectionIndex}]`;
}

function taggedDescription(tag: string, description: string): string {
  return `${description}\n${tag}`;
}

async function findExistingGuide(tag: string) {
  const guides = await prisma.guide.findMany({
    where: { description: { contains: tag } },
    take: 1,
  });
  return guides[0] ?? null;
}

async function resolveUserAndWorkspace(): Promise<{ userId: string; workspaceId: string }> {
  // 1. Prefer the dev auth-bypass user when present (local dev)
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

  // 2. Prefer users with a preferredWorkspaceId set (i.e. actively signed in)
  const preferredUser = await prisma.user.findFirst({
    where: { preferredWorkspaceId: { not: null } },
    select: { id: true, preferredWorkspaceId: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (preferredUser?.preferredWorkspaceId) {
    return { userId: preferredUser.id, workspaceId: preferredUser.preferredWorkspaceId };
  }

  // 3. Fall back to the most recent workspace member
  const member = await prisma.workspaceMember.findFirst({
    orderBy: { joinedAt: 'desc' },
  });
  if (!member) throw new Error('No workspace member found — run seed or sign in first.');
  return { userId: member.userId, workspaceId: member.workspaceId };
}

async function resolveBrandKit(workspaceId: string): Promise<string | null> {
  const kits = await prisma.brandKit.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
    take: 5,
  });
  if (kits.length === 0) return null;
  if (kits.length === 1) return kits[0].id;
  // Prefer a kit whose name matches projects already in the workspace
  const projects = await prisma.project.findMany({
    where: { workspaceId, brandKitId: { not: null } },
    select: { brandKitId: true },
    take: 1,
    orderBy: { createdAt: 'desc' },
  });
  return projects[0]?.brandKitId ?? kits[0].id;
}

async function ensureProject(workspaceId: string, name: string, brandKitId: string | null): Promise<string> {
  const existing = await prisma.project.findFirst({
    where: { workspaceId, name },
  });
  if (existing) return existing.id;

  const project = await prisma.project.create({
    data: { workspaceId, name, brandKitId },
  });
  console.log(`  Created project "${name}" → ${project.id}${brandKitId ? ' (with brand kit)' : ''}`);
  return project.id;
}

async function getOrgKey(projectId: string): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: true },
  });
  return project?.workspace?.orgKey ?? null;
}

/* ------------------------------------------------------------------ */
/*  Guide creation / update                                            */
/* ------------------------------------------------------------------ */

async function processSection(
  section: Section,
  sectionIndex: number,
  filename: string,
  projectId: string,
  userId: string,
  orgKey: string | null,
  dryRun: boolean,
): Promise<'created' | 'updated' | 'skipped'> {
  const tag = makeTag(filename, sectionIndex);

  const steps =
    section.subSections.length > 0
      ? section.subSections.map((sub, i) => ({
          order: i + 1,
          title: sub.heading,
          description: sub.content,
        }))
      : [{ order: 1, title: section.heading, description: section.rawContent }];

  if (dryRun) {
    console.log(`  [DRY RUN] Would create guide "${section.heading}" with ${steps.length} step(s)`);
    return 'created';
  }

  const existing = await findExistingGuide(tag);

  if (existing) {
    await prisma.guideStep.deleteMany({ where: { guideId: existing.id } });

    for (const step of steps) {
      await prisma.guideStep.create({
        data: {
          guideId: existing.id,
          order: step.order,
          title: step.title,
          description: step.description,
          includeInExport: true,
        },
      });
    }

    await prisma.guide.update({
      where: { id: existing.id },
      data: {
        title: section.heading,
        description: taggedDescription(tag, section.rawContent.slice(0, 500)),
        isDocumentation: true,
      },
    });

    console.log(`  Updated guide "${section.heading}" (${steps.length} steps)`);
    return 'updated';
  }

  const guide = await prisma.guide.create({
    data: {
      projectId,
      userId,
      title: section.heading,
      description: taggedDescription(tag, section.rawContent.slice(0, 500)),
      style: 'clean',
      isDocumentation: true,
      orgKey,
    },
  });

  for (const step of steps) {
    await prisma.guideStep.create({
      data: {
        guideId: guide.id,
        order: step.order,
        title: step.title,
        description: step.description,
        includeInExport: true,
      },
    });
  }

  console.log(`  Created guide "${section.heading}" → ${guide.id} (${steps.length} steps)`);
  return 'created';
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileFilter = args.find((a) => a.startsWith('--file='))?.split('=')[1];

  if (dryRun) console.log('*** DRY RUN — no database writes ***\n');

  const { userId, workspaceId } = await resolveUserAndWorkspace();
  const brandKitId = await resolveBrandKit(workspaceId);
  console.log(`Using workspace ${workspaceId}, user ${userId}, brandKit ${brandKitId ?? '(none)'}\n`);

  const files = fileFilter
    ? SOURCE_FILES.filter((f) => f.filename.includes(fileFilter))
    : SOURCE_FILES;

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const filePath = path.join(MD_SOURCE_DIR, file.filename);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠ File not found, skipping: ${filePath}`);
      continue;
    }

    console.log(`=== ${file.projectName} (${file.filename}) ===\n`);

    const projectId = await ensureProject(workspaceId, file.projectName, brandKitId);
    const orgKey = await getOrgKey(projectId);
    const markdown = fs.readFileSync(filePath, 'utf-8');
    const sections = parseSections(markdown);

    console.log(`  Found ${sections.length} sections\n`);

    for (let i = 0; i < sections.length; i++) {
      const result = await processSection(
        sections[i],
        i,
        file.filename,
        projectId,
        userId,
        orgKey,
        dryRun,
      );
      if (result === 'created') totalCreated++;
      else if (result === 'updated') totalUpdated++;
      else totalSkipped++;
    }

    console.log();
  }

  console.log(
    `\nDone: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped.`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
