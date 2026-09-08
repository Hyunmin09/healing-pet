import { describe, expect, it } from "vitest";
import { classifyPointer } from "./drag";

describe("classifyPointer", () => {
  it("classifies a 5px movement after 400ms as a click (time is ignored)", () => {
    expect(classifyPointer({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe("click");
  });

  it("classifies a 7px movement after 100ms as a drag", () => {
    expect(classifyPointer({ x: 0, y: 0 }, { x: 7, y: 0 })).toBe("drag");
  });

  it("classifies exactly 6px as a drag (inclusive threshold)", () => {
    expect(classifyPointer({ x: 0, y: 0 }, { x: 6, y: 0 })).toBe("drag");
  });

  it("classifies a 0px movement as a click", () => {
    expect(classifyPointer({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe("click");
  });
});