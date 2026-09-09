/**
 * Pure pointer classification for the pet window.
 *
 * `classifyPointer` decides whether a pointer gesture is a click or a drag
 * using a single distance criterion: Euclidean distance < 6px = "click",
 * >= 6px = "drag". Time is deliberately ignored so a long press is never
 * misclassified as a drag. It is a pure function with no internal state.
 *
 * The FSM moves the pet window itself (Chasing/Roaming via `setPosition`), so
 * client-relative coordinates shift by the window's own movement while the
 * pointer is held. `classifyScreenPointer` therefore classifies using
 * screen-relative coordinates (`screenX`/`screenY`), which are OS-level and
 * unaffected by window movement — a click stays a click even when the window
 * moves under the cursor.
 */

/** Result of pointer classification. */
export type PointerKind = "click" | "drag";

/** A pointer position in window-logical coordinates. */
export interface PointerPoint {
  x: number;
  y: number;
}

/** A pointer position in screen coordinates (OS-level, unaffected by window movement). */
export interface ScreenPointerPoint {
  screenX: number;
  screenY: number;
}

/** Drag threshold in logical pixels (inclusive — exactly 6px is a drag). */
const DRAG_THRESHOLD_PX = 6;

/** Shared distance criterion: below the threshold is a click, at/above is a drag. */
function classifyByDistance(dx: number, dy: number): PointerKind {
  return Math.hypot(dx, dy) < DRAG_THRESHOLD_PX ? "click" : "drag";
}

/**
 * Classify a pointer gesture by the Euclidean distance between its start and
 * current positions in window-logical coordinates. Distances below 6px are
 * clicks; 6px and above are drags.
 */
export function classifyPointer(
  start: PointerPoint,
  cur: PointerPoint,
): PointerKind {
  return classifyByDistance(cur.x - start.x, cur.y - start.y);
}

/**
 * Classify a pointer gesture by the Euclidean distance between its start and
 * current positions in screen coordinates. Screen coordinates are OS-level,
 * so they are immune to the window moving under the cursor while the pointer
 * is held — the pet window's own motion never turns a click into a drag.
 */
export function classifyScreenPointer(
  start: ScreenPointerPoint,
  cur: ScreenPointerPoint,
): PointerKind {
  return classifyByDistance(
    cur.screenX - start.screenX,
    cur.screenY - start.screenY,
  );
}