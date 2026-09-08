/**
 * Pure needs tick: decays/recovers the pet's needs over time.
 *
 * `tickNeeds` is a pure function — it takes a needs snapshot and a delta time
 * (in seconds) and returns the updated needs. It does not track
 * `lastInteractionAt`; whether the pet is "uninteracted" is decided by the
 * caller (todo 8 PetApp), which may also apply interaction resets. This module
 * only distinguishes sleeping vs. awake via `ctx.state`.
 */

import type { State } from "./fsm";

/** The pet's four needs, each in the [0, 100] range. */
export interface NeedState {
  satiety: number;
  mood: number;
  intimacy: number;
  sleepiness: number;
}

/** Result of a needs tick (same shape as `NeedState`). */
export type NeedsResult = NeedState;

/** Context consumed by `tickNeeds`. */
export interface NeedsCtx {
  state: State;
  satietyLow: boolean;
}

/** Seconds for satiety to drain from 100 to 0 (300 minutes). */
const SATIETY_DRAIN_SECONDS = 18000;
/** Seconds for sleepiness to rise from 0 to 100 while awake (90s). */
const SLEEPINESS_RISE_SECONDS = 90;
/** Seconds for sleepiness to drop 100 points while sleeping (75s). */
const SLEEPINESS_FALL_SECONDS = 75;
/** Mood recovery time constant (seconds) — 10 minutes. */
const MOOD_RECOVERY_SECONDS = 600;
/** Seconds for the hunger penalty to drain mood 100 points. */
const MOOD_HUNGER_PENALTY_SECONDS = 6000;

/** Clamp a value into the inclusive [0, 100] range. */
function clamp100(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Advance the needs by `dt` seconds.
 *
 * `now` is reserved for the caller contract (todo 8 may pass a wall-clock
 * timestamp); the decay math here depends only on `dt`.
 */
export function tickNeeds(
  s: NeedState,
  dt: number,
  _now: number,
  ctx: NeedsCtx,
): NeedState {
  // Satiety drains linearly: 100 points over 18000 seconds.
  const satiety = clamp100(s.satiety - (dt / SATIETY_DRAIN_SECONDS) * 100);

  // Sleepiness: falls while sleeping, rises while awake.
  const sleepiness = clamp100(
    ctx.state === "Sleeping"
      ? s.sleepiness - (dt / SLEEPINESS_FALL_SECONDS) * 100
      : s.sleepiness + (dt / SLEEPINESS_RISE_SECONDS) * 100,
  );

  // Mood drifts back toward 50 with a 10-minute time constant.
  let mood = s.mood + (50 - s.mood) * Math.min(1, dt / MOOD_RECOVERY_SECONDS);
  // Hunger adds an extra mood penalty while satiety is low.
  if (ctx.satietyLow) {
    mood -= (dt / MOOD_HUNGER_PENALTY_SECONDS) * 100;
  }
  mood = clamp100(mood);

  // Intimacy is unchanged here — it only grows through interactions (todo 8).
  return { satiety, mood, intimacy: s.intimacy, sleepiness };
}
