/** Tour action: take a screenshot of the current page state. */
export interface TourScreenshot {
  action: 'screenshot';
  label: string;
  /** Wait for this CSS selector to appear before capturing. */
  waitFor?: string;
}

/** Tour action: click an element. */
export interface TourClick {
  action: 'click';
  selector: string;
  /** Optional label for the step created from the screenshot taken after this click. */
  label?: string;
}

/** Tour action: type text into a focused / selected element. */
export interface TourType {
  action: 'type';
  selector: string;
  text: string;
}

/** Tour action: pause for a fixed duration (e.g. wait for animations). */
export interface TourWait {
  action: 'wait';
  ms: number;
}

/** Tour action: navigate to a different URL (relative to base). */
export interface TourNavigate {
  action: 'navigate';
  path: string;
  /** Wait this long after navigation for the page to settle (default 2000). */
  waitMs?: number;
}

/** Tour action: scroll the page or an element. */
export interface TourScroll {
  action: 'scroll';
  /** CSS selector to scroll within. Omit to scroll the page. */
  selector?: string;
  /** Absolute Y pixel position to scroll to. */
  y?: number;
  /** Scroll by this many pixels (relative). Used when `y` is omitted. Default 600. */
  deltaY?: number;
  /** Optional label — if provided, a screenshot is taken after scrolling. */
  label?: string;
}

export type TourStep =
  | TourScreenshot
  | TourClick
  | TourType
  | TourWait
  | TourNavigate
  | TourScroll;

/**
 * One documentable area in the app.
 * Each entry produces a single ShowcaseIT guide.
 */
export interface DocEntry {
  /** Stable identifier — used to match existing guides on re-runs. */
  id: string;
  /** Human-readable guide title. */
  title: string;
  /** Short description stored in the guide. */
  description: string;
  /**
   * The initial route to visit (relative, e.g. `/recordings`).
   * Additional pages can be reached via `navigate` tour steps.
   */
  route: string;
  /** Ordered tour actions. If empty, a single full-page screenshot is taken. */
  tour: TourStep[];
}

/** Result for one screenshot captured during a tour. */
export interface StepResult {
  label: string;
  /** Public URL after upload to Supabase Storage. */
  screenshotUrl: string;
}

/** Output of the runner for a single manifest entry. */
export interface EntryReport {
  entryId: string;
  title: string;
  description: string;
  /** Recording id returned by /api/recordings/upload. */
  recordingId: string | null;
  /** Screenshot results (fallback if video pipeline unavailable). */
  steps: StepResult[];
}

/** Full runner output written to .report.json. */
export interface RunReport {
  generatedAt: string;
  baseUrl: string;
  entries: EntryReport[];
}
