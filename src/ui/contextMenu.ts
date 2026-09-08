/**
 * Right-click context menu for the healing pet.
 *
 * `menuStateReducer` is a pure reducer (unit-tested in contextMenu.test.ts);
 * `initContextMenu` wires it to the DOM inside the `#menu` menuEl. Plain DOM
 * only — no popover/tooltip libraries.
 */

export type MenuAction =
  | "feed"
  | "pet"
  | "sleep"
  | "toggle-click-through"
  | "close";

export interface MenuState {
  open: boolean;
  x: number;
  y: number;
  clickThrough: boolean;
}

export type MenuReducerAction =
  | { type: "open"; x: number; y: number }
  | { type: "close" }
  | { type: "set-click-through"; enabled: boolean };

/** Logical window size of the transparent pet window. */
const WINDOW_WIDTH = 240;
const WINDOW_HEIGHT = 260;
/** Minimum distance from the window edge. */
const EDGE_MARGIN = 4;
/** Lock after each click-through toggle (ms) — prevents rapid-fire toggling. */
const TOGGLE_LOCK_MS = 300;

const MENU_SHELL_ID = "menu";

const MENU_ITEMS: ReadonlyArray<{ action: MenuAction; label: string }> = [
  { action: "feed", label: "먹이 주기" },
  { action: "pet", label: "쓰다듬기" },
  { action: "sleep", label: "재우기" },
  { action: "toggle-click-through", label: "클릭 통과" },
  { action: "close", label: "닫기" },
];

const CLICK_THROUGH_HINT =
  "클릭 통과 모드 — 펫이 입력을 받지 못해요. 트레이에서 해제하세요";

export interface ContextMenuOptions {
  onAction: (action: MenuAction) => void;
  getClickThrough: () => boolean;
  onToggleClickThrough: () => void;
}

export interface ContextMenuHandle {
  open: (x: number, y: number) => void;
  close: () => void;
  destroy: () => void;
}

export function menuStateReducer(
  state: MenuState,
  action: MenuReducerAction,
): MenuState {
  switch (action.type) {
    case "open":
      return { ...state, open: true, x: action.x, y: action.y };
    case "close":
      return { ...state, open: false };
    case "set-click-through":
      return { ...state, clickThrough: action.enabled };
  }
}

export function initContextMenu(opts: ContextMenuOptions): ContextMenuHandle {
  const shell = document.getElementById(MENU_SHELL_ID);
  if (!shell) {
    throw new Error(`#${MENU_SHELL_ID} shell not found in the DOM`);
  }
  // Hoisted function declarations below cannot see the narrowing above, so
  // capture the non-null value in an explicitly-typed binding.
  const menuEl: HTMLElement = shell;

  let state: MenuState = {
    open: false,
    x: 0,
    y: 0,
    clickThrough: opts.getClickThrough(),
  };
  let lastToggleAt = 0;

  menuEl.classList.add("ctx-menu");
  menuEl.textContent = "";

  const hint = document.createElement("div");
  hint.className = "ctx-hint";
  hint.textContent = CLICK_THROUGH_HINT;
  menuEl.appendChild(hint);

  const items = new Map<MenuAction, HTMLElement>();
  for (const item of MENU_ITEMS) {
    const el = document.createElement("div");
    el.className = "ctx-item";
    el.setAttribute("role", "menuitem");
    el.tabIndex = 0;

    if (item.action === "toggle-click-through") {
      const check = document.createElement("span");
      check.className = "ctx-check";
      check.textContent = "✓";
      el.appendChild(check);
    }

    const label = document.createElement("span");
    label.textContent = item.label;
    el.appendChild(label);

    el.addEventListener("click", () => handleAction(item.action));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleAction(item.action);
      }
    });

    menuEl.appendChild(el);
    items.set(item.action, el);
  }

  function dispatch(action: MenuReducerAction): void {
    state = menuStateReducer(state, action);
    syncDom();
  }

  function syncDom(): void {
    if (state.open) {
      menuEl.style.display = "block";
      const rect = menuEl.getBoundingClientRect();
      const x = Math.max(
        EDGE_MARGIN,
        Math.min(WINDOW_WIDTH - rect.width - EDGE_MARGIN, state.x),
      );
      const y = Math.max(
        EDGE_MARGIN,
        Math.min(WINDOW_HEIGHT - rect.height - EDGE_MARGIN, state.y),
      );
      menuEl.style.left = `${x}px`;
      menuEl.style.top = `${y}px`;
    } else {
      menuEl.style.display = "none";
    }

    hint.style.display = state.clickThrough ? "block" : "none";
    const toggleItem = items.get("toggle-click-through");
    if (toggleItem) {
      toggleItem.classList.toggle("checked", state.clickThrough);
    }
  }

  function handleAction(action: MenuAction): void {
    if (action === "toggle-click-through") {
      const now = Date.now();
      if (now - lastToggleAt < TOGGLE_LOCK_MS) {
        return;
      }
      lastToggleAt = now;
      const next = !opts.getClickThrough();
      opts.onToggleClickThrough();
      dispatch({ type: "set-click-through", enabled: next });
      return;
    }

    if (action === "close") {
      dispatch({ type: "close" });
      return;
    }

    opts.onAction(action);
    dispatch({ type: "close" });
  }

  function open(x: number, y: number): void {
    // Refresh the click-through flag from the external source on every open.
    dispatch({ type: "set-click-through", enabled: opts.getClickThrough() });
    dispatch({ type: "open", x, y });
  }

  function close(): void {
    dispatch({ type: "close" });
  }

  function onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    open(e.clientX, e.clientY);
  }

  function onMouseDown(e: MouseEvent): void {
    if (state.open && !(e.target instanceof Node && menuEl.contains(e.target))) {
      close();
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape" && state.open) {
      close();
    }
  }

  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("keydown", onKeyDown);

  syncDom();

  function destroy(): void {
    document.removeEventListener("contextmenu", onContextMenu);
    document.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("keydown", onKeyDown);
    menuEl.classList.remove("ctx-menu");
    menuEl.textContent = "";
    menuEl.style.display = "";
    menuEl.style.left = "";
    menuEl.style.top = "";
  }

  return { open, close, destroy };
}