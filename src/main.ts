/**
 * Healing pet app entry point.
 *
 * Boots the canvas, restores persisted needs, subscribes to cursor/tray
 * events, wires the context menu, and runs a GameLoop that ticks needs,
 * consumes queued inputs through the FSM, moves the window, renders the pet,
 * and periodically persists state.
 */

import { LogicalPosition } from "@tauri-apps/api/dpi";
import {
  getWindow,
  listMonitors,
  loadState,
  saveState,
  toggleClickThrough,
  setAlwaysOnTop,
  onCursorPosition,
  onTrayAction,
  type CursorPosPayload,
  type MonitorInfo,
  type TrayAction,
} from "./game/bindings";
import { GameLoop } from "./game/loop";
import { nextState, type FsmCtx, type Input, type State } from "./logic/fsm";
import { tickNeeds, type NeedState } from "./logic/needs";
import {
  applyOfflineDecay,
  defaultPetState,
  DEFAULT_SETTINGS,
  STATE_VERSION,
  type PetSettings,
  type PetState,
} from "./logic/state";
import { pickMessage } from "./logic/messages";
import { poseFor } from "./render/pose";
import { drawPet } from "./render/petRenderer";
import { initContextMenu, type MenuAction } from "./ui/contextMenu";
import { showSpeechBubble } from "./ui/speechBubble";
import { classifyPointer, type PointerPoint } from "./logic/drag";

/** Logical canvas size (matches the CSS size and the renderer). */
const PET_WIDTH = 240;
const PET_HEIGHT = 260;
/** Character body center in canvas logical coordinates. */
const BODY_X = 120;
const BODY_Y = 150;
/** Clicks within this distance of the character center count as interaction. */
const CLICK_RADIUS_PX = 48;
/** Cursor within this distance starts the nearby hold timer. */
const CURSOR_NEARBY_DIST_PX = 120;
/** Cursor must stay nearby for this long before the pet reacts. */
const CURSOR_NEARBY_HOLD_MS = 500;
/** Cursor beyond this distance resets the nearby state. */
const CURSOR_FAR_DIST_PX = 200;
/** Chasing movement speed (px/s). */
const CHASE_SPEED_PX_S = 100;
/** Roaming movement speed (px/s). */
const ROAM_SPEED_PX_S = 60;
/** Minimum interval between setPosition calls (≈30fps). */
const SET_POSITION_THROTTLE_MS = 33;
/** Periodic save interval. */
const SAVE_INTERVAL_MS = 30000;
/** Roaming margins inside the monitor (px). */
const ROAM_MARGIN_SIDE_PX = 12;
const ROAM_MARGIN_TOP_PX = 12;
const ROAM_MARGIN_BOTTOM_PX = 48;
/** Distance at which a roaming waypoint counts as reached. */
const WAYPOINT_ARRIVE_PX = 8;
/** Satiety below this counts as "low" (hunger). */
const SATIETY_LOW = 20;
/** Feed gains. */
const FEED_SATIETY_GAIN = 25;
const FEED_MOOD_GAIN = 3;
/** Click gains. */
const CLICK_INTIMACY_GAIN = 1;
const CLICK_MOOD_GAIN = 5;
/** Sleepiness rise is halved for this long after an interaction. */
const SLEEPINESS_GRACE_MS = 30000;
/** Speech bubble anchor above the character. */
const BUBBLE_X = 120;
const BUBBLE_Y = 70;

/** Clamp a value into the inclusive [0, 100] range. */
function clamp100(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// --- Mutable app state -----------------------------------------------------

let ctx: CanvasRenderingContext2D | null = null;
let needs: NeedState = { satiety: 80, mood: 70, intimacy: 0, sleepiness: 20 };
let settings: PetSettings = { ...DEFAULT_SETTINGS };
let state: State = "Idle";
let stateEntryAt = 0;
let lastInteractionAt = 0;
let lastMessageAt = 0;
let cursorNearby = false;
let cursorNearbySince: number | null = null;
let cursorPos: CursorPosPayload | null = null;
let windowPos: { x: number; y: number } | null = null;
let monitors: MonitorInfo[] = [];
let waypoint: { x: number; y: number } | null = null;
let roamArrived = false;
let stopwatchT = 0;
let lastSetPositionAt = 0;
let saveInFlight = false;
let pendingSave = false;
let quitting = false;
let storeTimer: number | null = null;
let pointerDown = false;
let pointerStart: PointerPoint | null = null;
const inputQueue: Input[] = [];

// --- Input queue -----------------------------------------------------------

/** Queue an input to be consumed by the FSM on the next frame. */
function queueInput(input: Input): void {
  if (input !== null) {
    inputQueue.push(input);
  }
}

/**
 * Take the highest-priority queued input (sleep > feed > pet/click), removing
 * it from the queue. Returns null when the queue is empty.
 */
function takeNextInput(): Input {
  for (const wanted of ["sleep", "feed", "pet", "click"] as const) {
    const idx = inputQueue.indexOf(wanted);
    if (idx >= 0) {
      inputQueue.splice(idx, 1);
      return wanted;
    }
  }
  return null;
}

// --- Interactions ----------------------------------------------------------

/** Feed: satiety +25, mood +3, then the FSM enters Eating. */
function applyFeed(): void {
  needs = {
    ...needs,
    satiety: clamp100(needs.satiety + FEED_SATIETY_GAIN),
    mood: clamp100(needs.mood + FEED_MOOD_GAIN),
  };
  lastInteractionAt = Date.now();
  queueInput("feed");
  console.log("[healing-pet] feed");
}

/** Pet: the FSM enters BeingPetted. */
function applyPet(): void {
  lastInteractionAt = Date.now();
  queueInput("pet");
  console.log("[healing-pet] pet");
}

/** Sleep: the FSM enters Sleeping. */
function applySleep(): void {
  lastInteractionAt = Date.now();
  queueInput("sleep");
  console.log("[healing-pet] sleep");
}

/** Click on the character: intimacy +1, mood +5, then BeingPetted. */
function applyClick(): void {
  needs = {
    ...needs,
    intimacy: clamp100(needs.intimacy + CLICK_INTIMACY_GAIN),
    mood: clamp100(needs.mood + CLICK_MOOD_GAIN),
  };
  lastInteractionAt = Date.now();
  queueInput("click");
  console.log("[healing-pet] click interaction");
}

// --- Pointer handling ------------------------------------------------------

function onPointerDown(e: MouseEvent): void {
  if (e.button !== 0) return;
  pointerDown = true;
  pointerStart = { x: e.clientX, y: e.clientY };
}

function onPointerMove(e: MouseEvent): void {
  if (!pointerDown || pointerStart === null) return;
  const cur: PointerPoint = { x: e.clientX, y: e.clientY };
  if (classifyPointer(pointerStart, cur) === "drag") {
    pointerDown = false;
    pointerStart = null;
    void getWindow()
      .startDragging()
      .catch((err) => console.warn("[healing-pet] startDragging failed", err));
  }
}

function onPointerUp(e: MouseEvent): void {
  if (!pointerDown || pointerStart === null) return;
  const cur: PointerPoint = { x: e.clientX, y: e.clientY };
  const kind = classifyPointer(pointerStart, cur);
  pointerDown = false;
  pointerStart = null;
  if (kind !== "click") return;

  // Only clicks near the character center count as an interaction.
  const dx = cur.x - BODY_X;
  const dy = cur.y - BODY_Y;
  if (Math.hypot(dx, dy) > CLICK_RADIUS_PX) return;
  applyClick();
}

function onPointerLeave(): void {
  pointerDown = false;
  pointerStart = null;
}

// --- Menu / tray -----------------------------------------------------------

function handleMenuAction(action: MenuAction): void {
  switch (action) {
    case "feed":
      applyFeed();
      break;
    case "pet":
      applyPet();
      break;
    case "sleep":
      applySleep();
      break;
    case "toggle-click-through":
    case "close":
      break;
  }
}

function handleTrayAction(action: TrayAction): void {
  switch (action) {
    case "toggle-visibility":
      void toggleVisibility();
      break;
    case "toggle-click-through":
      void toggleClickThroughHandler();
      break;
    case "feed":
      applyFeed();
      break;
    case "pet":
      applyPet();
      break;
    case "sleep":
      applySleep();
      break;
    case "quit":
      void quitApp();
      break;
  }
}

async function toggleClickThroughHandler(): Promise<void> {
  try {
    settings = { ...settings, clickThrough: await toggleClickThrough() };
    console.log("[healing-pet] click-through →", settings.clickThrough);
  } catch (err) {
    console.warn("[healing-pet] toggle click-through failed", err);
  }
}

async function toggleVisibility(): Promise<void> {
  try {
    const visible = await getWindow().isVisible();
    if (visible) {
      await getWindow().hide();
    } else {
      await getWindow().show();
    }
  } catch (err) {
    console.warn("[healing-pet] toggle visibility failed", err);
  }
}

// --- Cursor tracking -------------------------------------------------------

function handleCursor(pos: CursorPosPayload): void {
  cursorPos = pos;
  if (windowPos === null) return;

  const charX = windowPos.x + BODY_X;
  const charY = windowPos.y + BODY_Y;
  const dist = Math.hypot(pos.x - charX, pos.y - charY);
  const now = Date.now();

  if (dist <= CURSOR_NEARBY_DIST_PX) {
    if (cursorNearbySince === null) {
      cursorNearbySince = now;
    } else if (now - cursorNearbySince >= CURSOR_NEARBY_HOLD_MS) {
      cursorNearby = true;
    }
  } else if (dist > CURSOR_FAR_DIST_PX) {
    cursorNearby = false;
    cursorNearbySince = null;
  }
}

// --- Movement --------------------------------------------------------------

/** Find the monitor whose rect contains the given logical point. */
function monitorAt(x: number, y: number): MonitorInfo | undefined {
  return monitors.find(
    (m) => x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height,
  );
}

/** Clamp a window top-left position so the whole window stays on the monitor. */
function clampWindowToMonitor(
  pos: { x: number; y: number },
  mon: MonitorInfo,
): { x: number; y: number } {
  const minX = mon.x + ROAM_MARGIN_SIDE_PX;
  const maxX = mon.x + mon.width - PET_WIDTH - ROAM_MARGIN_SIDE_PX;
  const minY = mon.y + ROAM_MARGIN_TOP_PX;
  const maxY = mon.y + mon.height - PET_HEIGHT - ROAM_MARGIN_BOTTOM_PX;
  return {
    x: Math.max(minX, Math.min(maxX, pos.x)),
    y: Math.max(minY, Math.min(maxY, pos.y)),
  };
}

/** Pick a random roaming waypoint inside the window's current monitor. */
function pickRoamWaypoint(): { x: number; y: number } | null {
  if (windowPos === null || monitors.length === 0) return null;
  const mon =
    monitorAt(windowPos.x + PET_WIDTH / 2, windowPos.y + PET_HEIGHT / 2) ??
    monitors[0];
  const minX = mon.x + ROAM_MARGIN_SIDE_PX;
  const maxX = mon.x + mon.width - PET_WIDTH - ROAM_MARGIN_SIDE_PX;
  const minY = mon.y + ROAM_MARGIN_TOP_PX;
  const maxY = mon.y + mon.height - PET_HEIGHT - ROAM_MARGIN_BOTTOM_PX;
  return {
    x: minX + Math.random() * Math.max(0, maxX - minX),
    y: minY + Math.random() * Math.max(0, maxY - minY),
  };
}

/** Move the window toward a target at a fixed speed, throttled to ~30fps. */
function moveToward(
  target: { x: number; y: number },
  speedPxS: number,
  dtSec: number,
  now: number,
): void {
  if (windowPos === null) return;
  const dx = target.x - windowPos.x;
  const dy = target.y - windowPos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return;

  const step = Math.min(dist, speedPxS * dtSec);
  windowPos = {
    x: windowPos.x + (dx / dist) * step,
    y: windowPos.y + (dy / dist) * step,
  };

  if (now - lastSetPositionAt >= SET_POSITION_THROTTLE_MS) {
    lastSetPositionAt = now;
    void getWindow()
      .setPosition(
        new LogicalPosition(Math.round(windowPos.x), Math.round(windowPos.y)),
      )
      .catch((err) => console.warn("[healing-pet] setPosition failed", err));
  }
}

/** Advance window movement for the current state; sets roamArrived on arrival. */
function updateMovement(dtSec: number, now: number): void {
  if (windowPos === null) return;

  if (state === "Chasing" && cursorPos !== null) {
    const mon =
      monitorAt(cursorPos.x, cursorPos.y) ??
      monitorAt(windowPos.x + PET_WIDTH / 2, windowPos.y + PET_HEIGHT / 2) ??
      monitors[0];
    if (mon !== undefined) {
      const target = clampWindowToMonitor(
        { x: cursorPos.x - BODY_X, y: cursorPos.y - BODY_Y },
        mon,
      );
      moveToward(target, CHASE_SPEED_PX_S, dtSec, now);
    }
    return;
  }

  if (state === "Roaming") {
    if (waypoint === null) {
      waypoint = pickRoamWaypoint();
      if (waypoint !== null) {
        console.log("[healing-pet] roaming to", waypoint);
      }
    }
    if (waypoint !== null) {
      moveToward(waypoint, ROAM_SPEED_PX_S, dtSec, now);
      if (Math.hypot(waypoint.x - windowPos.x, waypoint.y - windowPos.y) < WAYPOINT_ARRIVE_PX) {
        waypoint = null;
        roamArrived = true;
      }
    }
  }
}

// --- Speech ----------------------------------------------------------------

/** Show a state-based message if the minimum interval has elapsed. */
function maybeSpeak(now: number): void {
  if (now - lastMessageAt < settings.messageFreqMs) return;
  const msg = pickMessage(state, { satiety: needs.satiety, mood: needs.mood });
  if (msg === null) return;
  lastMessageAt = now;
  showSpeechBubble(msg, { x: BUBBLE_X, y: BUBBLE_Y });
}

// --- Persistence -----------------------------------------------------------

/** Build the persisted snapshot with a fresh lastSeenAt timestamp. */
function snapshot(): PetState {
  return {
    satiety: needs.satiety,
    mood: needs.mood,
    intimacy: needs.intimacy,
    sleepiness: needs.sleepiness,
    lastSeenAt: new Date().toISOString(),
    settings: { ...settings },
    version: STATE_VERSION,
  };
}

/** Persist state, queueing a follow-up save if one is already in flight. */
async function persist(): Promise<void> {
  if (saveInFlight) {
    pendingSave = true;
    return;
  }
  saveInFlight = true;
  try {
    await saveState(snapshot());
    console.log("[healing-pet] saved");
  } catch (err) {
    console.warn("[healing-pet] save failed", err);
  } finally {
    saveInFlight = false;
    if (pendingSave) {
      pendingSave = false;
      void persist();
    }
  }
}

/** Final save followed by window destruction (close button or tray quit). */
async function quitApp(): Promise<void> {
  if (quitting) return;
  quitting = true;
  if (storeTimer !== null) {
    window.clearInterval(storeTimer);
    storeTimer = null;
  }
  try {
    await saveState(snapshot());
    console.log("[healing-pet] final save");
  } catch (err) {
    console.warn("[healing-pet] final save failed", err);
  }
  await getWindow().destroy();
}

// --- Frame loop ------------------------------------------------------------

function tick(dtMs: number): void {
  if (ctx === null) return;
  const dtSec = dtMs / 1000;
  const now = Date.now();
  stopwatchT += dtSec;

  // 1. Needs decay (sleepiness rise is halved right after an interaction).
  const recentlyInteracted = now - lastInteractionAt < SLEEPINESS_GRACE_MS;
  let next = tickNeeds(needs, dtSec, now, {
    state,
    satietyLow: needs.satiety < SATIETY_LOW,
  });
  if (recentlyInteracted && state !== "Sleeping") {
    const rise = next.sleepiness - needs.sleepiness;
    next = { ...next, sleepiness: clamp100(needs.sleepiness + rise * 0.5) };
  }
  needs = next;

  // 2. Consume one queued input.
  const input = takeNextInput();

  // 3. FSM transition.
  const fsmCtx: FsmCtx = {
    satiety: needs.satiety,
    mood: needs.mood,
    sleepiness: needs.sleepiness,
    lastInteractionAt,
    cursorNearby,
    input,
    now,
  };
  let nextStateName = nextState(state, fsmCtx);

  // 4. Window movement (may flag a roaming arrival).
  updateMovement(dtSec, now);

  // 5. Roaming arrival → Idle is managed here (the FSM never does it).
  if (state === "Roaming" && nextStateName === "Roaming" && roamArrived) {
    nextStateName = "Idle";
    lastInteractionAt = now;
  }
  roamArrived = false;

  // 6. Apply the transition, resetting the state clock.
  if (nextStateName !== state) {
    state = nextStateName;
    stateEntryAt = now;
    waypoint = null;
    console.log("[healing-pet] state →", state);
  }

  // 7. Render.
  const stateTime = (now - stateEntryAt) / 1000;
  const speed = state === "Chasing" ? 0.8 : state === "Roaming" ? 0.5 : 0;
  const pose = poseFor(state, stateTime, dtSec, {
    mood: needs.mood,
    speed,
  });
  drawPet(ctx, pose, stopwatchT);

  // 8. Ambient speech.
  maybeSpeak(now);
}

// --- Boot ------------------------------------------------------------------

window.addEventListener("DOMContentLoaded", () => {
  void boot();
});

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>("#pet");
  if (canvas === null) {
    throw new Error("#pet canvas not found in the DOM");
  }

  // Backing store scales by device pixel ratio; CSS size stays 240x260 and
  // all drawing coordinates remain logical.
  const dpr = window.devicePixelRatio || (await getWindow().scaleFactor()) || 1;
  canvas.width = PET_WIDTH * dpr;
  canvas.height = PET_HEIGHT * dpr;
  const canvasCtx = canvas.getContext("2d");
  if (canvasCtx === null) {
    throw new Error("2d canvas context unavailable");
  }
  canvasCtx.scale(dpr, dpr);
  ctx = canvasCtx;

  // Restore needs from disk, applying offline satiety decay.
  let loaded: PetState;
  try {
    loaded = await loadState();
  } catch (err) {
    console.warn("[healing-pet] loadState failed, using defaults", err);
    loaded = defaultPetState();
  }
  const restored = applyOfflineDecay(loaded, new Date());
  needs = {
    satiety: restored.satiety,
    mood: restored.mood,
    intimacy: restored.intimacy,
    sleepiness: restored.sleepiness,
  };
  settings = { ...restored.settings };
  console.log("[healing-pet] restored needs", needs);

  // The FSM always starts in Idle; only needs are restored.
  state = "Idle";
  stateEntryAt = Date.now();
  lastInteractionAt = Date.now();
  lastMessageAt = 0;

  // Track the window's current logical position for cursor distance math.
  try {
    const pos = await getWindow().outerPosition();
    const sf = await getWindow().scaleFactor();
    windowPos = { x: pos.x / sf, y: pos.y / sf };
  } catch (err) {
    console.warn("[healing-pet] could not read window position", err);
    windowPos = { x: 0, y: 0 };
  }

  try {
    monitors = await listMonitors();
  } catch (err) {
    console.warn("[healing-pet] listMonitors failed", err);
    monitors = [];
  }

  // Keep the pet above other windows (best-effort).
  try {
    await setAlwaysOnTop(true);
  } catch (err) {
    console.warn("[healing-pet] setAlwaysOnTop failed", err);
  }

  await onCursorPosition(handleCursor);
  await onTrayAction(handleTrayAction);

  initContextMenu({
    onAction: handleMenuAction,
    getClickThrough: () => settings.clickThrough,
    onToggleClickThrough: () => {
      void toggleClickThroughHandler();
    },
  });

  canvas.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);
  window.addEventListener("mouseleave", onPointerLeave);

  getWindow().onCloseRequested(async (event) => {
    if (quitting) return;
    event.preventDefault();
    await quitApp();
  });

  storeTimer = window.setInterval(() => {
    void persist();
  }, SAVE_INTERVAL_MS);

  const loop = new GameLoop(tick);
  loop.start();
  console.log("[healing-pet] app started");
}