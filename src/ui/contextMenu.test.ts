import { describe, expect, it } from "vitest";
import { menuStateReducer, type MenuState } from "./contextMenu";

const closed: MenuState = { open: false, x: 0, y: 0, clickThrough: false };

describe("menuStateReducer", () => {
  it("opens the menu and records the coordinates", () => {
    const next = menuStateReducer(closed, { type: "open", x: 40, y: 50 });
    expect(next.open).toBe(true);
    expect(next.x).toBe(40);
    expect(next.y).toBe(50);
  });

  it("closes an open menu", () => {
    const open = menuStateReducer(closed, { type: "open", x: 10, y: 10 });
    const next = menuStateReducer(open, { type: "close" });
    expect(next.open).toBe(false);
  });

  it("reflects set-click-through in the state", () => {
    const next = menuStateReducer(closed, {
      type: "set-click-through",
      enabled: true,
    });
    expect(next.clickThrough).toBe(true);
  });

  it("updates coordinates when reopened while already open", () => {
    const open = menuStateReducer(closed, { type: "open", x: 10, y: 10 });
    const reopened = menuStateReducer(open, { type: "open", x: 90, y: 120 });
    expect(reopened.open).toBe(true);
    expect(reopened.x).toBe(90);
    expect(reopened.y).toBe(120);
  });

  it("preserves clickThrough across open/close cycles", () => {
    const withClickThrough = menuStateReducer(closed, {
      type: "set-click-through",
      enabled: true,
    });
    const opened = menuStateReducer(withClickThrough, {
      type: "open",
      x: 5,
      y: 5,
    });
    const closedAgain = menuStateReducer(opened, { type: "close" });
    expect(closedAgain.clickThrough).toBe(true);
  });
});