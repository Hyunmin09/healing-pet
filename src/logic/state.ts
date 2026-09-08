/**
 * Pure pet state model: types, defaults, and offline decay.
 *
 * These types mirror the fields of `PetState`/`PetSettings` in
 * `src/game/bindings.ts` (the Tauri binding layer). They are re-declared here
 * as pure, dependency-free types so the logic layer never imports the Tauri
 * binding module. Keep the two definitions in sync.
 */

/** Persistent pet settings (mirrors Rust `PetSettings`). */
export interface PetSettings {
  clickThrough: boolean;
  messageFreqMs: number;
}

/** Full persistent pet state (mirrors Rust `PetState`). */
export interface PetState {
  satiety: number;
  mood: number;
  intimacy: number;
  sleepiness: number;
  lastSeenAt: string;
  settings: PetSettings;
  version: number;
}

/** Default settings applied when no persisted state exists. */
export const DEFAULT_SETTINGS: PetSettings = {
  clickThrough: false,
  messageFreqMs: 45000,
};

/** Current persisted-state schema version. */
export const STATE_VERSION = 1;

/** Minutes of elapsed time that drain satiety from 100 to 0. */
const SATIETY_DRAIN_MINUTES = 300;

/** Clamp a value into the inclusive [0, 100] range. */
function clamp100(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** Build a fresh pet state with default values at the given time. */
export function defaultPetState(now: Date = new Date()): PetState {
  return {
    satiety: 80,
    mood: 70,
    intimacy: 0,
    sleepiness: 20,
    lastSeenAt: now.toISOString(),
    settings: { ...DEFAULT_SETTINGS },
    version: STATE_VERSION,
  };
}

/**
 * Apply offline decay to satiety based on time elapsed since `lastSeenAt`.
 *
 * Satiety drains linearly: 100 points over 300 minutes. The result is clamped
 * to [0, 100]. If `lastSeenAt` cannot be parsed, the state is returned
 * unchanged. `lastSeenAt` is intentionally NOT updated here — the caller
 * refreshes it when persisting.
 */
export function applyOfflineDecay(state: PetState, now: Date): PetState {
  const lastSeen = Date.parse(state.lastSeenAt);
  if (Number.isNaN(lastSeen)) {
    return state;
  }

  const elapsedMin = (now.getTime() - lastSeen) / 60000;
  const decay = (elapsedMin / SATIETY_DRAIN_MINUTES) * 100;

  return {
    ...state,
    satiety: clamp100(state.satiety - decay),
  };
}
