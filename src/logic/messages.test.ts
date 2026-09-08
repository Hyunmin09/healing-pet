import { describe, expect, it } from "vitest";
import {
  ALL_MSGS,
  CALM_MSGS,
  CHASING_MSGS,
  HUNGRY_MSGS,
  PETTED_MSGS,
  pickMessage,
} from "./messages";

describe("pickMessage", () => {
  it("returns null while sleeping", () => {
    expect(pickMessage("Sleeping", { satiety: 80, mood: 70 })).toBeNull();
  });

  it("returns a hungry message when satiety is low", () => {
    const msg = pickMessage("Idle", { satiety: 10, mood: 70 });
    expect(msg).not.toBeNull();
    expect(HUNGRY_MSGS).toContain(msg);
  });

  it("prefers the hungry message over the state category", () => {
    const msg = pickMessage("BeingPetted", { satiety: 5, mood: 70 });
    expect(HUNGRY_MSGS).toContain(msg);
  });

  it("returns a petted message while being petted", () => {
    const msg = pickMessage("BeingPetted", { satiety: 80, mood: 70 });
    expect(PETTED_MSGS).toContain(msg);
  });

  it("returns a chasing message while chasing", () => {
    const msg = pickMessage("Chasing", { satiety: 80, mood: 70 });
    expect(CHASING_MSGS).toContain(msg);
  });

  it("returns a calm message while idle", () => {
    const msg = pickMessage("Idle", { satiety: 80, mood: 70 });
    expect(CALM_MSGS).toContain(msg);
  });

  it("returns a calm message while roaming", () => {
    const msg = pickMessage("Roaming", { satiety: 80, mood: 70 });
    expect(CALM_MSGS).toContain(msg);
  });

  it("returns null while eating (no dedicated pool)", () => {
    expect(pickMessage("Eating", { satiety: 80, mood: 70 })).toBeNull();
  });
});

describe("message pool", () => {
  it("has at least 15 messages in total", () => {
    expect(ALL_MSGS.length).toBeGreaterThanOrEqual(15);
  });

  it("has 2-3 hungry messages", () => {
    expect(HUNGRY_MSGS.length).toBeGreaterThanOrEqual(2);
    expect(HUNGRY_MSGS.length).toBeLessThanOrEqual(3);
  });

  it("has 2-3 petted messages", () => {
    expect(PETTED_MSGS.length).toBeGreaterThanOrEqual(2);
    expect(PETTED_MSGS.length).toBeLessThanOrEqual(3);
  });

  it("has 2-3 chasing messages", () => {
    expect(CHASING_MSGS.length).toBeGreaterThanOrEqual(2);
    expect(CHASING_MSGS.length).toBeLessThanOrEqual(3);
  });

  it("has at least 8 calm messages", () => {
    expect(CALM_MSGS.length).toBeGreaterThanOrEqual(8);
  });

  it("contains no duplicate messages across pools", () => {
    expect(new Set(ALL_MSGS).size).toBe(ALL_MSGS.length);
  });
});