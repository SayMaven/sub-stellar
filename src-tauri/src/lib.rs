pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::get_system_info,
            commands::ffmpeg::probe_hardware_capabilities,
            commands::ffmpeg::ffmpeg_check_binary,
            commands::ffmpeg::ffmpeg_start_export_pipe,
            commands::ffmpeg::ffmpeg_write_frame_chunk,
            commands::ffmpeg::ffmpeg_finish_export,
            commands::ffmpeg::ffmpeg_cancel_export,
            commands::ffmpeg::ffmpeg_export_ass_burnin,
            commands::ytdl::ytdl_get_info,
            commands::ytdl::ytdl_check_binary,
            commands::ytdl::ytdl_download_media,
            commands::lyrics_proxy::lyrics_http_get,
        ])
        .run(tauri::generate_context!())
        .expect("error while running substellar application");
}

