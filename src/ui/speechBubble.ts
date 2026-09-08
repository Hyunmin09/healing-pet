/**
 * Korean speech bubble shown above the pet.
 *
 * `bubblePosition` is a pure coordinate-clamp helper (unit-tested in
 * speechBubble.test.ts); `showSpeechBubble` owns the DOM: it reuses a single
 * bubble element inside the `#bubble` shell, swaps the text, and fades the
 * bubble out after a duration. Plain DOM only — no tooltip libraries.
 */

export interface BubbleOptions {
  x: number;
  y: number;
  durationMs?: number;
}

export interface BubblePosition {
  x: number;
  y: number;
}

/** Logical window size of the transparent pet window. */
const WINDOW_WIDTH = 240;
const WINDOW_HEIGHT = 260;
/** Minimum distance from the window edge. */
const EDGE_MARGIN = 4;
/** Default display duration (within the 2500–4000ms range). */
const DEFAULT_DURATION_MS = 3000;
/** Fade-out transition duration — must match the CSS `transition`. */
const FADE_MS = 300;

const BUBBLE_SHELL_ID = "bubble";

/** The single reusable bubble element, or null when none is mounted. */
let activeBubble: HTMLElement | null = null;
/** Pending timer id: either the display timer or the removal timer. */
let pendingTimer: number | null = null;

/**
 * Clamp the bubble's top-left corner so the whole bubble stays inside the
 * window, keeping `EDGE_MARGIN` px of breathing room on every side.
 */
export function bubblePosition(
  width: number,
  height: number,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
): BubblePosition {
  return {
    x: Math.max(EDGE_MARGIN, Math.min(maxW - width - EDGE_MARGIN, x)),
    y: Math.max(EDGE_MARGIN, Math.min(maxH - height - EDGE_MARGIN, y)),
  };
}

/**
 * Show a speech bubble at (x, y). A previous bubble is replaced immediately
 * (content swap + timer reset). The bubble fades out over `FADE_MS` after
 * `durationMs` and is then removed from the DOM.
 */
export function showSpeechBubble(text: string, opts: BubbleOptions): void {
  const durationMs = opts.durationMs ?? DEFAULT_DURATION_MS;
  const shell = document.getElementById(BUBBLE_SHELL_ID);
  if (!shell) {
    return;
  }

  // A pending timer belongs to the previous bubble — cancel it so the old
  // bubble is never faded or removed while we are replacing it.
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer);
    pendingTimer = null;
  }

  let bubble = activeBubble;
  if (bubble === null) {
    bubble = document.createElement("div");
    bubble.className = "speech-bubble";
    shell.appendChild(bubble);
    activeBubble = bubble;
  } else {
    // Reuse: undo any in-progress fade-out and swap the content.
    bubble.classList.remove("fade-out");
  }

  bubble.textContent = text;

  // Measure after the text is set so clamping uses the real rendered size.
  const rect = bubble.getBoundingClientRect();
  const pos = bubblePosition(
    rect.width,
    rect.height,
    opts.x,
    opts.y,
    WINDOW_WIDTH,
    WINDOW_HEIGHT,
  );
  bubble.style.left = `${pos.x}px`;
  bubble.style.top = `${pos.y}px`;

  pendingTimer = window.setTimeout(() => {
    bubble?.classList.add("fade-out");
    pendingTimer = window.setTimeout(() => {
      bubble?.remove();
      if (activeBubble === bubble) {
        activeBubble = null;
      }
      pendingTimer = null;
    }, FADE_MS);
  }, durationMs);
}