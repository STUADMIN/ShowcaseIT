/**
 * Full job-function tours that go beyond chapter slices (login, Save/Create, Submit).
 */
import type { TourStep } from './types';
import { navTo } from './hr-archive-36';

const EMAIL = 'input[type="email"], input[name="email"]';
const PASS = 'input[type="password"], input[name="password"]';
const SEARCH =
  'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]';

export function loginOrgAdmin(): TourStep[] {
  return [
    {
      action: 'screenshot',
      label: 'Sign in page — Organisation Admin for platform-demo',
      waitFor: EMAIL,
    },
    { action: 'type', selector: EMAIL, text: 'helen.richardson@platform-demo.com' },
    { action: 'type', selector: PASS, text: 'Demo123!' },
    {
      action: 'click',
      selector: 'button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")',
      label: 'Admin Dashboard — Organisation Admin home',
    },
    { action: 'wait', ms: 2500 },
  ];
}

export function loginManager(): TourStep[] {
  return [
    { action: 'screenshot', label: 'Sign in page — Manager', waitFor: EMAIL },
    { action: 'type', selector: EMAIL, text: 'david.kowalski@platform-demo.com' },
    { action: 'type', selector: PASS, text: 'Demo123!' },
    {
      action: 'click',
      selector: 'button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")',
      label: 'Manager Dashboard — signed in',
    },
    { action: 'wait', ms: 2500 },
  ];
}

export function loginEmployee(): TourStep[] {
  return [
    { action: 'screenshot', label: 'Sign in page — Employee', waitFor: EMAIL },
    { action: 'type', selector: EMAIL, text: 'ben.taylor@platform-demo.com' },
    { action: 'type', selector: PASS, text: 'Demo123!' },
    {
      action: 'click',
      selector: 'button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")',
      label: 'Employee Dashboard — signed in',
    },
    { action: 'wait', ms: 2500 },
  ];
}

export function loginPartnerAdmin(): TourStep[] {
  return [
    { action: 'screenshot', label: 'Partner Admin Console — sign in', waitFor: EMAIL },
    { action: 'type', selector: EMAIL, text: 'partner.admin@meridian-hr.com' },
    { action: 'type', selector: PASS, text: 'Demo123!' },
    {
      action: 'click',
      selector: 'button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")',
      label: 'Admin Console — signed in as partner',
    },
    { action: 'wait', ms: 2500 },
  ];
}

/** After Users list slice prefix: open New Hire wizard, complete minimal path, Create Employee. */
export function orgAdminCreateUserSave(prefix: TourStep[]): TourStep[] {
  const advanceJobToReview: TourStep[] = [];
  for (let i = 0; i < 8; i++) {
    advanceJobToReview.push({
      action: 'click',
      selector: 'button:has-text("Next"), button:has-text("Skip")',
    });
    advanceJobToReview.push({ action: 'wait', ms: 900 });
  }
  return [
    ...prefix,
    {
      action: 'click',
      selector: 'button:has-text("Add new user"), button:has-text("Add User")',
      label: 'Add new user — open hire wizard',
    },
    { action: 'wait', ms: 2500 },
    { action: 'screenshot', label: 'New hire wizard — Personal (step 1)' },
    { action: 'type', selector: 'input[placeholder="e.g. Alex"]', text: 'ManualTest' },
    { action: 'type', selector: 'input[placeholder="e.g. Taylor"]', text: 'RecordHire' },
    { action: 'type', selector: 'input[placeholder="email@company.com"]', text: 'manualtest.hire.playwright@example.com' },
    { action: 'click', selector: 'button:has-text("Next")' },
    { action: 'wait', ms: 1500 },
    { action: 'type', selector: 'input[type="date"]', text: '2026-06-15' },
    { action: 'wait', ms: 400 },
    ...advanceJobToReview,
    {
      action: 'click',
      selector: 'button:has-text("Create Employee"), button:has-text("Creating")',
      label: 'Create Employee — user record saved (or validation message)',
    },
    { action: 'wait', ms: 5000 },
  ];
}

/** Org admin: create task and save (after task list slice). */
export function orgAdminCreateTaskSave(prefix: TourStep[]): TourStep[] {
  return [
    ...prefix,
    {
      action: 'click',
      selector: 'button:has-text("Create Task"), button:has-text("Create task"), button:has-text("New Task")',
      label: 'Create Task — new organisational task',
    },
    { action: 'wait', ms: 1500 },
    { action: 'screenshot', label: 'Task form — title, category, priority, due date, assignees' },
    {
      action: 'type',
      selector: 'input[name*="title"], textarea[name*="title"], input[placeholder*="Title"]',
      text: '[ManualTest] Recording workflow task',
    },
    {
      action: 'click',
      selector: 'button:has-text("Save"), button:has-text("Create"), button:has-text("Submit")',
      label: 'Task saved — appears in task list',
    },
    { action: 'wait', ms: 2500 },
  ];
}

/** Tickets (admin): New Ticket modal and Create Ticket. */
export function orgAdminNewTicketFromInbox(): TourStep[] {
  return [
    ...navTo(
      'Tickets',
      'Ticket inbox — filter and triage employee support requests',
    ),
    {
      action: 'click',
      selector:
        'button:has-text("New Ticket"), button:has-text("New ticket"), a:has-text("New Ticket")',
      label: 'New Ticket — open modal from admin tickets',
    },
    { action: 'wait', ms: 1500 },
    { action: 'screenshot', label: 'New Ticket modal — subject, category, priority, description' },
    {
      action: 'type',
      selector: 'input[name*="subject"], input[placeholder*="Subject"]',
      text: '[ManualTest] Admin recording ticket',
    },
    {
      action: 'type',
      selector: 'textarea[name*="description"], textarea[placeholder*="Description"]',
      text: 'Smoke test body for documentation recording.',
    },
    {
      action: 'click',
      selector: 'button:has-text("Create Ticket"), button:has-text("Create")',
      label: 'Ticket created — returns to inbox or detail',
    },
    { action: 'wait', ms: 3000 },
  ];
}

/** Manager: raise ticket with Create, then open it and add a reply. */
export function managerRaiseTicketAndReply(): TourStep[] {
  return [
    ...navTo('Raise a Ticket', 'Raise a Ticket — your support requests'),
    {
      action: 'click',
      selector: 'button:has-text("Raise a Ticket"), button:has-text("New Ticket"), button:has-text("New ticket")',
      label: 'Raise a Ticket — open modal',
    },
    { action: 'wait', ms: 1500 },
    { action: 'screenshot', label: 'Ticket form — subject, category, priority, description' },
    {
      action: 'type',
      selector: 'input[name*="subject"], input[placeholder*="Subject"]',
      text: '[ManualTest] Manager recording',
    },
    {
      action: 'type',
      selector: 'textarea[name*="description"], textarea[placeholder*="Description"]',
      text: 'Need policy clarification for documentation.',
    },
    {
      action: 'click',
      selector: 'button:has-text("Create"), button:has-text("Submit")',
      label: 'Ticket submitted — appears in your list',
    },
    { action: 'wait', ms: 2500 },
    {
      action: 'click',
      selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child',
      label: 'Open ticket — conversation thread',
    },
    { action: 'wait', ms: 2000 },
    {
      action: 'screenshot',
      label: 'Reply to ticket — add message and Send',
    },
    {
      action: 'type',
      selector: 'textarea[name*="message"], textarea[placeholder*="message"], textarea[placeholder*="Reply"]',
      text: 'Thanks — resolved for recording.',
    },
    {
      action: 'click',
      selector: 'button:has-text("Send"), button:has-text("Post")',
      label: 'Reply sent — thread updated',
    },
    { action: 'wait', ms: 2000 },
  ];
}

/** Employee: submit leave request (after balances slice). */
export function employeeSubmitLeaveRequest(prefix: TourStep[]): TourStep[] {
  return [
    ...prefix,
    {
      action: 'click',
      selector:
        'button:has-text("Request Leave"), button:has-text("Book Time Off"), button:has-text("Request")',
      label: 'Request Leave — booking form',
    },
    { action: 'wait', ms: 1500 },
    { action: 'screenshot', label: 'Choose leave type and dates — add optional note' },
    {
      action: 'click',
      selector: 'button:has-text("Submit"), button:has-text("Request"), button:has-text("Save")',
      label: 'Leave request submitted — pending manager approval',
    },
    { action: 'wait', ms: 2500 },
  ];
}

/** Employee: create ticket via Raise a Ticket. */
export function employeeCreateTicket(): TourStep[] {
  return [
    ...navTo('Raise a Ticket', 'Raise a Ticket — support queue'),
    {
      action: 'click',
      selector: 'button:has-text("Raise a Ticket"), button:has-text("New Ticket"), button:has-text("New ticket")',
      label: 'Raise a Ticket — modal',
    },
    { action: 'wait', ms: 1500 },
    {
      action: 'type',
      selector: 'input[name*="subject"], input[placeholder*="Subject"]',
      text: '[ManualTest] Employee recording',
    },
    {
      action: 'type',
      selector: 'textarea[name*="description"], textarea[placeholder*="Description"]',
      text: 'Need VPN help for documentation recording.',
    },
    {
      action: 'click',
      selector: 'button:has-text("Create"), button:has-text("Submit")',
      label: 'Ticket created',
    },
    { action: 'wait', ms: 2500 },
  ];
}

/** Partner: fill New Tenant and Create Tenant (static test org). */
export function partnerCreateTenantSave(): TourStep[] {
  return [
    {
      action: 'screenshot',
      label: 'Customer Tenants — New Tenant',
      waitFor: 'h1,h2',
    },
    {
      action: 'click',
      selector: 'button:has-text("New Tenant"), button:has-text("New tenant"), a:has-text("New Tenant")',
      label: 'New Tenant — organisation form',
    },
    { action: 'wait', ms: 1500 },
    { action: 'screenshot', label: 'Organisation name, slug, billing, and plan' },
    {
      action: 'type',
      selector: 'input[name*="name"], input[placeholder*="Organisation"], input[placeholder*="name"]',
      text: 'ManualTest Org Playwright',
    },
    {
      action: 'type',
      selector: 'input[name*="slug"], input[placeholder*="slug"]',
      text: 'manualtest-playwright',
    },
    {
      action: 'click',
      selector: 'button:has-text("Create Tenant"), button:has-text("Create")',
      label: 'Tenant created — detail or list refresh',
    },
    { action: 'wait', ms: 3500 },
  ];
}
