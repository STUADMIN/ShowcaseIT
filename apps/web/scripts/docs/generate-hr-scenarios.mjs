#!/usr/bin/env node
/**
 * Reads hr-platform-process-manual.csv (sibling hr_platform repo) and writes
 * hr-scenarios.generated.ts for CSV-aligned Playwright / guide IDs.
 *
 * Run from repo root:
 *   node apps/web/scripts/docs/generate-hr-scenarios.mjs
 *
 * Or set HR_MANUAL_CSV to an absolute path.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo layout: both repos often live under the same parent (e.g. ~/diink/showcaseit + ~/diink/hr_platform). */
const DEFAULT_CSV = path.resolve(__dirname, '../../../../../hr_platform/docs/hr-platform-process-manual.csv');
const OUT = path.join(__dirname, 'hr-scenarios.generated.ts');

const csvPath = process.env.HR_MANUAL_CSV || DEFAULT_CSV;

const GUIDE_ROLE = {
  'Organisation Admin': 'org-admin',
  Manager: 'manager',
  Employee: 'employee',
  'Partner Admin': 'partner-admin',
};

function stripBom(s) {
  return s.replace(/^\uFEFF/, '');
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
          continue;
        }
        q = false;
        continue;
      }
      cur += c;
      continue;
    }
    if (c === '"') {
      q = true;
      continue;
    }
    if (c === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  text = stripBom(text);
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const o = {};
    header.forEach((h, j) => {
      o[h] = cols[j] ?? '';
    });
    rows.push(o);
  }
  return rows;
}

function entryId(guide, ref) {
  const role = GUIDE_ROLE[guide];
  if (!role) throw new Error(`Unknown guide: ${guide}`);
  const refPart = ref.replace(/\./g, '-');
  return `${role}--${refPart}`;
}

function routeFor(role) {
  return role === 'partner-admin' ? '/' : '/?org=platform-demo';
}

function skipPreLogin(guide, ref) {
  if (guide === 'Organisation Admin' && ref === '1.1') return true;
  if (guide === 'Manager' && ref === '1.1') return true;
  if (guide === 'Employee' && ref === '1.2') return true;
  if (guide === 'Partner Admin' && ref === '1.1') return true;
  return false;
}

function setupKey(guide, ref) {
  if (guide === 'Organisation Admin' && ref.startsWith('10.')) return 'org-admin-tickets';
  if (guide === 'Employee' && ref.startsWith('9.')) return 'employee-tickets';
  if (guide === 'Partner Admin' && ref.startsWith('3.')) return 'partner-admin-tickets';
  return null;
}

if (!fs.existsSync(csvPath)) {
  console.error(`CSV not found: ${csvPath}\nSet HR_MANUAL_CSV or place hr_platform next to showcaseit.`);
  process.exit(1);
}

const rawRows = parseCsv(fs.readFileSync(csvPath, 'utf8'));

const lines = [];
lines.push(`/** Auto-generated from process manual CSV — do not edit by hand. */`);
lines.push(``);
lines.push(`export type HRScenarioRole = 'org-admin' | 'manager' | 'employee' | 'partner-admin';`);
lines.push(``);
lines.push(`export interface HRScenarioRow {`);
lines.push(`  entryId: string;`);
lines.push(`  guide: string;`);
lines.push(`  ref: string;`);
lines.push(`  title: string;`);
lines.push(`  purpose: string;`);
lines.push(`  outcome: string;`);
lines.push(`  stepsText: string;`);
lines.push(`  formData: string;`);
lines.push(`  testData: string;`);
lines.push(`  notes: string;`);
lines.push(`  role: HRScenarioRole;`);
lines.push(`  route: string;`);
lines.push(`  skipPreLogin: boolean;`);
lines.push(
  `  setupKey: null | 'org-admin-tickets' | 'employee-tickets' | 'partner-admin-tickets';`,
);
lines.push(`}`);
lines.push(``);
lines.push(`export const HR_SCENARIO_ROWS: HRScenarioRow[] = [`);

for (const r of rawRows) {
  const guide = r.guide;
  const ref = r.ref;
  const role = GUIDE_ROLE[guide];
  if (!role) throw new Error(`Unknown guide column: ${guide}`);
  const expected = entryId(guide, ref);
  const id = String(r.entry_id ?? '')
    .trim()
    .replace(/^"|"$/g, '') || expected;
  if (id !== expected) {
    throw new Error(`entry_id mismatch for ${guide} ${ref}: CSV "${id}" !== expected "${expected}"`);
  }
  const esc = (s) =>
    String(s ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, '\\n');
  lines.push(`  {`);
  lines.push(`    entryId: '${id}',`);
  lines.push(`    guide: '${esc(guide)}',`);
  lines.push(`    ref: '${esc(ref)}',`);
  lines.push(`    title: '${esc(r.title)}',`);
  lines.push(`    purpose: '${esc(r.purpose)}',`);
  lines.push(`    outcome: '${esc(r.outcome)}',`);
  lines.push(`    stepsText: '${esc(r.steps)}',`);
  lines.push(`    formData: '${esc(r.form_data)}',`);
  lines.push(`    testData: '${esc(r.test_data)}',`);
  lines.push(`    notes: '${esc(r.notes)}',`);
  lines.push(`    role: '${role}',`);
  lines.push(`    route: '${routeFor(role)}',`);
  lines.push(`    skipPreLogin: ${skipPreLogin(guide, ref)},`);
  const sk = setupKey(guide, ref);
  lines.push(`    setupKey: ${sk ? `'${sk}'` : 'null'},`);
  lines.push(`  },`);
}

lines.push(`];`);
lines.push(``);
lines.push(`export const HR_SCENARIO_ENTRY_IDS: string[] = HR_SCENARIO_ROWS.map((r) => r.entryId);`);
lines.push(``);

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(`Wrote ${rawRows.length} scenarios to ${OUT}`);
