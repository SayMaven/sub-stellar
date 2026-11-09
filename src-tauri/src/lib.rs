pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::get_system_info,
            commands::probe_hardware_capabilities,
        ])
        .run(tauri::generate_context!())
        .expect("error while running substellar application");
}
