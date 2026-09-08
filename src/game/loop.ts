/** Callback invoked once per animation frame with the clamped delta in ms. */
export type TickFn = (dtMs: number) => void;

/**
 * Clamp a frame delta to [0, maxMs] so that tab switches or long stalls
 * don't produce a giant single step.
 */
export function clampDelta(dtMs: number, maxMs = 250): number {
  if (dtMs < 0) return 0;
  return dtMs > maxMs ? maxMs : dtMs;
}

/**
 * Number of fixed `stepMs` steps to run for a clamped delta.
 * Always at least 1 so the simulation advances every frame.
 */
export function fixedSteps(dtMs: number, stepMs = 16.67): number {
  const clamped = clampDelta(dtMs);
  return Math.max(1, Math.ceil(clamped / stepMs));
}

/**
 * requestAnimationFrame-based game loop with clamped deltas.
 *
 * The browser globals (rAF / cancelAnimationFrame / performance.now) are only
 * touched inside start()/stop(), so the pure helpers stay unit-testable.
 */
export class GameLoop {
  private cb: TickFn;
  private rafId: number | null = null;
  private lastTime: number | null = null;

  constructor(cb: TickFn) {
    this.cb = cb;
  }

  /** Replace the per-frame callback. */
  setTick(fn: TickFn): void {
    this.cb = fn;
  }

  /** Start the animation frame loop. */
  start(): void {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();
    const frame = (): void => {
      const now = performance.now();
      const prev = this.lastTime ?? now;
      const dt = clampDelta(now - prev);
      this.lastTime = now;
      this.cb(dt);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  /** Cancel the animation frame loop. */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTime = null;
  }
}