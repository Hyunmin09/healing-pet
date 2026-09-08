import { describe, expect, it } from "vitest";
import { tickNeeds, type NeedState } from "./needs";

const NOW = 1_000_000;

function needs(overrides: Partial<NeedState> = {}): NeedState {
  return {
    satiety: 100,
    mood: 50,
    intimacy: 0,
    sleepiness: 0,
    ...overrides,
  };
}

describe("tickNeeds", () => {
  it("drains satiety to 0 over 18000 seconds", () => {
    const result = tickNeeds(needs(), 18000, NOW, {
      state: "Roaming",
      satietyLow: false,
    });
    expect(result.satiety).toBeCloseTo(0, 5);
  });

  it("drains satiety proportionally (9000s → 50)", () => {
    const result = tickNeeds(needs(), 9000, NOW, {
      state: "Roaming",
      satietyLow: false,
    });
    expect(result.satiety).toBeCloseTo(50, 5);
  });

  it("clamps satiety at 0", () => {
    const result = tickNeeds(needs(), 36000, NOW, {
      state: "Roaming",
      satietyLow: false,
    });
    expect(result.satiety).toBe(0);
  });

  it("clamps satiety at 100", () => {
    const result = tickNeeds(needs({ satiety: 100 }), -1000, NOW, {
      state: "Roaming",
      satietyLow: false,
    });
    expect(result.satiety).toBe(100);
  });

  it("raises sleepiness from 0 to 100 over 90s while awake", () => {
    const result = tickNeeds(needs(), 90, NOW, {
      state: "Roaming",
      satietyLow: false,
    });
    expect(result.sleepiness).toBeCloseTo(100, 5);
  });

  it("lowers sleepiness from 100 to 20 over 60s while sleeping", () => {
    const result = tickNeeds(needs({ sleepiness: 100 }), 60, NOW, {
      state: "Sleeping",
      satietyLow: false,
    });
    expect(result.sleepiness).toBeCloseTo(20, 5);
  });

  it("clamps sleepiness at 100 while awake", () => {
    const result = tickNeeds(needs(), 180, NOW, {
      state: "Roaming",
      satietyLow: false,
    });
    expect(result.sleepiness).toBe(100);
  });

  it("clamps sleepiness at 0 while sleeping", () => {
    const result = tickNeeds(needs({ sleepiness: 0 }), 120, NOW, {
      state: "Sleeping",
      satietyLow: false,
    });
    expect(result.sleepiness).toBe(0);
  });

  it("returns mood toward 50 from above (10-minute time constant)", () => {
    const result = tickNeeds(needs({ mood: 80 }), 600, NOW, {
      state: "Roaming",
      satietyLow: false,
    });
    // 80 + (50-80)*1 = 50 after a full time constant.
    expect(result.mood).toBeCloseTo(50, 5);
  });

  it("returns mood toward 50 from below", () => {
    const result = tickNeeds(needs({ mood: 20 }), 600, NOW, {
      state: "Roaming",
      satietyLow: false,
    });
    expect(result.mood).toBeCloseTo(50, 5);
  });

  it("applies a partial mood recovery proportional to dt", () => {
    const result = tickNeeds(needs({ mood: 80 }), 300, NOW, {
      state: "Roaming",
      satietyLow: false,
    });
    // 80 + (50-80)*0.5 = 65.
    expect(result.mood).toBeCloseTo(65, 5);
  });

  it("applies an extra mood penalty while satiety is low", () => {
    const result = tickNeeds(needs({ mood: 50 }), 6000, NOW, {
      state: "Roaming",
      satietyLow: true,
    });
    // 50 (no drift) - 100 penalty = -50 → clamped to 0.
    expect(result.mood).toBe(0);
  });

  it("clamps mood at 100", () => {
    const result = tickNeeds(needs({ mood: 100 }), -6000, NOW, {
      state: "Roaming",
      satietyLow: false,
    });
    expect(result.mood).toBe(100);
  });

  it("leaves intimacy unchanged", () => {
    const result = tickNeeds(needs({ intimacy: 42 }), 18000, NOW, {
      state: "Roaming",
      satietyLow: false,
    });
    expect(result.intimacy).toBe(42);
  });
});