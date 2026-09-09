import { describe, expect, it } from "vitest";
import { classifyPointer, classifyScreenPointer } from "./drag";

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

describe("classifyScreenPointer", () => {
  it("classifies a 5px screen movement as a click", () => {
    expect(
      classifyScreenPointer({ screenX: 0, screenY: 0 }, { screenX: 3, screenY: 4 }),
    ).toBe("click");
  });

  it("classifies exactly 6px of screen movement as a drag (inclusive threshold)", () => {
    expect(
      classifyScreenPointer({ screenX: 0, screenY: 0 }, { screenX: 6, screenY: 0 }),
    ).toBe("drag");
  });

  it("is immune to window motion: a 5px screen move is a click even when client coords moved 100px", () => {
    // The window moved under the cursor while the pointer was held: the
    // client-relative position shifted from (20,20) to (120,20) — a 100px
    // client movement — but the OS-level screen position only moved 5px
    // (down (100,100)s → up (105,100)s). Screen-based classification must
    // see a click, not a drag.
    expect(
      classifyScreenPointer({ screenX: 100, screenY: 100 }, { screenX: 105, screenY: 100 }),
    ).toBe("click");
  });

  it("classifies a 0px screen movement as a click", () => {
    expect(
      classifyScreenPointer({ screenX: 100, screenY: 100 }, { screenX: 100, screenY: 100 }),
    ).toBe("click");
  });
});