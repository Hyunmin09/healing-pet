import { describe, expect, it } from "vitest";
import { nextState, type FsmCtx, type State } from "./fsm";

const T = 1_000_000;

function ctx(overrides: Partial<FsmCtx> = {}): FsmCtx {
  return {
    satiety: 80,
    mood: 70,
    sleepiness: 20,
    lastInteractionAt: T,
    cursorNearby: false,
    input: null,
    now: T,
    ...overrides,
  };
}

describe("nextState", () => {
  it.each<[State, Partial<FsmCtx>, State]>([
    // Rule 1: explicit sleep input always wins.
    ["Idle", { input: "sleep" }, "Sleeping"],
    ["Roaming", { input: "sleep", cursorNearby: true }, "Sleeping"],
    ["Chasing", { input: "sleep" }, "Sleeping"],

    // Rule 2: sleeping + click/feed wakes into the interaction state.
    ["Sleeping", { input: "click" }, "BeingPetted"],
    ["Sleeping", { input: "feed" }, "Eating"],
    // Rule 2: sleeping + nearby cursor wakes to Idle.
    ["Sleeping", { cursorNearby: true }, "Idle"],
    // Rule 2: otherwise stays asleep.
    ["Sleeping", {}, "Sleeping"],

    // Rule 3: feed input → Eating.
    ["Idle", { input: "feed" }, "Eating"],
    ["Roaming", { input: "feed", cursorNearby: true }, "Eating"],

    // Rule 4: click/pet input → BeingPetted.
    ["Idle", { input: "click" }, "BeingPetted"],
    ["Idle", { input: "pet" }, "BeingPetted"],
    // Eating + click → BeingPetted (input transitions are immediate).
    ["Eating", { input: "click", now: T + 1000 }, "BeingPetted"],

    // Rule 5: cursor nearby → Chasing (outside interaction states).
    ["Roaming", { cursorNearby: true }, "Chasing"],
    ["Idle", { cursorNearby: true }, "Chasing"],
    // Rule 5: BeingPetted/Eating are preserved, not overridden by cursor.
    ["BeingPetted", { cursorNearby: true, now: T + 1000 }, "BeingPetted"],
    ["Eating", { cursorNearby: true, now: T + 1000 }, "Eating"],

    // Rule 6: Chasing with cursor gone → Roaming.
    ["Chasing", {}, "Roaming"],

    // Rule 7: BeingPetted interaction finished → Idle.
    ["BeingPetted", { now: T + 2001 }, "Idle"],
    ["BeingPetted", { now: T + 1999 }, "BeingPetted"],

    // Rule 8: Eating interaction finished → Idle.
    ["Eating", { now: T + 3001 }, "Idle"],
    ["Eating", { now: T + 2999 }, "Eating"],

    // Rule 10: Idle without interaction for 8s → Roaming.
    ["Idle", { now: T + 8001, sleepiness: 10 }, "Roaming"],
    ["Idle", { now: T + 7999 }, "Idle"],

    // Rule 11: no interaction for 90s + sleepiness > 60 → Sleeping.
    ["Idle", { now: T + 90001, sleepiness: 70 }, "Sleeping"],
    ["Roaming", { now: T + 90001, sleepiness: 70 }, "Sleeping"],
    // Rule 11: sleepiness must exceed 60.
    ["Idle", { now: T + 90001, sleepiness: 60 }, "Roaming"],

    // Rule 12: Roaming with cursor gone stays Roaming.
    ["Roaming", {}, "Roaming"],

    // Rule 13: otherwise keep the current state.
    ["Idle", {}, "Idle"],
    ["Chasing", { cursorNearby: true }, "Chasing"],
  ])("nextState(%s, %o) === %s", (current, overrides, expected) => {
    expect(nextState(current, ctx(overrides))).toBe(expected);
  });

  it("hunger alone never changes state (rule 9)", () => {
    expect(nextState("Idle", ctx({ satiety: 10 }))).toBe("Idle");
    expect(nextState("Roaming", ctx({ satiety: 5, cursorNearby: false }))).toBe(
      "Roaming",
    );
  });
});