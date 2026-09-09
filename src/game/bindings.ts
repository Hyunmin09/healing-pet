import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  getCurrentWebviewWindow,
  type WebviewWindow,
} from "@tauri-apps/api/webviewWindow";

/** Logical monitor geometry reported by `listMonitors`. */
export interface MonitorInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

/** Persistent pet settings (mirrors Rust `PetSettings`). */
export interface PetSettings {
  clickThrough: boolean;
  messageFreqMs: number;
}

/** Full persistent pet state (mirrors Rust `PetState`). */
export interface PetState {
  satiety: number;
  mood: number;
  intimacy: number;
  sleepiness: number;
  lastSeenAt: string;
  settings: PetSettings;
  version: number;
}

/** Payload of the `cursor-position` event. */
export interface CursorPosPayload {
  x: number;
  y: number;
  scaleFactor: number;
}

/** Actions dispatched from the tray menu via the `pet-tray` event. */
export type TrayAction =
  | "toggle-visibility"
  | "toggle-click-through"
  | "feed"
  | "pet"
  | "sleep"
  | "quit";

/** Payload of the `pet-tray` event. */
export interface TrayActionPayload {
  action: TrayAction;
}

/** The current webview window, cached at module load. */
const currentWindow = getCurrentWebviewWindow();

/** Return the cached current webview window. */
export function getWindow(): WebviewWindow {
  return currentWindow;
}

/** List all monitors as logical geometry. */
export function listMonitors(): Promise<MonitorInfo[]> {
  return invoke<MonitorInfo[]>("list_monitors");
}

/** Load the persisted pet state (falls back to defaults on the Rust side). */
export function loadState(): Promise<PetState> {
  return invoke<PetState>("load_state");
}

/** Persist the pet state to disk. */
export function saveState(state: PetState): Promise<void> {
  return invoke<void>("save_state", { state });
}

/** Toggle click-through, returning the new state. */
export function toggleClickThrough(): Promise<boolean> {
  return invoke<boolean>("toggle_click_through");
}

/** Set always-on-top state. */
export function setAlwaysOnTop(onTop: boolean): Promise<void> {
  return invoke<void>("set_always_on_top", { onTop });
}

/** Subscribe to cursor position updates. */
export function onCursorPosition(
  cb: (pos: CursorPosPayload) => void,
): Promise<UnlistenFn> {
  return listen<CursorPosPayload>("cursor-position", (event) =>
    cb(event.payload),
  );
}

/** Subscribe to tray menu actions. */
export function onTrayAction(
  cb: (action: TrayAction) => void,
): Promise<UnlistenFn> {
  return listen<TrayActionPayload>("pet-tray", (event) =>
    cb(event.payload.action),
  );
}