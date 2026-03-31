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
fn start_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_usage(state: tauri::State<'_, Arc<Mutex<UsageData>>>) -> UsageData {
    state.lock().unwrap().clone()
}

#[tauri::command]
fn set_plan(plan: String, state: tauri::State<'_, Arc<Mutex<UsageData>>>) -> UsageData {
    let mut data = state.lock().unwrap();
    data.plan = plan;
    data.custom_limit = None;
    data.update_limit();
    data.clone()
}

#[tauri::command]
fn set_custom_limit(limit: u64, state: tauri::State<'_, Arc<Mutex<UsageData>>>) -> UsageData {
    let mut data = state.lock().unwrap();
    data.plan = "custom".into();
    data.custom_limit = Some(limit);
    data.update_limit();
    data.clone()
}

#[tauri::command]
fn set_project_filter(project: Option<String>, state: tauri::State<'_, Arc<Mutex<UsageData>>>) -> UsageData {
    let mut data = state.lock().unwrap();
    data.active_project = project;
    data.clone()
}

#[tauri::command]
fn set_mini_mode(mini: bool, window: tauri::WebviewWindow) -> Result<(), String> {
    if mini {
        let _ = window.set_size(tauri::LogicalSize::new(280.0, 52.0));
        let _ = window.set_min_size(Some(tauri::LogicalSize::new(200.0, 48.0)));
    } else {
        let _ = window.set_size(tauri::LogicalSize::new(360.0, 620.0));
        let _ = window.set_min_size(Some(tauri::LogicalSize::new(300.0, 400.0)));
    }
    Ok(())
}

fn main() {
    let usage_data = Arc::new(Mutex::new(UsageData::default()));
    let usage_for_watcher = usage_data.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(usage_data)
        .invoke_handler(tauri::generate_handler![
            start_drag,
            get_usage,
            set_plan,
            set_custom_limit,
            set_project_filter,
            set_mini_mode
        ])
        .setup(move |app| {
            // Hide from Dock — tray-only mode
            #[cfg(target_os = "macos")]
            {
                app.handle().set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            let handle = app.handle().clone();

            let show = MenuItemBuilder::with_id("show", "Show Scouter").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app).item(&show).separator().item(&quit).build()?;

            let icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png")).unwrap();

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .icon_as_template(true)
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

            let data = usage_for_watcher.clone();
            std::thread::spawn(move || {
                monitor::watch_claude_usage(handle, data);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
