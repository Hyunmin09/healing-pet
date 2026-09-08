import { describe, expect, it } from "vitest";
import { clampDelta, fixedSteps } from "./loop";

describe("clampDelta", () => {
  it("clamps a 300ms gap (tab switch) to the 250ms max", () => {
    expect(clampDelta(300)).toBe(250);
  });

  it("passes through a normal 30ms frame delta", () => {
    expect(clampDelta(30)).toBe(30);
  });

  it("passes through a zero delta", () => {
    expect(clampDelta(0)).toBe(0);
  });

  it("clamps negative deltas to zero", () => {
    expect(clampDelta(-16)).toBe(0);
  });

  it("honors a custom max", () => {
    expect(clampDelta(100, 50)).toBe(50);
  });
});

describe("fixedSteps", () => {
  it("runs 2 steps for a 33.34ms delta", () => {
    expect(fixedSteps(33.34)).toBe(2);
  });

  it("runs 1 step for a 16.67ms delta", () => {
    expect(fixedSteps(16.67)).toBe(1);
  });

  it("runs ceil(100/16.67) steps for a 100ms delta", () => {
    expect(fixedSteps(100)).toBe(Math.ceil(100 / 16.67));
  });

  it("runs at least 1 step even for a zero delta", () => {
    expect(fixedSteps(0)).toBe(1);
  });

  it("clamps the delta before splitting into steps", () => {
    expect(fixedSteps(500)).toBe(Math.ceil(250 / 16.67));
  });
});