pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::get_system_info,
            commands::ffmpeg::probe_hardware_capabilities,
            commands::ffmpeg::ffmpeg_check_binary,
            commands::ffmpeg::ffmpeg_start_export_pipe,
            commands::ffmpeg::ffmpeg_open_ws_stream,
            commands::ffmpeg::ffmpeg_write_frame_chunk,
            commands::ffmpeg::ffmpeg_finish_export,
            commands::ffmpeg::ffmpeg_cancel_export,
            commands::ffmpeg::ffmpeg_export_ass_burnin,
            commands::ytdl::ytdl_get_info,
            commands::ytdl::ytdl_check_binary,
            commands::ytdl::ytdl_download_media,
            commands::ytdl::ytdl_download_subtitle,
            commands::ytdl::ytdl_list_cached_media,
            commands::ytdl::ytdl_delete_cached_media,
            commands::lyrics_proxy::lyrics_http_get,
            commands::project_io::project_save_dialog,
            commands::project_io::project_write_file,
            commands::project_io::project_open_dialog,
            commands::project_io::media_open_dialog,
            commands::project_io::allow_asset_file,
            commands::project_io::read_local_media_bytes,
            commands::project_io::export_save_dialog,
            commands::project_io::reveal_in_explorer,
            commands::fonts::get_system_fonts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running substellar application");
}

