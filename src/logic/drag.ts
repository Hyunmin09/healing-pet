/**
 * Pure pointer classification for the pet window.
 *
 * `classifyPointer` decides whether a pointer gesture is a click or a drag
 * using a single distance criterion: Euclidean distance < 6px = "click",
 * >= 6px = "drag". Time is deliberately ignored so a long press is never
 * misclassified as a drag. It is a pure function with no internal state.
 */

/** Result of pointer classification. */
export type PointerKind = "click" | "drag";

/** A pointer position in window-logical coordinates. */
export interface PointerPoint {
  x: number;
  y: number;
}

/** Drag threshold in logical pixels (inclusive — exactly 6px is a drag). */
const DRAG_THRESHOLD_PX = 6;

/**
 * Classify a pointer gesture by the Euclidean distance between its start and
 * current positions. Distances below 6px are clicks; 6px and above are drags.
 */
export function classifyPointer(
  start: PointerPoint,
  cur: PointerPoint,
): PointerKind {
  const dx = cur.x - start.x;
  const dy = cur.y - start.y;
  const dist = Math.hypot(dx, dy);
  return dist < DRAG_THRESHOLD_PX ? "click" : "drag";
}