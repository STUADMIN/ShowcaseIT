import { screen } from 'electron';

export interface TrackedMouseEvent {
  x: number;
  y: number;
  timestamp: number;
}

export class MouseTracker {
  private events: TrackedMouseEvent[] = [];
  private interval: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;

  start(): void {
    this.events = [];
    this.startTime = Date.now();

    this.interval = setInterval(() => {
      const point = screen.getCursorScreenPoint();
      this.events.push({
        x: point.x,
        y: point.y,
        timestamp: Date.now() - this.startTime,
      });
    }, 16); // ~60fps tracking
  }

  stop(): TrackedMouseEvent[] {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    return [...this.events];
  }

  getEvents(): TrackedMouseEvent[] {
    return [...this.events];
  }
}
