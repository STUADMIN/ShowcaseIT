/**
 * Maps each CSV scenario row (125) to a Playwright tour aligned with the process manual.
 * Most tours slice the legacy chapter recordings in hr-archive-36; job-function completes use presets.
 */
import type { TourStep } from './types';
import { CHAPTER_TOURS, navTo } from './hr-archive-36';
import type { HRScenarioRow } from './hr-scenarios.generated';
import * as P from './hr-tour-presets';

const SEARCH =
  'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]';

function sl(chapter: string, start: number, end: number): TourStep[] {
  const t = CHAPTER_TOURS[chapter];
  if (!t) throw new Error(`[hr-docs] Unknown chapter tour: ${chapter}`);
  if (end > t.length) {
    throw new Error(
      `[hr-docs] Slice ${chapter} [${start},${end}) invalid — length is ${t.length}`,
    );
  }
  return t.slice(start, end);
}

export function resolveTourForScenario(row: HRScenarioRow): TourStep[] {
  const { ref, role } = row;

  if (role === 'org-admin') {
    switch (ref) {
      case '1.1':
        return P.loginOrgAdmin();
      case '1.2':
        return sl('org-admin-logging-in', 1, 3);
      case '1.3':
        return sl('org-admin-logging-in', 4, 9);
      case '2.1':
        return sl('org-admin-dashboard', 0, 5);
      case '2.2':
        return sl('org-admin-dashboard', 5, 7);
      case '3.1':
        return sl('org-admin-managing-users', 0, 9);
      case '3.2':
        return P.orgAdminCreateUserSave(sl('org-admin-managing-users', 0, 9));
      case '3.3':
        return sl('org-admin-managing-users', 15, 42);
      case '3.4':
        return orgAdminInviteFlow();
      case '3.5':
        return orgAdminOffboardFlow();
      case '4.1':
        return sl('org-admin-directory-org-chart', 0, 10);
      case '4.2':
        return sl('org-admin-directory-org-chart', 10, 17);
      case '5.1':
        return sl('org-admin-calendar', 0, 7);
      case '6.1':
        return sl('org-admin-tasks', 0, 5);
      case '6.2':
        return P.orgAdminCreateTaskSave(sl('org-admin-tasks', 0, 5));
      case '6.3':
        return sl('org-admin-tasks', 8, 15);
      case '7.1':
        return sl('org-admin-leave', 0, 3);
      case '7.2':
        return sl('org-admin-leave', 3, 11);
      case '7.3':
        return sl('org-admin-leave', 11, 17);
      case '7.4':
        return sl('org-admin-leave', 17, 20);
      case '8.1':
        return sl('org-admin-performance', 0, 4);
      case '8.2':
        return sl('org-admin-performance', 4, 9);
      case '8.3':
        return sl('org-admin-performance', 9, 16);
      case '8.4':
        return sl('org-admin-performance', 16, 22);
      case '8.5':
        return sl('org-admin-performance', 22, 25);
      case '9.1':
        return sl('org-admin-announcements', 0, 4);
      case '9.2':
        return sl('org-admin-announcements', 4, 9);
      case '9.3':
        return sl('org-admin-announcements', 10, 16);
      case '10.1':
        return sl('org-admin-tickets', 0, 4);
      case '10.2':
        return sl('org-admin-tickets', 4, 10);
      case '10.3':
        return sl('org-admin-tickets', 10, 17);
      case '10.4':
        return P.orgAdminNewTicketFromInbox();
      case '11.1':
        return sl('org-admin-knowledge-centre', 0, 4);
      case '11.2':
        return sl('org-admin-knowledge-centre', 4, 9);
      case '11.3':
        return sl('org-admin-knowledge-centre', 9, 15);
      case '12.1':
        return sl('org-admin-reports', 0, 4);
      case '12.2':
        return sl('org-admin-reports', 4, 6);
      case '12.3':
        return sl('org-admin-reports', 4, 6);
      case '12.4':
        return sl('org-admin-reports', 6, 11);
      case '12.5':
        return sl('org-admin-reports', 11, 18);
      case '13.1':
        return sl('org-admin-settings', 0, 5);
      case '13.2':
        return sl('org-admin-settings', 0, 5);
      case '13.3':
        return sl('org-admin-settings', 5, 12);
      case '13.4':
        return sl('org-admin-settings', 12, 19);
      case '13.5':
        return sl('org-admin-settings', 19, 26);
      case '13.6':
        return sl('org-admin-settings', 26, 33);
      case '13.7':
        return sl('org-admin-settings', 33, 40);
      case '13.8':
        return sl('org-admin-settings', 40, 50);
      case '14.1':
        return sl('org-admin-audit-logs', 0, 4);
      case '14.2':
        return sl('org-admin-audit-logs', 4, 8);
      case '14.3':
        return sl('org-admin-audit-logs', 8, 11);
      default:
        throw new Error(`Unhandled org-admin ref ${ref}`);
    }
  }

  if (role === 'manager') {
    switch (ref) {
      case '1.1':
        return P.loginManager();
      case '1.2':
        return sl('manager-logging-in', 0, 2);
      case '1.3':
        return sl('manager-logging-in', 2, 3);
      case '2.1':
        return sl('manager-dashboard', 0, 2);
      case '2.2':
        return sl('manager-dashboard', 2, 3);
      case '2.3':
        return sl('manager-dashboard', 3, 4);
      case '3.1':
        return sl('manager-team', 0, 8);
      case '3.2':
        return sl('manager-team', 8, 12);
      case '3.3':
        return sl('manager-team', 12, 16);
      case '4.1':
        return sl('manager-leave-approval', 0, 1);
      case '4.2':
        return sl('manager-leave-approval', 1, 4);
      case '4.3':
        return sl('manager-leave-approval', 4, 6);
      case '4.4':
        return sl('manager-leave-approval', 6, 8);
      case '5.1':
        return sl('manager-performance', 0, 4);
      case '5.2':
        return sl('manager-performance', 4, 9);
      case '5.3':
        return sl('manager-performance', 9, 12);
      case '5.4':
        return sl('manager-performance', 12, 16);
      case '6.1':
        return sl('manager-tasks', 0, 6);
      case '6.2':
        return managerCreateTaskSave();
      case '6.3':
        return sl('manager-tasks', 7, 14);
      case '7.1':
        return sl('manager-other-features', 0, 7);
      case '7.2':
        return P.managerRaiseTicketAndReply();
      case '7.3':
        return sl('manager-other-features', 7, 11);
      case '7.4':
        return sl('manager-other-features', 11, 14);
      case '7.5':
        return sl('manager-other-features', 14, 18);
      case '7.6':
        return sl('manager-other-features', 7, 11);
      default:
        throw new Error(`Unhandled manager ref ${ref}`);
    }
  }

  if (role === 'employee') {
    switch (ref) {
      case '1.1':
        return sl('employee-getting-started', 0, 1);
      case '1.2':
        return P.loginEmployee();
      case '1.3':
        return sl('employee-settings', 3, 5);
      case '2.1':
        return sl('employee-dashboard', 0, 2);
      case '2.2':
        return sl('employee-dashboard', 2, 3);
      case '2.3':
        return sl('employee-dashboard', 3, 4);
      case '3.1':
        return sl('employee-profile', 0, 4);
      case '3.2':
        return sl('employee-profile', 4, 7);
      case '3.3':
        return sl('employee-profile', 4, 7);
      case '4.1':
        return sl('employee-leave', 0, 6);
      case '4.2':
        return P.employeeSubmitLeaveRequest(sl('employee-leave', 0, 6));
      case '4.3':
        return sl('employee-leave', 10, 14);
      case '4.4':
        return sl('employee-leave', 10, 14);
      case '5.1':
        return sl('employee-calendar', 0, 3);
      case '5.2':
        return sl('employee-calendar', 3, 5);
      case '6.1':
        return sl('employee-directory', 0, 8);
      case '6.2':
        return sl('employee-directory', 8, 13);
      case '7.1':
        return sl('employee-tasks', 0, 4);
      case '7.2':
        return sl('employee-tasks', 4, 7);
      case '7.3':
        return sl('employee-tasks', 0, 4);
      case '8.1':
        return sl('employee-performance', 0, 4);
      case '8.2':
        return sl('employee-performance', 4, 9);
      case '8.3':
        return sl('employee-performance', 9, 12);
      case '8.4':
        return sl('employee-performance', 12, 15);
      case '9.1':
        return sl('employee-tickets', 0, 4);
      case '9.2':
        return P.employeeCreateTicket();
      case '9.3':
        return sl('employee-tickets', 0, 4);
      case '9.4':
        return sl('employee-tickets', 9, 14);
      case '10.1':
        return sl('employee-knowledge', 0, 5);
      case '10.2':
        return sl('employee-knowledge', 5, 13);
      case '11.1':
        return sl('employee-onboarding', 0, 4);
      case '11.2':
        return sl('employee-onboarding', 4, 7);
      case '12.1':
        return sl('employee-settings', 0, 3);
      case '12.2':
        return sl('employee-settings', 3, 5);
      default:
        throw new Error(`Unhandled employee ref ${ref}`);
    }
  }

  if (role === 'partner-admin') {
    switch (ref) {
      case '1.1':
        return P.loginPartnerAdmin();
      case '1.2':
        return sl('partner-admin-logging-in', 1, 2);
      case '1.3':
        return sl('partner-admin-logging-in', 2, 4);
      case '1.4':
        return sl('partner-admin-logging-in', 0, 4);
      case '2.1':
        return sl('partner-admin-tenants', 0, 1);
      case '2.2':
        return P.partnerCreateTenantSave();
      case '2.3':
        return sl('partner-admin-tenants', 7, 14);
      case '2.4':
        return sl('partner-admin-tenants', 8, 12);
      case '2.5':
        return sl('partner-admin-tenants', 7, 11);
      case '2.6':
        return sl('partner-admin-tenants', 12, 14);
      case '3.1':
        return sl('partner-admin-tickets', 0, 3);
      case '3.2':
        return sl('partner-admin-tickets', 3, 8);
      case '3.3':
        return sl('partner-admin-tickets', 8, 11);
      case '3.4':
        return sl('partner-admin-tickets', 11, 13);
      case '3.5':
        return sl('partner-admin-tickets', 13, 15);
      case '3.6':
        return sl('partner-admin-tickets', 15, 16);
      default:
        throw new Error(`Unhandled partner-admin ref ${ref}`);
    }
  }

  throw new Error(`Unknown role ${role}`);
}

function orgAdminInviteFlow(): TourStep[] {
  return [
    ...navTo('Users', 'Users — open profile for invitation'),
    { action: 'click', selector: SEARCH },
    { action: 'type', selector: SEARCH, text: 'manualtest' },
    { action: 'wait', ms: 1200 },
    {
      action: 'click',
      selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child',
      label: 'User profile — Send Invitation when available',
    },
    { action: 'wait', ms: 2000 },
    {
      action: 'click',
      selector: 'button:has-text("Send Invitation"), button:has-text("Send invitation")',
      label: 'Invitation sent — checklist for secure password setup email',
    },
    { action: 'wait', ms: 2000 },
  ];
}

function orgAdminOffboardFlow(): TourStep[] {
  return [
    ...navTo('Users', 'Users — disposable test employee only'),
    { action: 'click', selector: SEARCH },
    { action: 'type', selector: SEARCH, text: 'ManualTest' },
    { action: 'wait', ms: 1200 },
    {
      action: 'click',
      selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child',
      label: 'Profile — Offboard / Suspend (do not use on real employees)',
    },
    { action: 'wait', ms: 2000 },
    {
      action: 'screenshot',
      label: 'Offboarding wizard — leaving date and reason (complete only in sandbox)',
    },
  ];
}

function managerCreateTaskSave(): TourStep[] {
  return [
    ...sl('manager-tasks', 0, 6),
    {
      action: 'click',
      selector:
        'button:has-text("Create Task"), button:has-text("Create task"), button:has-text("New Task")',
      label: 'Create Task — delegate to a direct report',
    },
    { action: 'wait', ms: 1500 },
    {
      action: 'type',
      selector: 'input[name*="title"], input[placeholder*="Title"]',
      text: '[ManualTest] Manager delegation',
    },
    {
      action: 'click',
      selector: 'button:has-text("Save"), button:has-text("Create")',
      label: 'Task saved — visible to assignee',
    },
    { action: 'wait', ms: 2500 },
  ];
}
