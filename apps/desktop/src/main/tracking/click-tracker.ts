export interface TrackedClickEvent {
  x: number;
  y: number;
  timestamp: number;
  button: 'left' | 'right' | 'middle';
}

/**
 * Tracks click events via the global mouse hook in the renderer.
 * Clicks are reported from the renderer process via IPC.
 */
export class ClickTracker {
  private events: TrackedClickEvent[] = [];
  private startTime = 0;
  private active = false;

  start(): void {
    this.events = [];
    this.startTime = Date.now();
    this.active = true;
  }

  recordClick(x: number, y: number, button: 'left' | 'right' | 'middle' = 'left'): void {
    if (!this.active) return;
    this.events.push({
      x,
      y,
      timestamp: Date.now() - this.startTime,
      button,
    });
  }

  stop(): TrackedClickEvent[] {
    this.active = false;
    return [...this.events];
  }

  getEvents(): TrackedClickEvent[] {
    return [...this.events];
  }
}
