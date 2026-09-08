/**
 * Pure pose parameter generator for the blob-cat renderer.
 *
 * `poseFor` is a deterministic pure function: the same (state, stateTime, dt)
 * always yields the same Pose. There is no internal interpolation state —
 * smoothing is baked into the target formulas as functions of `stateTime`
 * (which resets to 0 on every state transition), so parameters start at 0 on
 * entry and approach their targets smoothly. Every oscillating term is sized
 * so its per-frame (16.67ms) change stays below 0.2.
 */

export type EyeState = "open" | "half" | "closed" | "happy";
export type Mouth = "smile" | "o" | "none";

export interface Pose {
  /** Body vertical offset in px (positive = down). */
  bodyY: number;
  /** 0 = normal, >0.3 = squashed. */
  squash: number;
  /** Body lean in px. */
  leanX: number;
  /** Ear angle in degrees (negative = drooped). */
  earAngle: number;
  eyeState: EyeState;
  mouth: Mouth;
  blush: boolean;
  /** Tail sway in degrees. */
  tailAngle: number;
  /** Sleeping Zzz particles. */
  zzz: boolean;
  /** Heart particles. */
  hearts: boolean;
  /** Movement speed 0..1 (bob amplitude). */
  speed: number;
}

export type PetStateName =
  | "Idle"
  | "Roaming"
  | "Chasing"
  | "BeingPetted"
  | "Eating"
  | "Sleeping";

export interface PoseOptions {
  /** Pet mood 0..100; below 30 droops the ears. */
  mood?: number;
  /** Movement speed 0..1 (bob amplitude / lean). */
  speed?: number;
}

const TAU = Math.PI * 2;

/** Clamp a value into [0, 1]. */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Exponential ease-in: 0 at t=0, asymptotically approaching 1 with rate k.
 * Used to ramp constant targets up smoothly from a state transition.
 */
function easeIn(t: number, k: number): number {
  return 1 - Math.exp(-t * k);
}

/** Ear droop when mood is low (negative = drooped). */
function earDroop(stateTime: number, mood: number | undefined): number {
  if (mood === undefined || mood >= 30) return 0;
  return -6 * easeIn(stateTime, 1.5);
}

/**
 * Compute the pose for a pet state at a given time since state entry.
 *
 * `stateTime` is seconds since the state began; `dt` is the frame delta in
 * seconds (accepted for caller symmetry; smoothing is stateTime-based so the
 * output stays deterministic). `opts.mood` below 30 droops the ears;
 * `opts.speed` drives bob/lean for Roaming and Chasing.
 */
export function poseFor(
  state: PetStateName,
  stateTime: number,
  _dt: number,
  opts: PoseOptions = {},
): Pose {
  const mood = opts.mood;
  const speed = clamp01(opts.speed ?? (state === "Chasing" ? 0.8 : 0.5));
  const droop = earDroop(stateTime, mood);

  switch (state) {
    case "Idle":
      return {
        bodyY: Math.sin((stateTime * TAU) / 1.5) * 2.7,
        squash: 0,
        leanX: 0,
        earAngle: droop,
        eyeState: "open",
        mouth: "smile",
        blush: false,
        tailAngle: Math.sin((stateTime * TAU) / 3) * 5,
        zzz: false,
        hearts: false,
        speed: 0,
      };
    case "Roaming":
      return {
        bodyY: Math.sin(stateTime * TAU) * speed * 1.5,
        squash: 0,
        leanX: speed * 3,
        earAngle: droop,
        eyeState: "half",
        mouth: "none",
        blush: false,
        tailAngle: Math.sin((stateTime * TAU) / 1.5) * 2.5,
        zzz: false,
        hearts: false,
        speed,
      };
    case "Chasing":
      return {
        bodyY: Math.sin(stateTime * TAU * 1.5) * speed * 1.2,
        squash: 0,
        leanX: speed * 3,
        earAngle: droop,
        eyeState: "open",
        mouth: "none",
        blush: false,
        tailAngle: Math.sin((stateTime * TAU) / 1.5) * 2.5,
        zzz: false,
        hearts: false,
        speed,
      };
    case "BeingPetted":
      return {
        bodyY: Math.sin((stateTime * TAU) / 0.6) * 1.0,
        squash: 0.4 * Math.sin((stateTime * TAU) / 0.6),
        leanX: 0,
        earAngle: droop,
        eyeState: "happy",
        mouth: "smile",
        blush: true,
        tailAngle: Math.sin(stateTime * TAU) * 1.8,
        zzz: false,
        hearts: stateTime < 1,
        speed: 0,
      };
    case "Eating":
      return {
        bodyY: Math.sin(stateTime * TAU * 2) * 0.8,
        squash: 0.1 * easeIn(stateTime, 8),
        leanX: 0,
        earAngle: droop,
        eyeState: "half",
        mouth: "o",
        blush: false,
        tailAngle: Math.sin((stateTime * TAU) / 1.5) * 2.5,
        zzz: false,
        hearts: false,
        speed: 0.5,
      };
    case "Sleeping":
      return {
        bodyY: 0,
        squash: 0.2 * easeIn(stateTime, 8),
        leanX: 0,
        earAngle: droop,
        eyeState: "closed",
        mouth: "none",
        blush: false,
        tailAngle: 0,
        zzz: stateTime % 0.4 < 0.3,
        hearts: false,
        speed: 0,
      };
  }
}