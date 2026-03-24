#!/usr/bin/env tsx
/**
 * docs:scan — discover Next.js app-router pages and diff against the docs manifest.
 *
 * Usage:
 *   npm run docs:scan          (from apps/web or repo root)
 *
 * No browser needed — fast filesystem scan only.
 */

import * as fs from 'fs';
import * as path from 'path';
import { docsManifest, allManifestRoutes } from './docs-manifest';

const APP_DIR = path.resolve(__dirname, '..', '..', 'src', 'app');

/** Recursively find all page.tsx files under a directory. */
function findPages(dir: string, prefix = ''): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name === 'api' && prefix === '') continue;
    if (entry.isDirectory()) {
      results.push(...findPages(path.join(dir, entry.name), `${prefix}/${entry.name}`));
    } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
      results.push(prefix || '/');
    }
  }
  return results;
}

/** Convert a filesystem path segment to a URL-style segment (strip groups, keep dynamic). */
function normalizeSegment(seg: string): string | null {
  if (seg.startsWith('(') && seg.endsWith(')')) return null;
  return seg;
}

function filePathToRoute(fsPath: string): string {
  const segments = fsPath.split('/').filter(Boolean);
  const cleaned = segments.map(normalizeSegment).filter((s): s is string => s !== null);
  return '/' + cleaned.join('/') || '/';
}

function run() {
  console.log('Scanning', APP_DIR, '...\n');
  const rawPaths = findPages(APP_DIR);
  const discoveredRoutes = [...new Set(rawPaths.map(filePathToRoute))].sort();

  const manifestRoutes = allManifestRoutes();
  const manifestRouteSet = new Set(manifestRoutes);
  const discoveredSet = new Set(discoveredRoutes);

  const unmapped: string[] = [];
  const covered: string[] = [];
  const removed: string[] = [];

  for (const route of discoveredRoutes) {
    if (manifestRouteSet.has(route)) {
      covered.push(route);
    } else {
      unmapped.push(route);
    }
  }

  for (const route of manifestRoutes) {
    if (!discoveredSet.has(route)) {
      removed.push(route);
    }
  }

  console.log(`Discovered ${discoveredRoutes.length} page routes.\n`);
  console.log(`Manifest has ${docsManifest.length} entries covering ${manifestRoutes.length} routes.\n`);

  if (covered.length > 0) {
    console.log('Covered (manifest entry exists):');
    for (const r of covered) console.log(`  ✓ ${r}`);
    console.log();
  }

  if (unmapped.length > 0) {
    console.log('New / unmapped (no manifest entry):');
    for (const r of unmapped) console.log(`  + ${r}`);
    console.log();
  }

  if (removed.length > 0) {
    console.log('Stale (manifest route no longer found in code):');
    for (const r of removed) console.log(`  - ${r}`);
    console.log();
  }

  if (unmapped.length === 0 && removed.length === 0) {
    console.log('Everything is in sync.\n');
  }
}

run();
