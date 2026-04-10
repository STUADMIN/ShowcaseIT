import type { TourStep } from './types';
import { setupEmployeeTickets, setupOrgAdminTickets, setupPartnerAdminTickets } from './hr-manifest-setup';

/* ------------------------------------------------------------------ */
/*  HR-specific entry types                                            */
/* ------------------------------------------------------------------ */

export type HRRole = 'org-admin' | 'manager' | 'employee' | 'partner-admin';

export interface SetupContext {
  /** PrismaClient connected to the HR platform database (raw queries only). */
  prisma: {
    $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Promise<T>;
    $executeRawUnsafe(query: string, ...values: any[]): Promise<number>;
  };
  orgId: string;
  userMap: Map<string, string>;
}

export interface HRDocEntry {
  id: string;
  title: string;
  description: string;
  /** Determines login credentials and project grouping. */
  role: HRRole;
  /**
   * Initial route after login (relative to HR_BASE_URL).
   * Most entries start from the dashboard then navigate via sidebar.
   */
  route: string;
  tour: TourStep[];
  /**
   * Optional setup that runs before the tour to ensure prerequisite data
   * exists in the HR platform database (e.g. tickets for multi-actor flows).
   */
  setup?: (ctx: SetupContext) => Promise<void>;
}

export const HR_CREDENTIALS: Record<HRRole, { email: string; password: string }> = {
  'org-admin': { email: 'helen.richardson@platform-demo.com', password: 'Demo123!' },
  'manager': { email: 'david.kowalski@platform-demo.com', password: 'Demo123!' },
  'employee': { email: 'ben.taylor@platform-demo.com', password: 'Demo123!' },
  'partner-admin': { email: 'partner.admin@meridian-hr.com', password: 'Demo123!' },
};

export const HR_ROLE_PROJECT_NAME: Record<HRRole, string> = {
  'org-admin': 'Organisation Admin Guide',
  'manager': 'Manager Guide',
  'employee': 'Employee Guide',
  'partner-admin': 'Partner Admin Guide',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Sidebar nav click + wait + screenshot pattern used by most entries. */
function navTo(label: string, screenshotLabel: string, waitMs = 2000): TourStep[] {
  return [
    { action: 'click', selector: `a:has-text("${label}")` },
    { action: 'wait', ms: waitMs },
    { action: 'screenshot', label: screenshotLabel },
  ];
}

/* ================================================================== */
/*  ORGANISATION ADMIN GUIDE  (14 entries)                             */
/* ================================================================== */

const orgAdminEntries: HRDocEntry[] = [
  /* -------------------------------------------------------------- */
  /*  1. Logging In and Navigating the System                        */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-logging-in',
    title: '1. Logging In and Navigating the System',
    description: 'Sign in as Organisation Admin, explore the sidebar, and switch between Admin and Employee views.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    tour: [
      { action: 'screenshot', label: 'Admin Dashboard — landing page after signing in as Organisation Admin', waitFor: 'h1,h2' },
      { action: 'screenshot', label: 'Left sidebar — all primary navigation items available to Organisation Admins' },
      { action: 'scroll', deltaY: 400, label: 'Sidebar continued — Settings, Health & Safety, Activity Log at the bottom' },
      { action: 'scroll', y: 0 },
      { action: 'click', selector: 'text=Employee', label: 'Switch to Employee view — see the system from an employee\'s perspective' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Employee view — self-service dashboard with personal tasks and leave' },
      { action: 'click', selector: 'text=Admin', label: 'Switch back to Admin view — return to the full administration view' },
      { action: 'wait', ms: 2000 },
    ],
  },

  /* -------------------------------------------------------------- */
  /*  2. Admin Dashboard Overview                                     */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-dashboard',
    title: '2. Admin Dashboard Overview',
    description: 'Dashboard components including activity feed, movements, task summary, celebrations, and quick actions.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    tour: [
      { action: 'screenshot', label: 'Admin Dashboard — activity feed and key metrics snapshot', waitFor: 'h1,h2' },
      { action: 'scroll', deltaY: 400, label: 'Upcoming movements — new starters, leavers, and role changes' },
      { action: 'scroll', deltaY: 400, label: 'Task summary — overdue and upcoming items requiring attention' },
      { action: 'scroll', deltaY: 400, label: 'Celebrations — birthdays and work anniversaries across the organisation' },
      { action: 'scroll', deltaY: 400, label: 'Training gaps — compliance issues highlighted for action' },
      { action: 'scroll', y: 0 },
      { action: 'screenshot', label: 'Quick action links — Add new user, View all tasks, and other shortcuts' },
    ],
  },

  /* -------------------------------------------------------------- */
  /*  3. Managing Users                                               */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-managing-users',
    title: '3. Managing Users',
    description: 'View the user list, create new users, edit profiles, send invitations, and manage offboarding.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    tour: [
      // 3.1 Viewing the User List
      ...navTo('Users', 'User list — all employees with name, email, department, job title, and status'),
      { action: 'click', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]' },
      { action: 'type', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', text: 'helen' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Search users — filter by name, email, department, or job title' },
      { action: 'type', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', text: '' },
      { action: 'wait', ms: 500 },

      // 3.2 Creating a New User
      { action: 'click', selector: 'button:has-text("Add User"), button:has-text("Add user")', label: 'Add User — open the new user form' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'New user form — required fields: first name, last name, email, country, access level' },
      { action: 'scroll', deltaY: 400, label: 'Optional fields — department, division, job title, employee number, contact details' },
      { action: 'scroll', deltaY: 400, label: 'Additional fields — date of birth, gender, marital status, phone numbers, address' },
      // Navigate back without saving
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },

      // 3.3 Editing a User Profile
      ...navTo('Users', 'User list — click any employee name to open their profile'),
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child', label: 'Open employee profile — click to view full details' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'User profile — Personal tab with name, contact details, and address' },
      { action: 'click', selector: '[role="tab"]:has-text("Employment"), button:has-text("Employment"), a:has-text("Employment")' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Employment tab — job title, department, division, reports to, start date' },
      { action: 'click', selector: '[role="tab"]:has-text("Pay"), button:has-text("Pay"), a:has-text("Pay")' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Pay tab — salary, pay group, pay schedule, currency' },
      { action: 'click', selector: '[role="tab"]:has-text("Leave"), button:has-text("Leave"), a:has-text("Leave")' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Leave tab — leave balances, policy assignments, and time-off history' },
      { action: 'click', selector: '[role="tab"]:has-text("Documents"), button:has-text("Documents"), a:has-text("Documents")' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Documents tab — uploaded files and attachments for this employee' },
      { action: 'click', selector: '[role="tab"]:has-text("Emergency"), button:has-text("Emergency"), a:has-text("Emergency")' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Emergency contacts tab — next-of-kin details' },
      { action: 'click', selector: '[role="tab"]:has-text("Notes"), button:has-text("Notes"), a:has-text("Notes")' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Notes tab — internal admin notes about this employee' },
      { action: 'click', selector: '[role="tab"]:has-text("Training"), button:has-text("Training"), a:has-text("Training")' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Training tab — training records and compliance status' },
    ],
  },

  /* -------------------------------------------------------------- */
  /*  4. Company Directory and Org Chart                              */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-directory-org-chart',
    title: '4. Company Directory and Org Chart',
    description: 'Browse the staff directory and view the visual organisation hierarchy.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    tour: [
      // 4.1 Using the Directory
      ...navTo('Directory', 'Company Directory — searchable list of all employees with name, job title, department, and contact details'),
      { action: 'click', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]' },
      { action: 'type', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', text: 'david' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Directory search — find employees by name, department, or job title' },
      { action: 'type', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', text: '' },
      { action: 'wait', ms: 500 },
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child', label: 'Click any person to view their profile' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Employee profile — accessed from the directory view' },

      // 4.2 Viewing the Org Chart
      ...navTo('Org Chart', 'Org Chart — visual reporting hierarchy of the organisation'),
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Org Chart — click nodes to expand or collapse teams, use zoom controls to navigate' },
    ],
  },

  /* -------------------------------------------------------------- */
  /*  5. Calendar                                                     */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-calendar',
    title: '5. Calendar',
    description: 'Company-wide calendar showing leave requests, public holidays, birthdays, and anniversaries.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    tour: [
      ...navTo('Calendar', 'Company Calendar — leave requests, public holidays, birthdays, and work anniversaries'),
      { action: 'screenshot', label: 'Calendar view — approved, pending, and rejected leave for all employees' },
      { action: 'scroll', deltaY: 300, label: 'Calendar entries — click any entry to see details about the leave or event' },
      { action: 'scroll', y: 0 },
      { action: 'screenshot', label: 'Calendar controls — toggle month/week view, filter by department, team, or individual' },
    ],
  },

  /* -------------------------------------------------------------- */
  /*  6. Managing Tasks                                               */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-tasks',
    title: '6. Managing Tasks',
    description: 'View, create, and update organisational tasks with categories, priorities, and assignees.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    tour: [
      // 6.1 Viewing Tasks
      ...navTo('Tasks', 'Task list — all organisational tasks with title, category, priority, status, due date, and assignees'),
      { action: 'scroll', deltaY: 300, label: 'Task filters — filter by status, priority, category, or assignee' },
      { action: 'scroll', y: 0 },

      // 6.2 Creating a New Task
      { action: 'click', selector: 'button:has-text("Create Task"), button:has-text("Create task"), button:has-text("New Task")', label: 'Create Task — open the new task form' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'New task form — title, category, priority, due date, and assignees' },
      // Navigate back without saving
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },

      // 6.3 Updating Task Status
      ...navTo('Tasks', 'Task list — click any task to open it and change status'),
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Task detail — change status (Open, In Progress, Completed), add comments to track progress' },
    ],
  },

  /* -------------------------------------------------------------- */
  /*  7. Leave and Time Off Administration                            */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-leave',
    title: '7. Leave and Time Off Administration',
    description: 'View leave requests, approve or reject time off, configure leave policies, and manage working patterns.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    tour: [
      // 7.1 Viewing Leave Requests
      ...navTo('Calendar', 'Calendar — visual overview of all leave across the organisation'),

      // 7.2 Approving or Rejecting Leave — navigate to a user's leave tab
      ...navTo('Users', 'Users list — click an employee to see their individual leave history'),
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child' },
      { action: 'wait', ms: 2000 },
      { action: 'click', selector: '[role="tab"]:has-text("Leave"), button:has-text("Leave"), a:has-text("Leave")' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Employee leave tab — balances, pending requests, and history with Approve/Reject actions' },

      // 7.3 Configuring Leave Policies
      ...navTo('Settings', 'Settings — navigate to Time & Leave configuration'),
      { action: 'wait', ms: 1500 },
      { action: 'click', selector: 'a:has-text("Time & Leave"), a:has-text("Time"), button:has-text("Time & Leave")', label: 'Time & Leave settings — holidays, leave policies, approval workflows' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Time & Leave — manage public holidays, leave policies, and approval workflows' },
      { action: 'scroll', deltaY: 400, label: 'Leave policy settings — accrual type, frequency, carryover rules, and balance caps' },

      // 7.4 Managing Working Patterns
      { action: 'scroll', deltaY: 400, label: 'Working patterns — define which days are working days for accurate leave calculations' },
    ],
  },

  /* -------------------------------------------------------------- */
  /*  8. Performance Management                                       */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-performance',
    title: '8. Performance Management',
    description: 'Manage review cycles, templates, 360 feedback, and track performance across the organisation.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    tour: [
      // 8.1 Performance Overview
      ...navTo('Performance', 'Performance hub — active review cycles, templates, and 360 feedback requests'),
      { action: 'scroll', deltaY: 300, label: 'Active review cycles — progress tracking and completion status' },

      // 8.2 Managing Review Cycles
      { action: 'scroll', y: 0 },
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child, a:has-text("Review"), [class*="card"]:first-child' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Review cycle detail — all review instances with status and completion percentage' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },

      // 8.3 Creating a New Review Cycle
      ...navTo('Performance', 'Performance page — click Create Cycle to start a new review'),
      { action: 'click', selector: 'button:has-text("Create Cycle"), button:has-text("Create cycle"), button:has-text("New Cycle")', label: 'Create Cycle — select template, set name, start and end dates' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'New review cycle form — template selection, cycle name, and date range' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },

      // 8.4 Managing Review Templates
      ...navTo('Performance', 'Performance page — navigate to Templates'),
      { action: 'click', selector: 'a:has-text("Templates"), button:has-text("Templates"), [role="tab"]:has-text("Templates")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Review templates — text, scale 1-5, multiple choice, and two-axis graph question types' },

      // 8.5 360 Feedback
      { action: 'click', selector: 'a:has-text("360"), button:has-text("360"), [role="tab"]:has-text("360")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: '360 Feedback — requests with subject, reviewers, template, and completion status' },
    ],
  },

  /* -------------------------------------------------------------- */
  /*  9. Announcements                                                */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-announcements',
    title: '9. Announcements',
    description: 'View, create, edit, and manage company-wide announcements with audience targeting and pinning.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    tour: [
      // 9.1 Viewing Announcements
      ...navTo('Announcements', 'Announcements — published, draft, and scheduled announcements with pinned items at top'),
      { action: 'scroll', deltaY: 300, label: 'Announcement list — title, priority, audience, and publication status' },

      // 9.2 Creating an Announcement
      { action: 'scroll', y: 0 },
      { action: 'click', selector: 'button:has-text("Create Announcement"), button:has-text("Create announcement"), button:has-text("New Announcement")', label: 'Create Announcement — new company-wide message' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Announcement form — title, rich text body, priority, audience, and pin toggle' },
      { action: 'scroll', deltaY: 400, label: 'Audience targeting — all employees or filtered by team, division, or country' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },

      // 9.3 Editing or Removing Announcements
      ...navTo('Announcements', 'Announcements — click any existing announcement to edit content, audience, or priority'),
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child, [class*="card"]:first-child a' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Edit announcement — update content, unpublish, or delete announcements no longer relevant' },
    ],
  },

  /* -------------------------------------------------------------- */
  /*  10. Tickets (Helpdesk)                                          */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-tickets',
    title: '10. Tickets (Helpdesk)',
    description: 'Manage the ticket inbox, respond to employee support requests, and configure ticket categories.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    setup: setupOrgAdminTickets,
    tour: [
      // 10.1 Ticket Inbox Overview
      ...navTo('Tickets', 'Ticket inbox — all support tickets raised by employees with subject, requester, status, priority, and category'),
      { action: 'scroll', deltaY: 300, label: 'Ticket filters — sort by status, category, or assignee' },

      // 10.2 Responding to a Ticket
      { action: 'scroll', y: 0 },
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Ticket conversation — read messages, reply, assign, change status, and escalate' },
      { action: 'scroll', deltaY: 400, label: 'Reply box — type response, change status and priority, or assign to another admin' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },

      // 10.3 Managing Ticket Categories
      ...navTo('Settings', 'Settings — navigate to Integrations & Data for ticket categories'),
      { action: 'wait', ms: 1500 },
      { action: 'click', selector: 'a:has-text("Integrations"), a:has-text("Integrations & Data"), button:has-text("Integrations")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Ticket Categories — add, edit, or remove categories employees select when raising tickets' },
    ],
  },

  /* -------------------------------------------------------------- */
  /*  11. Knowledge Centre                                            */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-knowledge-centre',
    title: '11. Knowledge Centre',
    description: 'Manage knowledge base articles — create, edit, organise by category, and publish for employees.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    tour: [
      // 11.1 Managing Articles
      ...navTo('Knowledge Centre', 'Knowledge Centre — all published and draft articles organised by category'),
      { action: 'scroll', deltaY: 300, label: 'Article list — title, category, and publication status' },

      // 11.2 Creating a New Article
      { action: 'scroll', y: 0 },
      { action: 'click', selector: 'button:has-text("Create Article"), button:has-text("Create article"), button:has-text("New Article")', label: 'Create Article — new knowledge base entry' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Article form — title, category, rich text content, and Published/Draft toggle' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },

      // 11.3 Editing and Organising Articles
      ...navTo('Knowledge Centre', 'Knowledge Centre — click any article to edit content, category, or status'),
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child, [class*="card"]:first-child a' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Edit article — update content and use categories to organise by topic' },
    ],
  },

  /* -------------------------------------------------------------- */
  /*  12. Reports and Analytics                                       */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-reports',
    title: '12. Reports and Analytics',
    description: 'Reports hub, headcount trends, additions and terminations, turnover, and Bradford Factor scoring.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    tour: [
      // 12.1 Reports Hub
      ...navTo('Reports', 'Reports hub — saved reports, favourites, and ad-hoc query builder'),
      { action: 'scroll', deltaY: 300, label: 'Report types — custom reports, headcount, additions & terminations, turnover, Bradford Factor' },

      // 12.2 & 12.3 Running a Report
      { action: 'scroll', y: 0 },
      { action: 'screenshot', label: 'Set date range and filters — department, division, country — then view charts and data tables' },

      // 12.4 Headcount Report
      { action: 'click', selector: 'a:has-text("Headcount"), button:has-text("Headcount")' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Headcount report — monthly totals over time with breakdowns by department and division' },
      { action: 'scroll', deltaY: 400, label: 'Headcount chart — use breakdowns to see trends by department or other dimensions' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },

      // 12.5 Bradford Factor
      ...navTo('Reports', 'Reports — navigate to Bradford Factor'),
      { action: 'click', selector: 'a:has-text("Bradford"), button:has-text("Bradford")' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Bradford Factor — absence risk scoring based on sickness patterns for each employee' },
      { action: 'scroll', deltaY: 400, label: 'Bradford scores — higher values indicate frequent short-term absences, filter by policy and period' },
    ],
  },

  /* -------------------------------------------------------------- */
  /*  13. Settings and Configuration                                  */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-settings',
    title: '13. Settings and Configuration',
    description: 'Full settings grid — organisation, people & access, pay, time & leave, hiring, learning, H&S, integrations, and account.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    tour: [
      // 13.1 & 13.2 Accessing Settings and Categories
      ...navTo('Settings', 'Settings home — grid of configuration categories'),
      { action: 'scroll', deltaY: 400, label: 'Settings categories — Organisation, People & Access, Pay & Benefits, Time & Leave, and more' },
      { action: 'scroll', y: 0 },

      // 13.3 Configuring Departments
      { action: 'click', selector: 'a:has-text("Organisation"), button:has-text("Organisation")', label: 'Organisation settings — departments, divisions, seniority levels, job titles' },
      { action: 'wait', ms: 1500 },
      { action: 'click', selector: 'a:has-text("Departments"), button:has-text("Departments")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Departments — Management, Human Resources, Finance, Sales, Operations. Add or edit departments.' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },

      // 13.4 Managing Access Levels
      ...navTo('Settings', 'Settings — navigate to People & Access'),
      { action: 'click', selector: 'a:has-text("People & Access"), a:has-text("People"), button:has-text("People")' },
      { action: 'wait', ms: 1500 },
      { action: 'click', selector: 'a:has-text("Access Levels"), button:has-text("Access Levels")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Access Levels — Organisation Admin (full access), Manager (team management), UK Employee (self-service)' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },

      // 13.5 Configuring Onboarding Task Lists
      ...navTo('Settings', 'Settings — navigate to Hiring & Lifecycle'),
      { action: 'click', selector: 'a:has-text("Hiring"), a:has-text("Hiring & Lifecycle"), button:has-text("Hiring")' },
      { action: 'wait', ms: 1500 },
      { action: 'click', selector: 'a:has-text("Onboarding"), button:has-text("Onboarding")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Onboarding checklists — task items with title, description, lead time, priority, and assignee role' },

      // 13.6 Configuring Offboarding Task Lists
      { action: 'click', selector: 'a:has-text("Offboarding"), button:has-text("Offboarding")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Offboarding checklists — define leaving process checklist items triggered on offboarding' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },

      // 13.7 General Settings
      ...navTo('Settings', 'Settings — navigate to Account & Billing'),
      { action: 'click', selector: 'a:has-text("Account"), a:has-text("Account & Billing"), button:has-text("Account")' },
      { action: 'wait', ms: 1500 },
      { action: 'click', selector: 'a:has-text("General Settings"), a:has-text("General"), button:has-text("General")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'General Settings — date format, number format, timezone, default country, display name format' },
      { action: 'scroll', deltaY: 400, label: 'More settings — industry, employee self-service options (photo upload, expanded gender options)' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },

      // 13.8 Roles
      ...navTo('Settings', 'Settings — navigate to Roles'),
      { action: 'click', selector: 'a:has-text("People & Access"), a:has-text("People"), button:has-text("People")' },
      { action: 'wait', ms: 1500 },
      { action: 'click', selector: 'a:has-text("Roles"), button:has-text("Roles")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Organisational Roles — HR Team, Finance Team, H&S Officer, Fire Warden, First Aider, IT Support' },
    ],
  },

  /* -------------------------------------------------------------- */
  /*  14. Audit Logs and Activity History                             */
  /* -------------------------------------------------------------- */
  {
    id: 'org-admin-audit-logs',
    title: '14. Audit Logs and Activity History',
    description: 'Activity log, access history, and import history for compliance and audit purposes.',
    role: 'org-admin',
    route: '/?org=platform-demo',
    tour: [
      // 14.1 Activity Log
      ...navTo('Activity Log', 'Activity Log — chronological record of all system actions (user CRUD, leave, settings, logins)'),
      { action: 'scroll', deltaY: 300, label: 'Audit entries — filter by date range, user, or action type for compliance' },

      // 14.2 Access History
      { action: 'scroll', y: 0 },
      { action: 'click', selector: 'a:has-text("Access History"), button:has-text("Access History")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Access History — log of access level changes across the organisation' },

      // 14.3 Import History
      { action: 'click', selector: 'a:has-text("Import History"), button:has-text("Import History")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Import History — past bulk data imports and their results' },
    ],
  },
];

/* ================================================================== */
/*  MANAGER GUIDE  (7 entries)                                         */
/* ================================================================== */

const managerEntries: HRDocEntry[] = [
  {
    id: 'manager-logging-in',
    title: '1. Logging In and Navigating the System',
    description: 'Sign in as Manager, explore the sidebar, and understand manager-specific features.',
    role: 'manager',
    route: '/?org=platform-demo',
    tour: [
      { action: 'screenshot', label: 'Employee Dashboard — landing page for managers at /me/dashboard', waitFor: 'h1,h2' },
      { action: 'screenshot', label: 'Manager sidebar — Dashboard, My Profile, Directory, Org Chart, Calendar, Tasks, Performance, Tickets, Knowledge Centre' },
      { action: 'scroll', deltaY: 400, label: 'Manager features — team visibility, leave approval, and performance review completion' },
    ],
  },
  {
    id: 'manager-dashboard',
    title: '2. Manager Dashboard',
    description: 'Dashboard overview with team activity, pending approvals, celebrations, and quick actions.',
    role: 'manager',
    route: '/?org=platform-demo',
    tour: [
      { action: 'screenshot', label: 'Manager Dashboard — upcoming events, team activity, and pending approvals', waitFor: 'h1,h2' },
      { action: 'scroll', deltaY: 400, label: 'Pending leave approvals — click any request to review and approve or reject' },
      { action: 'scroll', deltaY: 400, label: 'Celebrations — birthdays and work anniversaries in your team' },
      { action: 'scroll', deltaY: 400, label: 'Quick actions — shortcuts to common manager tasks' },
    ],
  },
  {
    id: 'manager-team',
    title: '3. Managing Your Team',
    description: 'View direct reports in the directory and org chart, access team member profiles.',
    role: 'manager',
    route: '/?org=platform-demo',
    tour: [
      ...navTo('Directory', 'Directory — search or browse to find your direct reports'),
      { action: 'click', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]' },
      { action: 'type', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', text: 'Emma' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Search for team member — Emma Fletcher, Account Executive' },
      { action: 'type', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', text: '' },
      { action: 'wait', ms: 500 },
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child', label: 'Team member profile — personal details, employment, leave, and performance' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Team member profile — view personal details, employment info, and leave balances' },
      ...navTo('Org Chart', 'Org Chart — find yourself to see your direct reports visually'),
      { action: 'screenshot', label: 'Org Chart — expand nodes to see the reporting hierarchy below each person' },
    ],
  },
  {
    id: 'manager-leave-approval',
    title: '4. Approving Leave Requests',
    description: 'View pending requests, approve or reject leave, and check the team calendar for overlaps.',
    role: 'manager',
    route: '/?org=platform-demo',
    tour: [
      { action: 'screenshot', label: 'Dashboard — check for pending leave notifications requiring your action', waitFor: 'h1,h2' },
      ...navTo('Calendar', 'Calendar — visual overview of team leave with pending requests highlighted'),
      { action: 'screenshot', label: 'Team calendar — approved, pending, and rejected leave for your direct reports' },
      { action: 'scroll', deltaY: 300, label: 'Leave entries — click a pending request to review dates, type, duration, and balance' },
      { action: 'scroll', y: 0 },
      { action: 'screenshot', label: 'Approve or Reject — review details then click Approve to grant or Reject with a reason' },
    ],
  },
  {
    id: 'manager-performance',
    title: '5. Performance Reviews — Manager Actions',
    description: 'Access reviews, complete assessments for direct reports, view reports, and submit 360 feedback.',
    role: 'manager',
    route: '/?org=platform-demo',
    tour: [
      ...navTo('Performance', 'Performance — your own review, team reviews, and 360 feedback requests'),
      { action: 'screenshot', label: 'Performance hub — reviews where you are the subject and where you review direct reports' },
      { action: 'scroll', deltaY: 300, label: 'Team reviews — click any review instance where you are the manager' },
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child, [class*="card"]:first-child' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Review form — text questions, scale 1-5 ratings, and multiple choice for each section' },
      { action: 'scroll', deltaY: 400, label: 'Manager assessment — write performance comments, select ratings, and submit' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },
      ...navTo('Performance', 'Performance — check 360 Feedback requests'),
      { action: 'click', selector: 'a:has-text("360"), button:has-text("360"), [role="tab"]:has-text("360")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: '360 Feedback — answer questions about the colleague you are reviewing, then submit' },
    ],
  },
  {
    id: 'manager-tasks',
    title: '6. Task Management',
    description: 'View tasks assigned to you and your team, update status, add comments, and create new tasks.',
    role: 'manager',
    route: '/?org=platform-demo',
    tour: [
      ...navTo('Tasks', 'Tasks — tasks assigned to you and tasks you have delegated'),
      { action: 'screenshot', label: 'Task list — filter by status, priority, or category' },
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Task detail — update status (Open, In Progress, Completed) and add comments' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },
      ...navTo('Tasks', 'Tasks — create a new task'),
      { action: 'click', selector: 'button:has-text("Create Task"), button:has-text("Create task"), button:has-text("New Task")', label: 'Create Task — set title, category, priority, due date, and assignees' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'New task form — fill in details and click Save to create' },
    ],
  },
  {
    id: 'manager-other-features',
    title: '7. Tickets, Knowledge Centre, and Other Features',
    description: 'Raise tickets, browse knowledge articles, view your profile, and manage account settings.',
    role: 'manager',
    route: '/?org=platform-demo',
    tour: [
      ...navTo('Raise a Ticket', 'Raise a Ticket — submit support requests to HR or admin'),
      { action: 'click', selector: 'button:has-text("New Ticket"), button:has-text("New ticket")', label: 'New Ticket — fill in subject, category, and message' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'New ticket form — subject, category, and detailed description' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },
      ...navTo('Knowledge Centre', 'Knowledge Centre — browse published articles by category'),
      { action: 'screenshot', label: 'Knowledge Centre — search for topics or browse categories' },
      ...navTo('My Profile', 'My Profile — your personal HR profile and information'),
      { action: 'screenshot', label: 'Your profile — personal info, employment history, leave balances, and more' },
      { action: 'click', selector: 'a:has-text("Settings"), button:has-text("Settings")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Account settings — profile fields, birthday visibility, and notification preferences' },
    ],
  },
];

/* ================================================================== */
/*  EMPLOYEE GUIDE  (12 entries)                                       */
/* ================================================================== */

const employeeEntries: HRDocEntry[] = [
  {
    id: 'employee-getting-started',
    title: '1. Getting Started — First Login',
    description: 'Accept invitation, log in, and reset your password.',
    role: 'employee',
    route: '/?org=platform-demo',
    tour: [
      { action: 'screenshot', label: 'Employee Dashboard — your home screen after signing in', waitFor: 'h1,h2' },
      { action: 'screenshot', label: 'Welcome — if this is your first login, you may have arrived via an invitation email link' },
    ],
  },
  {
    id: 'employee-dashboard',
    title: '2. Employee Dashboard',
    description: 'Dashboard overview with upcoming events, pending actions, celebrations, announcements, and quick links.',
    role: 'employee',
    route: '/?org=platform-demo',
    tour: [
      { action: 'screenshot', label: 'Employee Dashboard — upcoming events, pending actions, and announcements', waitFor: 'h1,h2' },
      { action: 'scroll', deltaY: 400, label: 'Pending actions — tasks assigned to you and performance reviews to complete' },
      { action: 'scroll', deltaY: 400, label: 'Celebrations — birthdays and work anniversaries in your team' },
      { action: 'scroll', deltaY: 400, label: 'Announcements — pinned and recent company-wide messages' },
    ],
  },
  {
    id: 'employee-profile',
    title: '3. Viewing and Updating Your Profile',
    description: 'View personal information, update editable fields, and upload your photo.',
    role: 'employee',
    route: '/?org=platform-demo',
    tour: [
      ...navTo('My Profile', 'My Profile — personal information, contact details, employment, and leave balances'),
      { action: 'scroll', deltaY: 400, label: 'Contact details — phone numbers, email, and home address' },
      { action: 'scroll', deltaY: 400, label: 'Employment details — job title, department, division, start date, and reports to' },
      { action: 'scroll', y: 0 },
      { action: 'screenshot', label: 'Edit — click Edit on any section to update fields (if self-service editing is enabled)' },
    ],
  },
  {
    id: 'employee-leave',
    title: '4. Requesting Time Off (Leave)',
    description: 'Check leave balances, submit requests, track status, and cancel requests.',
    role: 'employee',
    route: '/?org=platform-demo',
    tour: [
      ...navTo('My Profile', 'My Profile — scroll to the Leave section to check balances'),
      { action: 'click', selector: '[role="tab"]:has-text("Leave"), button:has-text("Leave"), a:has-text("Leave")' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Leave balances — annual leave, sick leave, and other types with days used and remaining' },
      { action: 'click', selector: 'button:has-text("Request Leave"), button:has-text("Book Time Off"), button:has-text("Request")', label: 'Request Leave — open the leave request form' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Leave request form — select type, choose dates, system calculates working days, add notes' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },
      ...navTo('Calendar', 'Calendar — view your leave requests colour-coded by status'),
      { action: 'screenshot', label: 'Calendar — green (approved), yellow (pending), red (rejected) leave entries' },
    ],
  },
  {
    id: 'employee-calendar',
    title: '5. Using the Calendar',
    description: 'Calendar overview with your leave, team leave, public holidays, and event navigation.',
    role: 'employee',
    route: '/?org=platform-demo',
    tour: [
      ...navTo('Calendar', 'Calendar — your leave, team leave, public holidays, birthdays, and anniversaries'),
      { action: 'screenshot', label: 'Month view — switch between month and week views using the toggle' },
      { action: 'scroll', deltaY: 300, label: 'Calendar entries — click any date to see all events, click a leave entry for details' },
    ],
  },
  {
    id: 'employee-directory',
    title: '6. Company Directory and Org Chart',
    description: 'Browse the directory, search for colleagues, and view the organisation hierarchy.',
    role: 'employee',
    route: '/?org=platform-demo',
    tour: [
      ...navTo('Directory', 'Directory — browse all employees by name, department, or job title'),
      { action: 'click', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]' },
      { action: 'type', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', text: 'Sarah' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Directory search — find colleagues by name, department, or job title' },
      { action: 'type', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', text: '' },
      { action: 'wait', ms: 500 },
      ...navTo('Org Chart', 'Org Chart — visual hierarchy showing your manager and colleagues'),
      { action: 'screenshot', label: 'Org Chart — click nodes to expand or collapse teams' },
    ],
  },
  {
    id: 'employee-tasks',
    title: '7. Tasks',
    description: 'View assigned tasks, update status, and understand task categories.',
    role: 'employee',
    route: '/?org=platform-demo',
    tour: [
      ...navTo('Tasks', 'Tasks — all tasks assigned to you with title, category, priority, due date, and status'),
      { action: 'screenshot', label: 'Task list — Onboarding, Compliance, Training, and Administrative categories' },
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Task detail — update status (Open, In Progress, Completed) and add comments' },
    ],
  },
  {
    id: 'employee-performance',
    title: '8. Performance Reviews — Employee Actions',
    description: 'Access your reviews, complete self-assessments, view completed reports, and provide 360 feedback.',
    role: 'employee',
    route: '/?org=platform-demo',
    tour: [
      ...navTo('Performance', 'Performance — your active reviews and 360 feedback requests'),
      { action: 'screenshot', label: 'Your reviews — active self-assessments and completed review reports' },
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child, [class*="card"]:first-child' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Self-assessment form — text responses, scale 1-5 ratings, and multiple choice questions' },
      { action: 'scroll', deltaY: 400, label: 'Write about achievements, challenges, and goals — then submit when complete' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },
      ...navTo('Performance', 'Performance — check for 360 Feedback requests'),
      { action: 'click', selector: 'a:has-text("360"), button:has-text("360"), [role="tab"]:has-text("360")' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: '360 Feedback — answer questions about a colleague honestly and constructively' },
    ],
  },
  {
    id: 'employee-tickets',
    title: '9. Raising a Ticket (Helpdesk)',
    description: 'Create support tickets, track their status, and reply to admin responses.',
    role: 'employee',
    route: '/?org=platform-demo',
    setup: setupEmployeeTickets,
    tour: [
      ...navTo('Raise a Ticket', 'Raise a Ticket — all your submitted tickets and their statuses'),
      { action: 'screenshot', label: 'Ticket list — Open, In Progress, Resolved, and Closed tickets' },
      { action: 'click', selector: 'button:has-text("New Ticket"), button:has-text("New ticket")', label: 'New Ticket — create a support request' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'New ticket form — subject, category, and detailed message' },
      { action: 'navigate', path: '/?org=platform-demo', waitMs: 2000 },
      ...navTo('Raise a Ticket', 'Tickets — click any ticket to view the conversation thread'),
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Ticket conversation — read admin responses and reply with additional information' },
    ],
  },
  {
    id: 'employee-knowledge',
    title: '10. Knowledge Centre',
    description: 'Browse articles by category, search for topics, and read company policies and guides.',
    role: 'employee',
    route: '/?org=platform-demo',
    tour: [
      ...navTo('Knowledge Centre', 'Knowledge Centre — browse articles by category'),
      { action: 'screenshot', label: 'Article categories — HR Policies, IT Help, Benefits, and more' },
      { action: 'click', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]' },
      { action: 'type', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', text: 'policy' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Search articles — find articles on specific topics' },
      { action: 'type', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', text: '' },
      { action: 'wait', ms: 500 },
      { action: 'click', selector: 'table tbody tr:first-child a, [class*="card"]:first-child a, a[href*="article"]' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Article view — full content with company policies, step-by-step guides, and FAQ answers' },
    ],
  },
  {
    id: 'employee-onboarding',
    title: '11. Onboarding Checklist (New Starters)',
    description: 'Access and complete onboarding tasks as a new starter.',
    role: 'employee',
    route: '/?org=platform-demo',
    tour: [
      ...navTo('Tasks', 'Tasks — check for onboarding checklist items if you are a new starter'),
      { action: 'screenshot', label: 'Onboarding tasks — read policies, complete training, set up profile, meet your team' },
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Onboarding task detail — follow instructions and mark as Completed when finished' },
    ],
  },
  {
    id: 'employee-settings',
    title: '12. Account Settings',
    description: 'Manage personal account settings, birthday visibility, and notification preferences.',
    role: 'employee',
    route: '/?org=platform-demo',
    tour: [
      { action: 'click', selector: 'a:has-text("Settings"), button:has-text("Settings")' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Account settings — profile details, birthday visibility, and notification preferences' },
      { action: 'scroll', deltaY: 400, label: 'Notification preferences — control which notifications you receive' },
      { action: 'scroll', deltaY: 400, label: 'Password management — use the Forgot password flow from the login page to reset' },
    ],
  },
];

/* ================================================================== */
/*  PARTNER ADMIN GUIDE  (3 entries)                                   */
/* ================================================================== */

const partnerAdminEntries: HRDocEntry[] = [
  {
    id: 'partner-admin-logging-in',
    title: '1. Logging In and Navigating the Admin Console',
    description: 'Sign in to the Admin Console, navigate the sidebar, switch to customer organisations, and manage console access.',
    role: 'partner-admin',
    route: '/',
    tour: [
      { action: 'screenshot', label: 'Admin Console Dashboard — overview of customer tenants with key metrics', waitFor: 'h1,h2' },
      { action: 'screenshot', label: 'Admin Console sidebar — Dashboard, Customer Tenants, Partnerships, Escalated Tickets' },
      { action: 'scroll', deltaY: 400, label: 'Customer tenant stats — total tenants, total end users, and partner-managed count' },
      { action: 'scroll', deltaY: 400, label: 'Tenant table — organisation name, user count, billing plan, status, and creation date' },
    ],
  },
  {
    id: 'partner-admin-tenants',
    title: '2. Managing Customer Tenants',
    description: 'Create tenants, view details, update billing, add admins, and log in to customer organisations.',
    role: 'partner-admin',
    route: '/',
    tour: [
      // 2.1 Dashboard Overview
      { action: 'screenshot', label: 'Tenant overview — customer tenants, total end users, partner-managed count', waitFor: 'h1,h2' },

      // 2.2 Creating a New Tenant
      { action: 'click', selector: 'button:has-text("New Tenant"), button:has-text("New tenant"), a:has-text("New Tenant")', label: 'New Tenant — create a customer organisation' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'New tenant form — organisation name, slug, partner managed toggle, billing details, and plan' },
      { action: 'scroll', deltaY: 400, label: 'Billing details — email, contact, address, VAT, plan selection (Starter/Professional/Enterprise)' },
      { action: 'navigate', path: '/', waitMs: 2000 },

      // 2.3 Viewing Tenant Details
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child', label: 'Open tenant detail — click any row in the tenant list' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Tenant detail — header with name, slug, badge, user count, and creation date' },
      { action: 'scroll', deltaY: 400, label: 'Billing Details section — editable contact and address fields with Save Billing button' },
      { action: 'scroll', deltaY: 400, label: 'Admins section — Organisation Admins and Partner Admins with access to this tenant' },
      { action: 'screenshot', label: 'Add Admin — select role (Org Admin or Partner Admin), enter name and email, Create & Invite' },
      { action: 'scroll', y: 0 },
      { action: 'screenshot', label: 'Login to Organisation — switch into the customer org to use full Organisation Admin features' },
    ],
  },
  {
    id: 'partner-admin-tickets',
    title: '3. Handling Escalated Tickets',
    description: 'Manage escalated ticket inbox, respond with public or internal notes, change status, and escalate to platform.',
    role: 'partner-admin',
    route: '/',
    setup: setupPartnerAdminTickets,
    tour: [
      // 3.1 Ticket Inbox Overview
      { action: 'click', selector: 'a:has-text("Escalated Tickets"), a:has-text("Escalated"), button:has-text("Escalated")' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Escalated Tickets inbox — ticket number, subject, creator, organisation, status, priority' },

      // 3.2 Filtering Tickets
      { action: 'click', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]' },
      { action: 'type', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', text: 'access' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Search and filter — find tickets by subject, filter by status and priority' },
      { action: 'type', selector: 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', text: '' },
      { action: 'wait', ms: 500 },

      // 3.3 Responding to a Ticket
      { action: 'click', selector: 'table tbody tr:first-child a, table tbody tr:first-child td:first-child' },
      { action: 'wait', ms: 2000 },
      { action: 'screenshot', label: 'Ticket conversation — full history, reply box, public reply vs internal note toggle' },
      { action: 'scroll', deltaY: 400, label: 'Reply options — type response, toggle Public reply or Internal note, then Send' },

      // 3.4 Changing Status and Priority
      { action: 'scroll', y: 0 },
      { action: 'screenshot', label: 'Status and Priority — change via dropdowns (Open, In Progress, Resolved, Closed / Low to Urgent)' },

      // 3.5 & 3.6 Escalating and De-escalating
      { action: 'screenshot', label: 'Escalate to Platform — for issues beyond partner capabilities. Return to Partner/Org Admin to de-escalate.' },
    ],
  },
];

/* ================================================================== */
/*  Full manifest (all roles)                                          */
/* ================================================================== */

export const hrManifest: HRDocEntry[] = [
  ...orgAdminEntries,
  ...managerEntries,
  ...employeeEntries,
  ...partnerAdminEntries,
];

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

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
