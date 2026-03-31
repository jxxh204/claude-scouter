// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod monitor;

use monitor::UsageData;
use std::sync::{Arc, Mutex};
#[allow(unused_imports)]
use tauri::Manager;

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
        .manage(usage_data)
        .invoke_handler(tauri::generate_handler![get_usage, set_plan])
        .setup(move |app| {
            let handle = app.handle().clone();
            let data = usage_for_watcher.clone();

            // Start file watcher in background thread
            std::thread::spawn(move || {
                monitor::watch_claude_usage(handle, data);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
