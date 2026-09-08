import { describe, expect, it } from "vitest";
import { poseFor, type EyeState, type Mouth, type PetStateName, type Pose } from "./pose";

const STATES: PetStateName[] = [
  "Idle",
  "Roaming",
  "Chasing",
  "BeingPetted",
  "Eating",
  "Sleeping",
];

const TIME_POINTS = [0, 0.1, 0.5, 1.5, 3];

/** Fixed 16.67ms frame step. */
const DT = 0.0167;

const EYE_STATES: readonly EyeState[] = ["open", "half", "closed", "happy"];
const MOUTHS: readonly Mouth[] = ["smile", "o", "none"];

const NUMERIC_FIELDS = ["bodyY", "squash", "leanX", "earAngle", "tailAngle", "speed"] as const;

function expectValidPose(pose: Pose): void {
  for (const field of NUMERIC_FIELDS) {
    expect(Number.isFinite(pose[field])).toBe(true);
  }
  expect(EYE_STATES).toContain(pose.eyeState);
  expect(MOUTHS).toContain(pose.mouth);
  expect(typeof pose.blush).toBe("boolean");
  expect(typeof pose.zzz).toBe("boolean");
  expect(typeof pose.hearts).toBe("boolean");
}

describe("poseFor", () => {
  it("returns a type-valid Pose for every state at several stateTime points", () => {
    for (const state of STATES) {
      for (const t of TIME_POINTS) {
        expectValidPose(poseFor(state, t, DT));
      }
    }
  });

  it("keeps every numeric parameter's per-frame change below 0.2", () => {
    for (const state of STATES) {
      for (const t of TIME_POINTS) {
        const a = poseFor(state, t, DT);
        const b = poseFor(state, t + DT, DT);
        for (const field of NUMERIC_FIELDS) {
          expect(Math.abs(b[field] - a[field]), `${state} ${field} at t=${t}`).toBeLessThan(0.2);
        }
      }
    }
  });

  it("keeps the bob smooth even at full speed", () => {
    for (const state of ["Roaming", "Chasing"] as const) {
      for (const t of TIME_POINTS) {
        const a = poseFor(state, t, DT, { speed: 1 });
        const b = poseFor(state, t + DT, DT, { speed: 1 });
        expect(Math.abs(b.bodyY - a.bodyY)).toBeLessThan(0.2);
      }
    }
  });

  it("maps each state to its intended eye and mouth", () => {
    expect(poseFor("Idle", 0.5, DT).eyeState).toBe("open");
    expect(poseFor("Idle", 0.5, DT).mouth).toBe("smile");
    expect(poseFor("Roaming", 0.5, DT).eyeState).toBe("half");
    expect(poseFor("Roaming", 0.5, DT).mouth).toBe("none");
    expect(poseFor("Chasing", 0.5, DT).eyeState).toBe("open");
    expect(poseFor("Chasing", 0.5, DT).mouth).toBe("none");
    expect(poseFor("BeingPetted", 0.5, DT).eyeState).toBe("happy");
    expect(poseFor("BeingPetted", 0.5, DT).mouth).toBe("smile");
    expect(poseFor("Eating", 0.5, DT).eyeState).toBe("half");
    expect(poseFor("Eating", 0.5, DT).mouth).toBe("o");
    expect(poseFor("Sleeping", 0.5, DT).eyeState).toBe("closed");
    expect(poseFor("Sleeping", 0.5, DT).mouth).toBe("none");
  });

  it("sleeping: zzz on and eyes closed", () => {
    const pose = poseFor("Sleeping", 0.1, DT);
    expect(pose.zzz).toBe(true);
    expect(pose.eyeState).toBe("closed");
    expect(pose.mouth).toBe("none");
  });

  it("being petted: squash exceeds 0.3, happy eyes, blush, hearts early", () => {
    const pose = poseFor("BeingPetted", 0.1, DT);
    expect(pose.squash).toBeGreaterThan(0.3);
    expect(pose.eyeState).toBe("happy");
    expect(pose.blush).toBe(true);
    expect(pose.hearts).toBe(true);
  });

  it("being petted: hearts stop after the first second", () => {
    expect(poseFor("BeingPetted", 1.5, DT).hearts).toBe(false);
  });

  it("droops ears when mood is below 30", () => {
    expect(poseFor("Idle", 0.5, DT, { mood: 20 }).earAngle).toBeLessThan(0);
  });

  it("keeps ears neutral when mood is 30 or above", () => {
    expect(poseFor("Idle", 0.5, DT, { mood: 80 }).earAngle).toBe(0);
  });

  it("is deterministic: same inputs yield the same pose", () => {
    const a = poseFor("Roaming", 0.7, DT, { speed: 0.6, mood: 50 });
    const b = poseFor("Roaming", 0.7, DT, { speed: 0.6, mood: 50 });
    expect(a).toEqual(b);
  });
});