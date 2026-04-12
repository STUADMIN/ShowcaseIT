/**
 * HR documentation manifest — **one Playwright tour per CSV row** in
 * `hr_platform/docs/hr-platform-process-manual.csv` (125 scenarios).
 *
 * Regenerate scenario metadata after CSV edits:
 *   node apps/web/scripts/docs/generate-hr-scenarios.mjs
 */
import { setupEmployeeTickets, setupOrgAdminTickets, setupPartnerAdminTickets } from './hr-manifest-setup';
import type { HRDocEntry, HRRole, SetupContext } from './hr-manifest-types';
import { HR_SCENARIO_ROWS, type HRScenarioRow } from './hr-scenarios.generated';
import { resolveTourForScenario } from './hr-scenario-tour-resolver';

export type { HRDocEntry, HRRole, SetupContext } from './hr-manifest-types';

export const HR_CREDENTIALS: Record<HRRole, { email: string; password: string }> = {
  'org-admin': { email: 'helen.richardson@platform-demo.com', password: 'Demo123!' },
  manager: { email: 'david.kowalski@platform-demo.com', password: 'Demo123!' },
  employee: { email: 'ben.taylor@platform-demo.com', password: 'Demo123!' },
  'partner-admin': { email: 'partner.admin@meridian-hr.com', password: 'Demo123!' },
};

export const HR_ROLE_PROJECT_NAME: Record<HRRole, string> = {
  'org-admin': 'Organisation Admin Guide',
  manager: 'Manager Guide',
  employee: 'Employee Guide',
  'partner-admin': 'Partner Admin Guide',
};

const SETUP_BY_KEY = {
  'org-admin-tickets': setupOrgAdminTickets,
  'employee-tickets': setupEmployeeTickets,
  'partner-admin-tickets': setupPartnerAdminTickets,
} as const;

function buildDescription(row: HRScenarioRow): string {
  const parts = [
    row.purpose,
    '',
    `Outcome: ${row.outcome}`,
    '',
    `Procedure (manual): ${row.stepsText}`,
  ];
  if (row.formData !== 'N/A') {
    parts.push('', `Form fields: ${row.formData}`);
  }
  if (row.testData) {
    parts.push('', `Test / recording data: ${row.testData}`);
  }
  if (row.notes) {
    parts.push('', row.notes);
  }
  parts.push('', `[hr-doc:${row.entryId}]`);
  return parts.join('\n');
}

export const hrManifest: HRDocEntry[] = HR_SCENARIO_ROWS.map((row) => ({
  id: row.entryId,
  title: `${row.ref} ${row.title}`,
  description: buildDescription(row),
  role: row.role as HRRole,
  route: row.route,
  skipPreLogin: row.skipPreLogin,
  setup: row.setupKey ? SETUP_BY_KEY[row.setupKey] : undefined,
  tour: resolveTourForScenario(row),
}));

export function filterHREntries(opts?: { only?: string; role?: HRRole }): HRDocEntry[] {
  let entries = hrManifest;
  if (opts?.role) {
    entries = entries.filter((e) => e.role === opts.role);
  }
  if (opts?.only) {
    const ids = new Set(opts.only.split(',').map((s) => s.trim()).filter(Boolean));
    entries = entries.filter((e) => ids.has(e.id));
  }
  if (entries.length === 0) {
    console.error('No HR manifest entries match the provided filters.');
    process.exit(1);
  }
  return entries;
}
