// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod monitor;

use config::{load_config, save_config, AppConfig};
use monitor::UsageData;
use std::sync::{Arc, Mutex};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Emitter, Manager,
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
fn get_config(state: tauri::State<'_, Arc<Mutex<AppConfig>>>) -> AppConfig {
    state.lock().unwrap().clone()
}

#[tauri::command]
fn save_plan(plan: String, custom_limit: Option<u64>,
    config_state: tauri::State<'_, Arc<Mutex<AppConfig>>>,
    usage_state: tauri::State<'_, Arc<Mutex<UsageData>>>,
) -> Result<UsageData, String> {
    // Update config
    let mut cfg = config_state.lock().unwrap();
    cfg.plan = Some(plan.clone());
    cfg.custom_limit = custom_limit;
    cfg.onboarding_done = Some(true);
    save_config(&cfg)?;

    // Update usage data
    let mut data = usage_state.lock().unwrap();
    data.plan = plan;
    data.custom_limit = custom_limit;
    data.update_limit();
    Ok(data.clone())
}

#[tauri::command]
fn set_plan(plan: String,
    config_state: tauri::State<'_, Arc<Mutex<AppConfig>>>,
    usage_state: tauri::State<'_, Arc<Mutex<UsageData>>>,
) -> UsageData {
    let mut cfg = config_state.lock().unwrap();
    cfg.plan = Some(plan.clone());
    cfg.custom_limit = None;
    let _ = save_config(&cfg);

    let mut data = usage_state.lock().unwrap();
    data.plan = plan;
    data.custom_limit = None;
    data.update_limit();
    data.clone()
}

#[tauri::command]
fn set_custom_limit(limit: u64,
    config_state: tauri::State<'_, Arc<Mutex<AppConfig>>>,
    usage_state: tauri::State<'_, Arc<Mutex<UsageData>>>,
) -> UsageData {
    let mut cfg = config_state.lock().unwrap();
    cfg.plan = Some("custom".into());
    cfg.custom_limit = Some(limit);
    let _ = save_config(&cfg);

    let mut data = usage_state.lock().unwrap();
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

fn apply_view_mode(window: &tauri::WebviewWindow, mode: &str) {
    match mode {
        "mini" => {
            let _ = window.set_min_size(Some(tauri::LogicalSize::new(100.0, 100.0)));
            let _ = window.set_size(tauri::LogicalSize::new(120.0, 120.0));
            let _ = window.set_always_on_top(true);
            let _ = window.set_decorations(false);
        }
        "full" => {
            let _ = window.set_min_size(Some(tauri::LogicalSize::new(600.0, 400.0)));
            let _ = window.set_size(tauri::LogicalSize::new(800.0, 600.0));
            let _ = window.set_always_on_top(false);
            let _ = window.set_decorations(false);
        }
        _ => {
            let _ = window.set_min_size(Some(tauri::LogicalSize::new(300.0, 400.0)));
            let _ = window.set_size(tauri::LogicalSize::new(360.0, 520.0));
            let _ = window.set_always_on_top(true);
            let _ = window.set_decorations(false);
        }
    }
}

#[tauri::command]
fn set_view_mode(mode: String, window: tauri::WebviewWindow,
    view_state: tauri::State<'_, Arc<Mutex<String>>>,
    config_state: tauri::State<'_, Arc<Mutex<AppConfig>>>,
) -> Result<(), String> {
    let mut current = view_state.lock().unwrap();
    *current = mode.clone();

    let mut cfg = config_state.lock().unwrap();
    cfg.view_mode = Some(mode.clone());
    let _ = save_config(&cfg);

    apply_view_mode(&window, &mode);
    Ok(())
}

#[tauri::command]
fn get_view_mode(state: tauri::State<'_, Arc<Mutex<String>>>) -> String {
    state.lock().unwrap().clone()
}

fn main() {
    // Load saved config
    let saved_config = load_config();
    let initial_plan = saved_config.plan.clone().unwrap_or_else(|| "max5".into());
    let initial_custom = saved_config.custom_limit;
    let initial_view = saved_config.view_mode.clone().unwrap_or_else(|| "compact".into());

    let mut initial_usage = UsageData::default();
    initial_usage.plan = initial_plan;
    initial_usage.custom_limit = initial_custom;
    initial_usage.update_limit();

    let usage_data = Arc::new(Mutex::new(initial_usage));
    let view_mode = Arc::new(Mutex::new(initial_view.clone()));
    let app_config = Arc::new(Mutex::new(saved_config));
    let usage_for_watcher = usage_data.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(usage_data)
        .manage(view_mode)
        .manage(app_config)
        .invoke_handler(tauri::generate_handler![
            start_drag,
            get_usage,
            get_config,
            save_plan,
            set_plan,
            set_custom_limit,
            set_project_filter,
            set_view_mode,
            get_view_mode
        ])
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            {
                app.handle().set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            let handle = app.handle().clone();

            // Tray menu with view mode options
            let show = MenuItemBuilder::with_id("show", "Show Scouter").build(app)?;
            let mode_mini = MenuItemBuilder::with_id("mode_mini", "🔴 Mini").build(app)?;
            let mode_compact = MenuItemBuilder::with_id("mode_compact", "📊 Compact").build(app)?;
            let mode_full = MenuItemBuilder::with_id("mode_full", "🖥️ Full Dashboard").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show)
                .separator()
                .item(&mode_mini)
                .item(&mode_compact)
                .item(&mode_full)
                .separator()
                .item(&quit)
                .build()?;

            let icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png")).unwrap();

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .icon_as_template(true)
                .menu(&menu)
                .tooltip("Claude Scouter")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "mode_mini" | "mode_compact" | "mode_full" => {
                            let mode = match event.id().as_ref() {
                                "mode_mini" => "mini",
                                "mode_full" => "full",
                                _ => "compact",
                            };
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                                apply_view_mode(&win, mode);

                                // Save to config
                                if let Some(cfg_state) = app.try_state::<Arc<Mutex<AppConfig>>>() {
                                    let mut cfg = cfg_state.lock().unwrap();
                                    cfg.view_mode = Some(mode.into());
                                    let _ = save_config(&cfg);
                                }
                                if let Some(vm_state) = app.try_state::<Arc<Mutex<String>>>() {
                                    let mut vm = vm_state.lock().unwrap();
                                    *vm = mode.into();
                                }
                                // Notify frontend
                                let _ = app.emit("view-mode-changed", mode);
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
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

            // Apply saved view mode on startup
            if let Some(win) = app.get_webview_window("main") {
                apply_view_mode(&win, &initial_view);
            }

            let data = usage_for_watcher.clone();
            std::thread::spawn(move || {
                monitor::watch_claude_usage(handle, data);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
