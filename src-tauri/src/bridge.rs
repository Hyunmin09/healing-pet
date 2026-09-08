use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Window};

use crate::cursor::MonitorInfo;

/// Cursor position payload emitted to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct CursorPosPayload {
    pub x: f64,
    pub y: f64,
    pub scale_factor: f64,
}

/// Poll interval for cursor position (100ms = 10Hz, well under 60Hz).
const POLL_INTERVAL: Duration = Duration::from_millis(100);

/// Current click-through state. Tauri 2.11.5 exposes no getter for
/// `set_ignore_cursor_events`, so the toggle tracks its own state.
static CLICK_THROUGH: AtomicBool = AtomicBool::new(false);

/// List all available monitors as logical geometry.
#[tauri::command]
pub fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    app.available_monitors()
        .map(|monitors| {
            monitors
                .into_iter()
                .map(|mon| MonitorInfo {
                    x: mon.position().x,
                    y: mon.position().y,
                    width: mon.size().width,
                    height: mon.size().height,
                    scale_factor: mon.scale_factor(),
                })
                .collect()
        })
        .map_err(|e| e.to_string())
}

/// Toggle click-through on the given window, returning the new state.
#[tauri::command]
pub fn toggle_click_through(window: Window) -> Result<bool, String> {
    let enabled = !CLICK_THROUGH.load(Ordering::Relaxed);
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|e| e.to_string())?;
    CLICK_THROUGH.store(enabled, Ordering::Relaxed);
    Ok(enabled)
}

/// Set click-through state on the given window.
#[tauri::command]
pub fn set_click_through(window: Window, enabled: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|e| e.to_string())?;
    CLICK_THROUGH.store(enabled, Ordering::Relaxed);
    Ok(())
}

/// Set always-on-top state on the given window.
#[tauri::command]
pub fn set_always_on_top(window: Window, on_top: bool) -> Result<(), String> {
    window.set_always_on_top(on_top).map_err(|e| e.to_string())
}

/// Spawn a background thread that polls the cursor position every 100ms and
/// emits it to the frontend as `cursor-position`.
///
/// The loop exits when the main window is destroyed (cursor_position keeps
/// failing) or when the app handle is no longer valid.
pub fn spawn_cursor_poll(app: AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(POLL_INTERVAL);

        let Some(window) = app.get_webview_window("main") else {
            continue;
        };

        // Physical cursor position, normalized to logical coordinates.
        let Ok(pos) = window.cursor_position() else {
            // Window destroyed: stop polling.
            break;
        };
        let Ok(scale_factor) = window.scale_factor() else {
            continue;
        };

        let payload = CursorPosPayload {
            x: pos.x / scale_factor,
            y: pos.y / scale_factor,
            scale_factor,
        };
        let _ = app.emit("cursor-position", payload);
    });
}