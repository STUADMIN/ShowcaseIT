/**
 * Suggested guide step title + description when generating from a recording.
 *
 * - **elementText** (when present on a click event) produces “Select … on …” copy.
 * - **Screen / window name** uses the recording title when it looks like a real capture
 *   name (e.g. desktop “Entire screen”, “MyApp – Login”); otherwise “this screen”.
 * - Browser tab recordings usually can’t see button labels on other windows — users
 *   still get helpful placeholder descriptions for marked vs auto-sampled frames.
 */

export type StepFrameMeta =
  | { kind: 'none' }
  | { kind: 'marker' }
  | { kind: 'click'; clickTarget: { x: number; y: number; button?: string; elementText?: string } };

/** Human-readable place name for templates (e.g. "this screen" or "the \"CRM – Home\" capture"). */
export function screenPhraseFromRecordingTitle(recordingTitle: string): string {
  const t = recordingTitle.trim();
  if (!t) return 'this screen';

  const generic =
    /^untitled\b/i.test(t) ||
    /^recording\s+\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(t) ||
    /^video\s+\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(t) ||
    /^guide:\s*(recording|video)\b/i.test(t);

  if (generic) return 'this screen';

  const label = t.length > 52 ? `${t.slice(0, 49)}…` : t;
  return `the “${label}” capture`;
}

function cleanElementLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function suggestedStepTitleAndDescription(args: {
  stepIndex: number;
  meta: StepFrameMeta;
  recordingTitle: string;
}): { title: string; description: string } {
  const stepNum = args.stepIndex + 1;
  const place = screenPhraseFromRecordingTitle(args.recordingTitle);

  if (args.meta.kind === 'click') {
    const { elementText, x, y } = args.meta.clickTarget;
    const label = elementText ? cleanElementLabel(elementText) : '';

    if (label.length > 0) {
      const shortForTitle = label.length <= 40 ? label : `${label.slice(0, 37)}…`;
      return {
        title: `Select “${shortForTitle}”`,
        description: `Select “${label}” on ${place}. Edit this text anytime to match your style.`,
      };
    }

    // Real click coordinates (e.g. desktop) but no accessible label
    if (typeof x === 'number' && typeof y === 'number' && !(x === 0 && y === 0)) {
      return {
        title: `Step ${stepNum}`,
        description: `Click or tap the control at this point in the recording (see the screenshot). On ${place}, add a short title if you know the control name.`,
      };
    }
  }

  if (args.meta.kind === 'marker') {
    return {
      title: `Step ${stepNum}`,
      description: `You marked this moment while recording. Describe what the reader should do — for example “Select Sign in” or “Enter your email” — on ${place}.`,
    };
  }

  return {
    title: `Step ${stepNum}`,
    description: `This frame was taken from the recording timeline. Update the title and description so they match what’s on screen (${place}).`,
  };
}
