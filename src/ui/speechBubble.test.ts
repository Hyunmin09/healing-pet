import { describe, expect, it } from "vitest";
import { bubblePosition } from "./speechBubble";

describe("bubblePosition", () => {
  it("keeps the bubble at the anchor when it fits inside the window", () => {
    expect(bubblePosition(100, 50, 10, 10, 240, 260)).toEqual({ x: 10, y: 10 });
  });

  it("clamps the right edge when the bubble would overflow", () => {
    expect(bubblePosition(100, 50, 200, 10, 240, 260)).toEqual({
      x: 136,
      y: 10,
    });
  });

  it("clamps the bottom edge when the bubble would overflow", () => {
    expect(bubblePosition(100, 50, 10, 240, 240, 260)).toEqual({
      x: 10,
      y: 206,
    });
  });

  it("clamps negative anchors to the edge margin", () => {
    expect(bubblePosition(100, 50, -20, -20, 240, 260)).toEqual({ x: 4, y: 4 });
  });
});