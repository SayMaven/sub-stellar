pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::get_system_info,
            commands::probe_hardware_capabilities,
            commands::ytdl::ytdl_get_info,
            commands::ytdl::ytdl_check_binary,
            commands::ytdl::ytdl_download_media,
            commands::lyrics_proxy::lyrics_http_get,
        ])
        .run(tauri::generate_context!())
        .expect("error while running substellar application");
}

