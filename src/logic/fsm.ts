/**
 * Pure behavioral finite state machine for the pet.
 *
 * `nextState` is a pure function: given the current state and a context
 * snapshot, it returns the next state. It performs no side effects and holds
 * no internal memory — all timing is derived from `ctx.now` and
 * `ctx.lastInteractionAt`.
 */

/** The pet's behavioral states. */
export type State =
  | "Idle"
  | "Roaming"
  | "Chasing"
  | "BeingPetted"
  | "Eating"
  | "Sleeping";

/** Input events that can drive a transition. */
export type Input = "click" | "feed" | "pet" | "sleep" | null;

/** Context snapshot consumed by `nextState`. */
export interface FsmCtx {
  satiety: number;
  mood: number;
  sleepiness: number;
  /** ms epoch of the last user interaction. */
  lastInteractionAt: number;
  /** true = cursor within 120px for 500ms. */
  cursorNearby: boolean;
  input: Input;
  /** ms epoch of "now". */
  now: number;
}

/** Interaction timeout before a BeingPetted state returns to Idle (ms). */
const PETTED_TIMEOUT_MS = 2000;
/** Interaction timeout before an Eating state returns to Idle (ms). */
const EATING_TIMEOUT_MS = 3000;
/** Idle without interaction before roaming (ms). */
const IDLE_TO_ROAM_MS = 8000;
/** No interaction for this long + high sleepiness triggers sleep (ms). */
const SLEEP_AFTER_IDLE_MS = 90000;
/** Sleepiness threshold above which the pet falls asleep. */
const SLEEP_SLEEPINESS_THRESHOLD = 60;

/**
 * Compute the next state from the current state and context.
 *
 * Rules are evaluated in priority order (see the numbered comments). Note
 * that rule 9 (hunger) deliberately produces no transition — hunger alone
 * never changes state; only a user feed action does.
 */
export function nextState(current: State, ctx: FsmCtx): State {
  // 1. Explicit sleep input always wins.
  if (ctx.input === "sleep") {
    return "Sleeping";
  }

  // 2. While sleeping: click/feed wake into their interaction state; a
  //    nearby cursor wakes to Idle; otherwise stay asleep.
  if (current === "Sleeping") {
    if (ctx.input === "click") {
      return "BeingPetted";
    }
    if (ctx.input === "feed") {
      return "Eating";
    }
    if (ctx.cursorNearby) {
      return "Idle";
    }
    return "Sleeping";
  }

  // 3. Feed input → Eating (immediate).
  if (ctx.input === "feed") {
    return "Eating";
  }

  // 4. Click/pet input → BeingPetted (immediate).
  if (ctx.input === "click" || ctx.input === "pet") {
    return "BeingPetted";
  }

  // 5. Cursor nearby → Chasing, unless already in an interaction state
  //    (BeingPetted/Eating), which takes priority and is preserved.
  if (ctx.cursorNearby && current !== "BeingPetted" && current !== "Eating") {
    return "Chasing";
  }

  // 6. Chasing with cursor gone → Roaming.
  if (current === "Chasing" && !ctx.cursorNearby) {
    return "Roaming";
  }

  // 7. BeingPetted interaction finished → Idle.
  if (current === "BeingPetted" && ctx.now - ctx.lastInteractionAt >= PETTED_TIMEOUT_MS) {
    return "Idle";
  }

  // 8. Eating interaction finished → Idle.
  if (current === "Eating" && ctx.now - ctx.lastInteractionAt >= EATING_TIMEOUT_MS) {
    return "Idle";
  }

  // 9. Hunger (satiety < 20) does not itself change state — only a user feed
  //    action (rule 3) does. Deliberately no transition here.

  // 11. No interaction for 90s + high sleepiness → Sleeping. Evaluated before
  //     rule 10 so a sleepy pet falls asleep instead of roaming.
  if (
    ctx.now - ctx.lastInteractionAt >= SLEEP_AFTER_IDLE_MS &&
    ctx.sleepiness > SLEEP_SLEEPINESS_THRESHOLD
  ) {
    return "Sleeping";
  }

  // 10. Idle without interaction for 8s → Roaming.
  if (current === "Idle" && ctx.now - ctx.lastInteractionAt >= IDLE_TO_ROAM_MS) {
    return "Roaming";
  }

  // 12. Roaming with cursor gone stays Roaming (waypoint arrival/handoff is
  //     managed by the caller in PetApp — the FSM only handles transitions).

  // 13. Otherwise keep the current state.
  return current;
}
