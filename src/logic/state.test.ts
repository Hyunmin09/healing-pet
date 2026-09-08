import { describe, expect, it } from "vitest";
import {
  applyOfflineDecay,
  defaultPetState,
  DEFAULT_SETTINGS,
  STATE_VERSION,
} from "./state";

describe("defaultPetState", () => {
  it("returns the documented default values", () => {
    const state = defaultPetState();
    expect(state.satiety).toBe(80);
    expect(state.mood).toBe(70);
    expect(state.intimacy).toBe(0);
    expect(state.sleepiness).toBe(20);
    expect(state.version).toBe(STATE_VERSION);
    expect(state.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("stamps lastSeenAt as an ISO8601 timestamp", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const state = defaultPetState(now);
    expect(state.lastSeenAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("copies settings so the default object is not shared", () => {
    const a = defaultPetState();
    const b = defaultPetState();
    a.settings.messageFreqMs = 999;
    expect(b.settings.messageFreqMs).toBe(DEFAULT_SETTINGS.messageFreqMs);
  });
});

describe("applyOfflineDecay", () => {
  it("drains satiety by 50 over 150 minutes (80 → 30)", () => {
    const state = defaultPetState(new Date("2026-01-01T00:00:00.000Z"));
    const now = new Date("2026-01-01T02:30:00.000Z");
    const result = applyOfflineDecay(state, now);
    expect(result.satiety).toBeCloseTo(30, 5);
  });

  it("clamps satiety at 0 after a long absence", () => {
    const state = defaultPetState(new Date("2026-01-01T00:00:00.000Z"));
    const now = new Date("2026-01-03T00:00:00.000Z"); // 2 days later
    const result = applyOfflineDecay(state, now);
    expect(result.satiety).toBe(0);
  });

  it("returns the state unchanged when lastSeenAt is unparseable", () => {
    const state = defaultPetState();
    state.lastSeenAt = "not-a-date";
    const result = applyOfflineDecay(state, new Date());
    expect(result).toBe(state);
  });

  it("does not update lastSeenAt (the caller refreshes it on save)", () => {
    const state = defaultPetState(new Date("2026-01-01T00:00:00.000Z"));
    const now = new Date("2026-01-01T01:00:00.000Z");
    const result = applyOfflineDecay(state, now);
    expect(result.lastSeenAt).toBe(state.lastSeenAt);
  });

  it("leaves non-satiety needs untouched", () => {
    const state = defaultPetState(new Date("2026-01-01T00:00:00.000Z"));
    const now = new Date("2026-01-01T02:30:00.000Z");
    const result = applyOfflineDecay(state, now);
    expect(result.mood).toBe(state.mood);
    expect(result.intimacy).toBe(state.intimacy);
    expect(result.sleepiness).toBe(state.sleepiness);
    expect(result.settings).toEqual(state.settings);
    expect(result.version).toBe(state.version);
  });
});