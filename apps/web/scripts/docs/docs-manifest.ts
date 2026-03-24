import type { DocEntry } from './types';

/**
 * Every documentable area of ShowcaseIT.
 * Each entry produces one guide. The `route` is the starting URL;
 * additional pages are reached via `navigate` tour steps.
 *
 * Keep `id` stable — it is the key used to match existing guides on re-runs.
 *
 * Tours simulate real user workflows: clicking buttons, opening editors,
 * filling forms, navigating sub-pages, and interacting with modals —
 * NOT just static page screenshots.
 */
export const docsManifest: DocEntry[] = [
  /* ------------------------------------------------------------------ */
  /*  Dashboard                                                          */
  /* ------------------------------------------------------------------ */
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Overview of your workspace activity, quick actions, and recent guides.',
    route: '/',
    tour: [
      { action: 'screenshot', label: 'Dashboard overview — welcome banner and workspace stats', waitFor: 'h2' },
      { action: 'scroll', deltaY: 400, label: 'Quick Actions — shortcuts to record, create guides, brand kit, and export' },
      { action: 'scroll', deltaY: 400, label: 'Recent Guides — your latest documentation at a glance' },
      // Click into a quick action to show flow
      { action: 'scroll', y: 0 },
      { action: 'click', selector: 'a[href="/recordings/new"]', label: 'Quick Action → New Recording opens the screen recorder' },
      { action: 'wait', ms: 2000 },
      { action: 'navigate', path: '/', waitMs: 3000 },
      { action: 'click', selector: 'a[href="/guides"]', label: 'Quick Action → Guides navigates to the guides library' },
      { action: 'wait', ms: 2000 },
      { action: 'navigate', path: '/', waitMs: 3000 },
      { action: 'click', selector: 'a[href="/brand"]', label: 'Quick Action → Brand Kit opens brand configuration' },
      { action: 'wait', ms: 2000 },
      { action: 'navigate', path: '/', waitMs: 3000 },
      { action: 'click', selector: 'a[href="/export"]', label: 'Quick Action → Export opens the export page' },
      { action: 'wait', ms: 2000 },
      // Navigate back and show recent guides section
      { action: 'navigate', path: '/', waitMs: 3000 },
      { action: 'scroll', deltaY: 600, label: 'Click any recent guide card to jump straight into the editor' },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  Recordings                                                         */
  /* ------------------------------------------------------------------ */
  {
    id: 'recordings',
    title: 'Recordings',
    description: 'Manage screen captures and recordings — list, search, preview videos, and start new captures.',
    route: '/recordings',
    tour: [
      { action: 'screenshot', label: 'Recordings list — all your screen captures in one place', waitFor: 'h2' },
      { action: 'scroll', deltaY: 400, label: 'Each row shows status, brand, recording date, and action buttons' },
      // Search
      { action: 'scroll', y: 0 },
      { action: 'click', selector: '#recordings-search' },
      { action: 'type', selector: '#recordings-search', text: 'Auto' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Search recordings — type to filter by title in real time' },
      // Clear search
      { action: 'click', selector: 'button[aria-label="Clear search"]' },
      { action: 'wait', ms: 500 },
      // Preview a video inline
      { action: 'click', selector: 'button[title="Preview video"]' },
      { action: 'wait', ms: 1500 },
      { action: 'screenshot', label: 'Video preview modal — watch the recording without leaving the page' },
      // Close preview (press Escape)
      { action: 'click', selector: 'body' },
      { action: 'wait', ms: 500 },
      // Generate Guide button
      { action: 'scroll', y: 0 },
      { action: 'screenshot', label: 'Generate Guide button — click to create a step-by-step guide from any recording' },
      // Navigate to the screen recording page
      { action: 'navigate', path: '/recordings/new', waitMs: 3500 },
      { action: 'screenshot', label: 'New Screen Recording — capture your screen with automatic click tracking', waitFor: 'h1,h2' },
      // Video recording page
      { action: 'navigate', path: '/recordings/video', waitMs: 3500 },
      { action: 'screenshot', label: 'Video + Voiceover — record your screen with microphone narration', waitFor: 'h1,h2' },
      // Mobile cast page
      { action: 'navigate', path: '/recordings/cast', waitMs: 3500 },
      { action: 'screenshot', label: 'Mobile Cast — scan the QR code to mirror your phone screen', waitFor: 'h1,h2' },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  Guides                                                             */
  /* ------------------------------------------------------------------ */
  {
    id: 'guides',
    title: 'Guides',
    description: 'Browse, create, and manage step-by-step guides generated from your recordings.',
    route: '/guides',
    tour: [
      { action: 'screenshot', label: 'Guides library — browse all your step-by-step documentation', waitFor: 'h2' },
      { action: 'scroll', deltaY: 400, label: 'Guide cards show thumbnail, title, step count, docs badge, and last updated date' },
      // Search
      { action: 'scroll', y: 0 },
      { action: 'click', selector: '#guides-search' },
      { action: 'type', selector: '#guides-search', text: 'Brand' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Search guides — filter the library by typing a keyword' },
      // Clear search and open a guide editor
      { action: 'click', selector: '#guides-search' },
      { action: 'type', selector: '#guides-search', text: '' },
      { action: 'wait', ms: 500 },
      // Open guide editor by clicking a non-doc guide link
      { action: 'click', selector: 'a[href^="/guides/"]', label: 'Click a guide card to open the full editor' },
      { action: 'wait', ms: 3000 },
      { action: 'screenshot', label: 'Guide Editor — left panel lists steps, centre shows the screenshot, right panel has properties' },
      // Click on a step
      { action: 'scroll', deltaY: 300, selector: 'aside' },
      { action: 'screenshot', label: 'Step list — click any step to select it and view its screenshot and properties' },
      // Show the properties panel on the right
      { action: 'scroll', y: 0, selector: 'aside' },
      { action: 'screenshot', label: 'Properties panel — edit the step title, description, and export options' },
      // Show toolbar
      { action: 'screenshot', label: 'Toolbar — Select, Move, Arrow, Callout, Box, Circle, Badge, Highlight, Blur, Text, Crop tools' },
      // Navigate back to guides list
      { action: 'navigate', path: '/guides', waitMs: 3000 },
      { action: 'screenshot', label: 'Back to Guides — the library remembers your search and position' },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  Brand Kit                                                          */
  /* ------------------------------------------------------------------ */
  {
    id: 'brand-kit',
    title: 'Brand Kit',
    description: 'Configure brand identity — colours, fonts, logos, and social assets per kit.',
    route: '/brand',
    tour: [
      { action: 'screenshot', label: 'Brand Kit page — select a kit and configure your brand identity', waitFor: 'h2' },
      // Show kit picker
      { action: 'click', selector: '#si-brand-kit-picker', label: 'Kit picker — switch between multiple brand kits or create a new one' },
      { action: 'wait', ms: 800 },
      // Close picker by clicking elsewhere
      { action: 'click', selector: 'h2' },
      { action: 'wait', ms: 300 },
      // Scroll to colours
      { action: 'scroll', deltaY: 350, label: 'Brand Colours — set Primary, Secondary, Accent, and Background colours' },
      { action: 'scroll', deltaY: 350, label: 'Typography — choose Heading and Body fonts that match your brand' },
      { action: 'scroll', deltaY: 400, label: 'Preview — live preview of how your colours and fonts look together' },
      { action: 'scroll', deltaY: 400, label: 'Logo — upload your brand logo (displayed on guides and exports)' },
      { action: 'scroll', deltaY: 400, label: 'Guide Cover — upload a custom cover image for your exported guides' },
      { action: 'scroll', deltaY: 400, label: 'Export Banners — document and social share banner images' },
      { action: 'scroll', deltaY: 400, label: 'Social Media Assets — platform-specific logos for YouTube, LinkedIn, X, Facebook, Instagram' },
      { action: 'scroll', deltaY: 400, label: 'Social Link Preview — custom banners shown when your guides are shared on social media' },
      // Back to top to show Save
      { action: 'scroll', y: 0 },
      { action: 'screenshot', label: 'Save Brand Kit — click to persist all changes to colours, fonts, logos, and assets' },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  Export                                                              */
  /* ------------------------------------------------------------------ */
  {
    id: 'export',
    title: 'Export',
    description: 'Export guides as HTML, PDF, or Word documents with your brand styling applied.',
    route: '/export',
    tour: [
      { action: 'screenshot', label: 'Export page — choose a guide and an output format', waitFor: 'h2' },
      // Click the guide select dropdown
      { action: 'click', selector: 'select', label: 'Step 1: Select a guide — pick from your guides library' },
      { action: 'wait', ms: 500 },
      { action: 'screenshot', label: 'Guide dropdown — shows all available guides to export' },
      // Click body to close
      { action: 'click', selector: 'h2' },
      { action: 'wait', ms: 300 },
      // Scroll to format cards
      { action: 'scroll', deltaY: 300, label: 'Step 2: Choose a format — HTML Standalone, Embeddable HTML, PDF, or Word' },
      { action: 'scroll', deltaY: 400, label: 'Export formats — each card explains the format and its best use case' },
      // Back to top
      { action: 'scroll', y: 0 },
      { action: 'screenshot', label: 'Ready to export — select guide and format, then click Download or Preview' },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  Publish                                                            */
  /* ------------------------------------------------------------------ */
  {
    id: 'publish',
    title: 'Publish',
    description: 'Publish guides to Confluence and social platforms — connect accounts and push content in one click.',
    route: '/publish',
    tour: [
      { action: 'screenshot', label: 'Publish page — connect documentation platforms and social accounts', waitFor: 'h2' },
      // Documentation platforms section
      { action: 'scroll', deltaY: 350, label: 'Documentation Platforms — connect Confluence to push guides directly to your wiki' },
      // Social media section
      { action: 'scroll', deltaY: 400, label: 'Social Media — connect YouTube, LinkedIn, X, Facebook, and Instagram' },
      // Show publish form section
      { action: 'scroll', deltaY: 400, label: 'Publish form — select a guide, set page title, choose platforms, and publish' },
      // Back to top
      { action: 'scroll', y: 0 },
      { action: 'screenshot', label: 'One-click publishing — connect your platforms once, then publish any guide instantly' },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  Team                                                               */
  /* ------------------------------------------------------------------ */
  {
    id: 'team',
    title: 'Team',
    description: 'Manage workspace members — invite teammates, change roles, and review membership.',
    route: '/team',
    tour: [
      { action: 'screenshot', label: 'Team page — workspace summary, plan, and member management', waitFor: 'h2' },
      { action: 'scroll', deltaY: 350, label: 'Members list — name, email, role, and join date for each team member' },
      // Click invite button to show the modal
      { action: 'scroll', y: 0 },
      { action: 'click', selector: 'button', label: 'Invite Member — opens a modal to add a new teammate by email' },
      { action: 'wait', ms: 1000 },
      { action: 'screenshot', label: 'Invite modal — enter email address and choose Admin or Member role' },
      // Close modal (press Escape via keyboard)
      { action: 'click', selector: 'button:has-text("Cancel")' },
      { action: 'wait', ms: 500 },
      // Scroll to show roles
      { action: 'scroll', deltaY: 500, label: 'Roles explained — Admins can manage members and settings, Members can create content' },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  Settings                                                           */
  /* ------------------------------------------------------------------ */
  {
    id: 'settings',
    title: 'Settings',
    description: 'Profile, workspace configuration, background theme, notifications, and security settings.',
    route: '/settings',
    tour: [
      { action: 'screenshot', label: 'Settings — profile section with avatar, display name, and email', waitFor: 'h2' },
      { action: 'scroll', deltaY: 400, label: 'Profile — change your avatar, display name, and email address' },
      { action: 'scroll', deltaY: 500, label: 'Security — enable two-factor authentication with an authenticator app' },
      { action: 'scroll', deltaY: 500, label: 'Workspace — rename your workspace and view your current plan' },
      { action: 'scroll', deltaY: 500, label: 'Background Theme — customise the liquid-glass effect with colour presets and blur' },
      { action: 'scroll', deltaY: 400, label: 'Theme controls — toggle effects, adjust opacity, pick a colour preset' },
      { action: 'scroll', deltaY: 500, label: 'Notifications — toggle email alerts for guide published, team invites, and weekly digest' },
      { action: 'scroll', deltaY: 400, label: 'Danger Zone — delete your account (requires typing confirmation)' },
      // Back to top
      { action: 'scroll', y: 0 },
      { action: 'screenshot', label: 'Save Profile — click to persist all profile and workspace changes' },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  Help Centre                                                        */
  /* ------------------------------------------------------------------ */
  {
    id: 'help',
    title: 'Help Centre',
    description: 'Browse all auto-generated documentation guides for the platform.',
    route: '/help',
    tour: [
      { action: 'screenshot', label: 'Help Centre — browse documentation by category or search', waitFor: 'h1' },
      { action: 'scroll', deltaY: 400, label: 'Documentation grid — cards for every area of ShowcaseIT' },
      // Search
      { action: 'scroll', y: 0 },
      { action: 'click', selector: 'input[placeholder="Search docs..."]' },
      { action: 'type', selector: 'input[placeholder="Search docs..."]', text: 'record' },
      { action: 'wait', ms: 800 },
      { action: 'screenshot', label: 'Search documentation — type to filter articles by keyword' },
      // Clear search
      { action: 'type', selector: 'input[placeholder="Search docs..."]', text: '' },
      { action: 'wait', ms: 500 },
      // Open an article
      { action: 'click', selector: 'a[href^="/help/"]', label: 'Open an article — full step-by-step guide with screenshots' },
      { action: 'wait', ms: 2500 },
      { action: 'screenshot', label: 'Article view — step sidebar, screenshot content, and navigation controls' },
      // Navigate between steps
      { action: 'click', selector: 'button:has-text("Next")', label: 'Next step — click to advance through the guide' },
      { action: 'wait', ms: 800 },
      { action: 'screenshot', label: 'Step navigation — move between steps using Previous and Next buttons' },
      // Back to help centre
      { action: 'navigate', path: '/help', waitMs: 3000 },
      { action: 'screenshot', label: 'Back to Help Centre — browse more documentation or search for answers' },
    ],
  },
];

/** Lookup by entry id. */
export function findEntry(id: string): DocEntry | undefined {
  return docsManifest.find((e) => e.id === id);
}

/** All route paths referenced by the manifest (starting routes + navigate steps). */
export function allManifestRoutes(): string[] {
  const routes = new Set<string>();
  for (const entry of docsManifest) {
    routes.add(entry.route);
    for (const step of entry.tour) {
      if (step.action === 'navigate') routes.add(step.path);
    }
  }
  return [...routes].sort();
}
