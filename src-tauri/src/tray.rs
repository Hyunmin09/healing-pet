use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, Emitter};

/// Payload emitted to the frontend when a tray action is triggered.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayActionPayload {
    pub action: String,
}

/// Build the system tray icon and its menu.
pub fn build_tray(app: &App) -> tauri::Result<()> {
    let icon = app
        .default_window_icon()
        .expect("scaffold ships a default window icon")
        .clone();

    let toggle_visibility =
        MenuItem::with_id(app, "toggle-visibility", "Show / Hide", true, None::<&str>)?;
    let toggle_click_through = MenuItem::with_id(
        app,
        "toggle-click-through",
        "Toggle Click-Through",
        true,
        None::<&str>,
    )?;
    let feed = MenuItem::with_id(app, "feed", "Feed", true, None::<&str>)?;
    let pet = MenuItem::with_id(app, "pet", "Pet", true, None::<&str>)?;
    let sleep = MenuItem::with_id(app, "sleep", "Sleep", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &toggle_visibility,
            &toggle_click_through,
            &feed,
            &pet,
            &sleep,
            &quit,
        ],
    )?;

    app.on_menu_event(|app, event| {
        let action = event.id().as_ref().to_string();
        let _ = app.emit("pet-tray", TrayActionPayload { action });
    });

    TrayIconBuilder::with_id("pet-tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = tray.app_handle().emit(
                    "pet-tray",
                    TrayActionPayload {
                        action: "toggle-visibility".to_string(),
                    },
                );
            }
        })
        .build(app)?;

    Ok(())
}
