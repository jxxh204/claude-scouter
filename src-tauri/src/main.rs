// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod monitor;

use monitor::UsageData;
use std::sync::{Arc, Mutex};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Manager,
};

#[tauri::command]
fn get_usage(state: tauri::State<'_, Arc<Mutex<UsageData>>>) -> UsageData {
    state.lock().unwrap().clone()
}

#[tauri::command]
fn set_plan(plan: String, state: tauri::State<'_, Arc<Mutex<UsageData>>>) -> UsageData {
    let mut data = state.lock().unwrap();
    data.plan = plan;
    data.update_limit();
    data.clone()
}

fn main() {
    let usage_data = Arc::new(Mutex::new(UsageData::default()));
    let usage_for_watcher = usage_data.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(usage_data)
        .invoke_handler(tauri::generate_handler![get_usage, set_plan])
        .setup(move |app| {
            let handle = app.handle().clone();

            // Build tray menu
            let show = MenuItemBuilder::with_id("show", "Show Scouter").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app).item(&show).separator().item(&quit).build()?;

            // Create tray icon
            let icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png")).unwrap();

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("Claude Scouter")
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Start file watcher
            let data = usage_for_watcher.clone();
            std::thread::spawn(move || {
                monitor::watch_claude_usage(handle, data);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
