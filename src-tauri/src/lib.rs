mod bridge;
mod cursor;
mod state;
mod tray;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Second instance: bring the existing main window to the front.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            bridge::spawn_cursor_poll(app.handle().clone());
            tray::build_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bridge::list_monitors,
            bridge::toggle_click_through,
            bridge::set_click_through,
            bridge::set_always_on_top,
            state::load_state,
            state::save_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
