use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStderr, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FFmpegInfo {
    pub found: bool,
    pub version: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HardwareCapabilities {
    pub gpu_accelerated: bool,
    pub recommended_quality: String,
    pub primary_encoder: String,
    pub available_encoders: Vec<String>,
    pub supports_alpha_webm: bool,
    pub supports_alpha_prores: bool,
    pub ffmpeg_found: bool,
    pub ffmpeg_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPipeConfig {
    pub session_id: String,
    pub output_path: String,
    pub mode: String, // "mp4_burnin", "webm_alpha", "prores_alpha"
    pub encoder: Option<String>,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub total_frames: u64,
    pub audio_source_path: Option<String>,
    pub audio_bitrate: Option<String>,
    #[serde(default)]
    pub overlay_y: Option<u32>,
    #[serde(default)]
    pub overlay_height: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportProgress {
    pub session_id: String,
    pub frames_written: u64,
    pub total_frames: u64,
    pub percentage: f32,
    pub fps: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportResult {
    pub success: bool,
    pub output_path: String,
    pub file_size_bytes: u64,
    pub elapsed_seconds: f64,
    pub error_message: Option<String>,
}

struct PipeWriterState {
    stdin: Option<BufWriter<ChildStdin>>,
    needs_roi_pad: bool,
    roi_byte_offset: usize,
    roi_byte_len: usize,
    frame_canvas: Vec<u8>,
    staging_frame: Vec<u8>,
    blank_frame: Option<Vec<u8>>,
    last_frame: Option<Vec<u8>>,
    total_frames: u64,
    frames_written: u64,
    start_time: Instant,
}

struct ActiveExportSession {
    child: Mutex<Option<Child>>,
    pipe: Mutex<PipeWriterState>,
    output_path: String,
    stderr_log: Arc<Mutex<String>>,
    temp_files: Mutex<Vec<String>>,
    cancelled: std::sync::atomic::AtomicBool,
}

const MAX_STDERR_BYTES: usize = 16 * 1024;

fn spawn_stderr_drain(stderr: Option<ChildStderr>) -> Arc<Mutex<String>> {
    let log = Arc::new(Mutex::new(String::new()));
    if let Some(mut err_stream) = stderr {
        let log_clone = Arc::clone(&log);
        std::thread::spawn(move || {
            let mut buf = [0u8; 2048];
            while let Ok(n) = err_stream.read(&mut buf) {
                if n == 0 {
                    break;
                }
                let text = String::from_utf8_lossy(&buf[..n]);
                if let Ok(mut guard) = log_clone.lock() {
                    guard.push_str(&text);
                    if guard.len() > MAX_STDERR_BYTES {
                        let excess = guard.len() - MAX_STDERR_BYTES;
                        let mut cut = excess;
                        while !guard.is_char_boundary(cut) && cut < guard.len() {
                            cut += 1;
                        }
                        guard.drain(..cut);
                    }
                }
            }
        });
    }
    log
}

fn format_pipe_write_error(
    session: &ActiveExportSession,
    context: &str,
    io_err: std::io::Error,
) -> String {
    if io_err.kind() == std::io::ErrorKind::BrokenPipe {
        std::thread::sleep(Duration::from_millis(40));
        let stderr_text = session
            .stderr_log
            .lock()
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        if !stderr_text.is_empty() {
            return format!("{}: {} (FFmpeg: {})", context, io_err, stderr_text);
        }
    }
    format!("{}: {}", context, io_err)
}

pub fn escape_ffmpeg_filter_path(path: &str) -> String {
    path.replace('\\', "/").replace(':', "\\:").replace('\'', "\\'")
}

pub fn build_ass_burnin_filter(ass_path: &str, fonts_dir: Option<&str>) -> String {
    let escaped_ass = escape_ffmpeg_filter_path(ass_path);
    if let Some(dir) = fonts_dir {
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            let escaped_dir = escape_ffmpeg_filter_path(trimmed);
            return format!("ass='{}':fontsdir='{}'", escaped_ass, escaped_dir);
        }
    }
    format!("ass='{}'", escaped_ass)
}

static SESSIONS: Mutex<Option<HashMap<String, Arc<ActiveExportSession>>>> = Mutex::new(None);

fn with_sessions<F, R>(f: F) -> R
where
    F: FnOnce(&mut HashMap<String, Arc<ActiveExportSession>>) -> R,
{
    let mut lock = SESSIONS.lock().unwrap();
    if lock.is_none() {
        *lock = Some(HashMap::new());
    }
    f(lock.as_mut().unwrap())
}

fn hide_console_window(cmd: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = cmd;
    }
}

/// Locate FFmpeg binary on PATH or sidecar
pub fn find_ffmpeg() -> Option<String> {
    // 1. Try "ffmpeg" directly on PATH
    let mut probe_cmd = Command::new("ffmpeg");
    hide_console_window(&mut probe_cmd);
    if let Ok(output) = probe_cmd.arg("-version").output() {
        if output.status.success() {
            return Some("ffmpeg".to_string());
        }
    }

    // 2. Try common Windows paths
    let common_paths = [
        "ffmpeg.exe",
        "bin/ffmpeg.exe",
        "C:\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
    ];

    for p in &common_paths {
        if Path::new(p).exists() {
            return Some(p.to_string());
        }
    }

    None
}

/// Probes if a specific video encoder can successfully encode on this machine
pub fn probe_single_encoder(ffmpeg_bin: &str, encoder: &str, format: &str) -> bool {
    let mut cmd = Command::new(ffmpeg_bin);
    hide_console_window(&mut cmd);
    cmd.args([
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=320x240:d=0.04",
        "-c:v",
        encoder,
    ]);

    if format == "yuva420p" {
        cmd.args(["-pix_fmt", "yuva420p"]);
    } else if format == "yuva444p10le" {
        cmd.args(["-pix_fmt", "yuva444p10le", "-profile:v", "4444"]);
    }

    cmd.args(["-f", "null", "-"]);

    match cmd.output() {
        Ok(out) => out.status.success(),
        Err(_) => false,
    }
}

#[tauri::command]
pub fn ffmpeg_check_binary() -> Result<FFmpegInfo, String> {
    match find_ffmpeg() {
        Some(bin) => {
            let mut cmd = Command::new(&bin);
            hide_console_window(&mut cmd);
            let out = cmd
                .arg("-version")
                .output()
                .map_err(|e| e.to_string())?;

            let stdout_str = String::from_utf8_lossy(&out.stdout);
            let first_line = stdout_str
                .lines()
                .next()
                .unwrap_or("FFmpeg detected")
                .to_string();

            Ok(FFmpegInfo {
                found: true,
                version: first_line,
                path: bin,
            })
        }
        None => Ok(FFmpegInfo {
            found: false,
            version: String::new(),
            path: String::new(),
        }),
    }
}

#[tauri::command]
pub fn probe_hardware_capabilities() -> Result<HardwareCapabilities, String> {
    let ffmpeg_bin = match find_ffmpeg() {
        Some(b) => b,
        None => {
            return Ok(HardwareCapabilities {
                gpu_accelerated: false,
                recommended_quality: "low".to_string(),
                primary_encoder: "libx264".to_string(),
                available_encoders: vec!["libx264".to_string()],
                supports_alpha_webm: false,
                supports_alpha_prores: false,
                ffmpeg_found: false,
                ffmpeg_version: "Not found".to_string(),
            });
        }
    };

    let mut ver_cmd = Command::new(&ffmpeg_bin);
    hide_console_window(&mut ver_cmd);
    let version_out = ver_cmd
        .arg("-version")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).lines().next().unwrap_or("").to_string())
        .unwrap_or_else(|_| "FFmpeg".to_string());

    // Tiered encoder auto-probing:
    // 1. h264_nvenc (NVIDIA)
    // 2. h264_qsv (Intel QuickSync)
    // 3. h264_amf (AMD)
    // 4. libx264 (CPU Fallback)
    let candidate_encoders = ["h264_nvenc", "h264_qsv", "h264_amf", "libx264"];
    let mut available_encoders = Vec::new();
    let mut primary_encoder = String::new();

    for enc in &candidate_encoders {
        if probe_single_encoder(&ffmpeg_bin, enc, "yuv420p") {
            available_encoders.push(enc.to_string());
            if primary_encoder.is_empty() {
                primary_encoder = enc.to_string();
            }
        }
    }

    if primary_encoder.is_empty() {
        primary_encoder = "libx264".to_string();
        available_encoders.push("libx264".to_string());
    }

    // Alpha channel encoders probe
    let supports_alpha_webm = probe_single_encoder(&ffmpeg_bin, "libvpx-vp9", "yuva420p");
    let supports_alpha_prores = probe_single_encoder(&ffmpeg_bin, "prores_ks", "yuva444p10le");

    if supports_alpha_webm {
        available_encoders.push("libvpx-vp9".to_string());
    }
    if supports_alpha_prores {
        available_encoders.push("prores_ks".to_string());
    }

    let is_gpu = primary_encoder != "libx264";
    let recommended_quality = if is_gpu {
        "ultra".to_string()
    } else {
        "balanced".to_string()
    };

    Ok(HardwareCapabilities {
        gpu_accelerated: is_gpu,
        recommended_quality,
        primary_encoder,
        available_encoders,
        supports_alpha_webm,
        supports_alpha_prores,
        ffmpeg_found: true,
        ffmpeg_version: version_out,
    })
}

#[tauri::command]
pub fn ffmpeg_start_export_pipe(config: ExportPipeConfig) -> Result<String, String> {
    let ffmpeg_bin = find_ffmpeg().ok_or_else(|| "FFmpeg binary not found on system".to_string())?;

    let audio_exists = config
        .audio_source_path
        .as_ref()
        .map(|p| Path::new(p).exists())
        .unwrap_or(false);
    let is_video_source = config
        .audio_source_path
        .as_ref()
        .filter(|_| audio_exists)
        .map(|p| {
            let lower = p.to_lowercase();
            lower.ends_with(".mp4")
                || lower.ends_with(".webm")
                || lower.ends_with(".mkv")
                || lower.ends_with(".mov")
        })
        .unwrap_or(false);

    let roi_y = config
        .overlay_y
        .unwrap_or(0)
        .min(config.height.saturating_sub(1));
    let raw_roi_h = config.overlay_height.unwrap_or(config.height).max(1);
    let roi_height = raw_roi_h
        .min(config.height.saturating_sub(roi_y))
        .max(1);
    let is_roi_cropped = roi_y > 0 || roi_height < config.height;
    let direct_roi_pipe = config.mode == "mp4_burnin" && is_video_source;
    let needs_roi_pad = is_roi_cropped && !direct_roi_pipe;
    let pipe_input_height = if direct_roi_pipe {
        roi_height
    } else {
        config.height
    };

    let exact_duration_secs =
        (config.total_frames as f64) / (config.fps.max(1) as f64);
    let duration_str = format!("{:.3}", exact_duration_secs.max(0.1));

    let mut cmd = Command::new(&ffmpeg_bin);
    hide_console_window(&mut cmd);
    cmd.args(["-y", "-hide_banner", "-loglevel", "error"]);

    // Raw video input from stdin
    cmd.args([
        "-thread_queue_size",
        "128",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-s",
        &format!("{}x{}", config.width, pipe_input_height),
        "-r",
        &config.fps.to_string(),
        "-i",
        "-",
    ]);

    // Optional media (video or audio) source input
    let has_audio = if let Some(ref audio_path) = config.audio_source_path {
        if audio_exists {
            cmd.args(["-thread_queue_size", "128", "-i", audio_path]);
            true
        } else {
            false
        }
    } else {
        false
    };

    // Encoder and pixel format configuration
    match config.mode.as_str() {
        "webm_alpha" => {
            cmd.args([
                "-c:v",
                "libvpx-vp9",
                "-pix_fmt",
                "yuva420p",
                "-b:v",
                "0",
                "-crf",
                "26",
                "-deadline",
                "good",
                "-cpu-used",
                "4",
                "-row-mt",
                "1",
                "-threads",
                "0",
                "-auto-alt-ref",
                "0",
            ]);
            if has_audio {
                cmd.args([
                    "-map",
                    "0:v",
                    "-map",
                    "1:a?",
                    "-c:a",
                    "libopus",
                    "-b:a",
                    "128k",
                    "-ac",
                    "2",
                ]);
            }
        }
        "prores_alpha" => {
            cmd.args([
                "-c:v",
                "prores_ks",
                "-profile:v",
                "4444",
                "-pix_fmt",
                "yuva444p10le",
                "-threads",
                "0",
            ]);
            if has_audio {
                cmd.args(["-map", "0:v", "-map", "1:a?", "-c:a", "pcm_s16le"]);
            }
        }
        _ => {
            // Default: mp4_burnin (Composites RGBA subtitle overlay [0:v] over source video [1:v] when present)
            if is_video_source {
                let filter = format!(
                    "[1:v]scale={w}:{h}:force_original_aspect_ratio=decrease:flags=fast_bilinear,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1[bg];[bg][0:v]overlay=0:{oy}:eof_action=pass[outv]",
                    w = config.width,
                    h = config.height,
                    oy = roi_y
                );
                cmd.args([
                    "-filter_complex",
                    &filter,
                    "-filter_complex_threads",
                    "0",
                    "-map",
                    "[outv]",
                    "-map",
                    "1:a?",
                ]);
            } else if has_audio {
                cmd.args(["-map", "0:v", "-map", "1:a?"]);
            }

            let enc = config
                .encoder
                .clone()
                .unwrap_or_else(|| "libx264".to_string());

            match enc.as_str() {
                "h264_nvenc" => {
                    cmd.args([
                        "-c:v",
                        "h264_nvenc",
                        "-pix_fmt",
                        "yuv420p",
                        "-preset",
                        "p2",
                        "-tune",
                        "hq",
                        "-rc",
                        "vbr",
                        "-cq",
                        "22",
                        "-b:v",
                        "0",
                    ]);
                }
                "h264_qsv" => {
                    cmd.args([
                        "-c:v",
                        "h264_qsv",
                        "-pix_fmt",
                        "yuv420p",
                        "-global_quality",
                        "22",
                    ]);
                }
                "h264_amf" => {
                    cmd.args([
                        "-c:v",
                        "h264_amf",
                        "-pix_fmt",
                        "yuv420p",
                        "-quality",
                        "speed",
                    ]);
                }
                _ => {
                    cmd.args([
                        "-c:v",
                        "libx264",
                        "-pix_fmt",
                        "yuv420p",
                        "-preset",
                        "veryfast",
                        "-crf",
                        "22",
                    ]);
                }
            }

            if has_audio {
                let ab = config
                    .audio_bitrate
                    .clone()
                    .unwrap_or_else(|| "192k".to_string());
                cmd.args(["-c:a", "aac", "-b:a", &ab]);
            }
        }
    }

    cmd.args(["-t", &duration_str]);
    cmd.arg(&config.output_path);
    cmd.stdin(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;
    let stdin = child.stdin.take().ok_or_else(|| "Failed to open FFmpeg stdin".to_string())?;
    let stderr_log = spawn_stderr_drain(child.stderr.take());

    let stride_bytes = (config.width as usize).saturating_mul(4);
    let roi_byte_offset = (roi_y as usize).saturating_mul(stride_bytes);
    let roi_byte_len = (roi_height as usize).saturating_mul(stride_bytes);
    let full_bytes = (config.height as usize).saturating_mul(stride_bytes);
    let is_transparent =
        config.mode == "webm_alpha" || config.mode == "prores_alpha" || is_video_source;

    let frame_canvas = if needs_roi_pad {
        if is_transparent {
            vec![0u8; full_bytes]
        } else {
            let mut buf = Vec::with_capacity(full_bytes);
            for _ in 0..(full_bytes / 4) {
                buf.extend_from_slice(&[10, 13, 20, 255]);
            }
            buf
        }
    } else {
        Vec::new()
    };

    let session_id = config.session_id.clone();
    let session = Arc::new(ActiveExportSession {
        child: Mutex::new(Some(child)),
        pipe: Mutex::new(PipeWriterState {
            stdin: Some(BufWriter::with_capacity(1024 * 1024, stdin)),
            needs_roi_pad,
            roi_byte_offset,
            roi_byte_len,
            frame_canvas,
            staging_frame: Vec::new(),
            blank_frame: None,
            last_frame: None,
            total_frames: config.total_frames,
            frames_written: 0,
            start_time: Instant::now(),
        }),
        output_path: config.output_path,
        stderr_log,
        temp_files: Mutex::new(Vec::new()),
        cancelled: std::sync::atomic::AtomicBool::new(false),
    });

    with_sessions(|map| {
        map.insert(session_id.clone(), session);
    });

    Ok(session_id)
}

#[tauri::command]
pub async fn ffmpeg_write_frame_chunk(request: tauri::ipc::Request<'_>) -> Result<ExportProgress, String> {
    let headers = request.headers();
    let session_id = headers
        .get("x-session-id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| "Missing x-session-id header".to_string())?
        .to_string();

    let use_blank = headers
        .get("x-use-blank")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let reuse_last = headers
        .get("x-reuse-last")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let cache_blank = headers
        .get("x-cache-blank")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let commit_frame = headers
        .get("x-commit-frame")
        .and_then(|v| v.to_str().ok())
        .map(|v| v != "0" && !v.eq_ignore_ascii_case("false"))
        .unwrap_or(true);

    let repeat_count = headers
        .get("x-repeat-count")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(1)
        .clamp(1, 240);

    let chunk_bytes: Vec<u8> = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => bytes.clone(),
        tauri::ipc::InvokeBody::Json(_) if use_blank || reuse_last => Vec::new(),
        tauri::ipc::InvokeBody::Json(_) => {
            return Err("Expected raw binary frame payload".to_string());
        }
    };

    let session = with_sessions(|map| map.get(&session_id).cloned())
        .ok_or_else(|| format!("Export session not found: {}", session_id))?;

    tauri::async_runtime::spawn_blocking(move || {
        if session.cancelled.load(std::sync::atomic::Ordering::Relaxed) {
            return Err("Export was cancelled by user".to_string());
        }

        let mut pipe = session
            .pipe
            .lock()
            .map_err(|_| "Export pipe lock poisoned".to_string())?;

        if session.cancelled.load(std::sync::atomic::Ordering::Relaxed) {
            return Err("Export was cancelled by user".to_string());
        }

        let state = &mut *pipe;

        if use_blank || reuse_last {
            let frames_to_write = state
                .total_frames
                .saturating_sub(state.frames_written)
                .min(repeat_count);
            let cached_slice = if use_blank {
                state
                    .blank_frame
                    .as_deref()
                    .ok_or_else(|| "Blank frame cache not initialized".to_string())?
            } else {
                state
                    .last_frame
                    .as_deref()
                    .ok_or_else(|| "Last frame cache not initialized".to_string())?
            };

            let write_slice: &[u8] = if state.needs_roi_pad {
                let copy_len = cached_slice.len().min(state.roi_byte_len);
                let end = state.roi_byte_offset + copy_len;
                state.frame_canvas[state.roi_byte_offset..end]
                    .copy_from_slice(&cached_slice[..copy_len]);
                &state.frame_canvas
            } else {
                cached_slice
            };

            let stdin = state
                .stdin
                .as_mut()
                .ok_or_else(|| "Stdin already closed".to_string())?;

            for _ in 0..frames_to_write {
                if let Err(e) = stdin.write_all(write_slice) {
                    return Err(format_pipe_write_error(
                        &session,
                        if use_blank {
                            "Failed to write cached blank frame to FFmpeg"
                        } else {
                            "Failed to write repeated frame to FFmpeg"
                        },
                        e,
                    ));
                }
            }
            state.frames_written += frames_to_write;
        } else if !commit_frame {
            if state.staging_frame.is_empty() && state.roi_byte_len > 0 {
                state.staging_frame.reserve(state.roi_byte_len);
            }
            state.staging_frame.extend_from_slice(&chunk_bytes);
        } else {
            let owned_frame: Option<Vec<u8>> = if !state.staging_frame.is_empty() {
                state.staging_frame.extend_from_slice(&chunk_bytes);
                Some(std::mem::take(&mut state.staging_frame))
            } else {
                None
            };
            let frame_slice: &[u8] = owned_frame.as_deref().unwrap_or(&chunk_bytes);

            if cache_blank {
                state.blank_frame = Some(frame_slice.to_vec());
            }
            state.last_frame = Some(frame_slice.to_vec());

            let write_slice: &[u8] = if state.needs_roi_pad {
                let copy_len = frame_slice.len().min(state.roi_byte_len);
                let end = state.roi_byte_offset + copy_len;
                state.frame_canvas[state.roi_byte_offset..end]
                    .copy_from_slice(&frame_slice[..copy_len]);
                &state.frame_canvas
            } else {
                frame_slice
            };

            let stdin = state
                .stdin
                .as_mut()
                .ok_or_else(|| "Stdin already closed".to_string())?;
            if let Err(e) = stdin.write_all(write_slice) {
                return Err(format_pipe_write_error(
                    &session,
                    "Failed to write raw frame to FFmpeg",
                    e,
                ));
            }
            state.frames_written += 1;
        }

        let elapsed = state.start_time.elapsed().as_secs_f32().max(0.001);
        let fps = state.frames_written as f32 / elapsed;
        let percentage = if state.total_frames > 0 {
            (state.frames_written as f32 / state.total_frames as f32 * 100.0).min(100.0)
        } else {
            0.0
        };

        Ok(ExportProgress {
            session_id,
            frames_written: state.frames_written,
            total_frames: state.total_frames,
            percentage,
            fps,
        })
    })
    .await
    .map_err(|e| format!("Export worker thread failed: {}", e))?
}

#[tauri::command]
pub async fn ffmpeg_finish_export(session_id: String) -> Result<ExportResult, String> {
    let session = with_sessions(|map| map.remove(&session_id))
        .ok_or_else(|| format!("Export session not found: {}", session_id))?;

    tauri::async_runtime::spawn_blocking(move || {
        let elapsed = {
            let mut pipe = session
                .pipe
                .lock()
                .map_err(|_| "Export pipe lock poisoned".to_string())?;
            if let Some(mut bw) = pipe.stdin.take() {
                let _ = bw.flush();
            }
            pipe.frame_canvas = Vec::new();
            pipe.staging_frame = Vec::new();
            pipe.blank_frame = None;
            pipe.last_frame = None;
            pipe.start_time.elapsed().as_secs_f64()
        };

        let mut child = session
            .child
            .lock()
            .map_err(|_| "Export child lock poisoned".to_string())?
            .take()
            .ok_or_else(|| "FFmpeg process already finalized".to_string())?;

        let status = child
            .wait()
            .map_err(|e| format!("Failed to wait for FFmpeg: {}", e))?;

        std::thread::sleep(Duration::from_millis(25));

        if status.success() {
            let file_size = fs::metadata(&session.output_path)
                .map(|m| m.len())
                .unwrap_or(0);

            Ok(ExportResult {
                success: true,
                output_path: session.output_path.clone(),
                file_size_bytes: file_size,
                elapsed_seconds: elapsed,
                error_message: None,
            })
        } else {
            let err_text = session
                .stderr_log
                .lock()
                .map(|s| s.trim().to_string())
                .unwrap_or_default();
            Ok(ExportResult {
                success: false,
                output_path: session.output_path.clone(),
                file_size_bytes: 0,
                elapsed_seconds: elapsed,
                error_message: Some(if err_text.is_empty() {
                    "FFmpeg exited with non-zero status".to_string()
                } else {
                    err_text
                }),
            })
        }
    })
    .await
    .map_err(|e| format!("Export finish worker failed: {}", e))?
}

#[tauri::command]
pub fn ffmpeg_cancel_export(session_id: String) -> Result<(), String> {
    if let Some(session) = with_sessions(|map| map.remove(&session_id)) {
        session
            .cancelled
            .store(true, std::sync::atomic::Ordering::Relaxed);
        if let Ok(mut child_guard) = session.child.lock() {
            if let Some(mut child) = child_guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        if let Ok(mut pipe_guard) = session.pipe.lock() {
            pipe_guard.stdin.take();
            pipe_guard.frame_canvas = Vec::new();
            pipe_guard.staging_frame = Vec::new();
            pipe_guard.blank_frame = None;
            pipe_guard.last_frame = None;
        }
        if let Ok(temps) = session.temp_files.lock() {
            for temp_path in temps.iter() {
                let p = Path::new(temp_path);
                if p.is_dir() {
                    let _ = fs::remove_dir_all(p);
                } else if p.exists() {
                    let _ = fs::remove_file(p);
                }
            }
        }
        if Path::new(&session.output_path).exists() {
            let _ = fs::remove_file(&session.output_path);
        }
    }
    Ok(())
}

pub fn parse_ffmpeg_progress_line(
    line: &str,
    state: &mut (u64, u64, f32),
) -> bool {
    let trimmed = line.trim();
    if let Some((key, val)) = trimmed.split_once('=') {
        match key.trim() {
            "frame" => {
                if let Ok(v) = val.trim().parse::<u64>() {
                    state.0 = v;
                }
            }
            "fps" => {
                if let Ok(v) = val.trim().parse::<f32>() {
                    state.2 = v;
                }
            }
            "out_time_us" => {
                if let Ok(v) = val.trim().parse::<u64>() {
                    state.1 = v;
                }
            }
            "out_time_ms" => {
                if let Ok(v) = val.trim().parse::<u64>() {
                    // FFmpeg out_time_ms is historically microseconds in -progress pipe:1
                    state.1 = v;
                }
            }
            "progress" => {
                return true;
            }
            _ => {}
        }
    }
    false
}

#[tauri::command]
pub async fn ffmpeg_export_ass_burnin(
    app: tauri::AppHandle,
    session_id: Option<String>,
    video_input: String,
    ass_path: String,
    output_path: String,
    encoder: Option<String>,
    duration_secs: Option<f64>,
    fps: Option<u32>,
    fonts_dir: Option<String>,
    font_family: Option<String>,
) -> Result<ExportResult, String> {
    let ffmpeg_bin = find_ffmpeg().ok_or_else(|| "FFmpeg binary not found on system".to_string())?;
    let sid = session_id.unwrap_or_else(|| format!("burnin_{}", Instant::now().elapsed().as_nanos()));
    let enc = encoder.unwrap_or_else(|| "libx264".to_string());
    let target_fps = fps.unwrap_or(60).max(1);
    let total_duration = duration_secs.unwrap_or(1.0).max(0.1);
    let total_frames = (total_duration * (target_fps as f64)).round().max(1.0) as u64;

    let mut staged_font_dir_to_clean: Option<PathBuf> = None;
    let effective_fonts_dir = if fonts_dir.is_some() {
        fonts_dir
    } else if let Some(ref fam) = font_family {
        if let Some((staged_dir, _)) = crate::commands::fonts::stage_font_dir_for_burnin(fam, &sid) {
            let dir_str = staged_dir.to_string_lossy().to_string();
            staged_font_dir_to_clean = Some(staged_dir);
            Some(dir_str)
        } else {
            None
        }
    } else {
        None
    };

    let vf_arg = build_ass_burnin_filter(&ass_path, effective_fonts_dir.as_deref());

    let mut cmd = Command::new(&ffmpeg_bin);
    hide_console_window(&mut cmd);
    cmd.args([
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-progress",
        "pipe:1",
        "-nostats",
        "-i",
        &video_input,
        "-vf",
        &vf_arg,
    ]);

    match enc.as_str() {
        "h264_nvenc" => {
            cmd.args([
                "-c:v",
                "h264_nvenc",
                "-pix_fmt",
                "yuv420p",
                "-preset",
                "p2",
                "-tune",
                "hq",
                "-rc",
                "vbr",
                "-cq",
                "22",
                "-b:v",
                "0",
            ]);
        }
        "h264_qsv" => {
            cmd.args(["-c:v", "h264_qsv", "-pix_fmt", "yuv420p", "-global_quality", "22"]);
        }
        "h264_amf" => {
            cmd.args(["-c:v", "h264_amf", "-pix_fmt", "yuv420p", "-quality", "speed"]);
        }
        _ => {
            cmd.args(["-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "22"]);
        }
    }

    cmd.args(["-c:a", "copy", &output_path]);
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    tauri::async_runtime::spawn_blocking(move || {
        let start = Instant::now();
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn FFmpeg burn-in: {}", e))?;

        let stdout = child.stdout.take();
        let stderr_log = spawn_stderr_drain(child.stderr.take());

        let mut tracked_temps = vec![ass_path.clone()];
        if let Some(ref sdir) = staged_font_dir_to_clean {
            tracked_temps.push(sdir.to_string_lossy().to_string());
        }

        let session = Arc::new(ActiveExportSession {
            child: Mutex::new(Some(child)),
            pipe: Mutex::new(PipeWriterState {
                stdin: None,
                needs_roi_pad: false,
                roi_byte_offset: 0,
                roi_byte_len: 0,
                frame_canvas: Vec::new(),
                staging_frame: Vec::new(),
                blank_frame: None,
                last_frame: None,
                total_frames,
                frames_written: 0,
                start_time: start,
            }),
            output_path: output_path.clone(),
            stderr_log: Arc::clone(&stderr_log),
            temp_files: Mutex::new(tracked_temps),
            cancelled: std::sync::atomic::AtomicBool::new(false),
        });

        with_sessions(|map| {
            map.insert(sid.clone(), Arc::clone(&session));
        });

        let _ = app.emit(
            "ffmpeg-burnin-progress",
            ExportProgress {
                session_id: sid.clone(),
                frames_written: 0,
                total_frames,
                percentage: 0.0,
                fps: 0.0,
            },
        );

        if let Some(out_stream) = stdout {
            let reader = BufReader::new(out_stream);
            let mut pstate = (0u64, 0u64, 0.0f32);
            for line_res in reader.lines() {
                if session.cancelled.load(std::sync::atomic::Ordering::Relaxed) {
                    break;
                }
                match line_res {
                    Ok(line) => {
                        if parse_ffmpeg_progress_line(&line, &mut pstate) {
                            let elapsed_sec = start.elapsed().as_secs_f32().max(0.001);
                            let out_secs = (pstate.1 as f64) / 1_000_000.0;
                            let pct = ((out_secs / total_duration) * 100.0).clamp(0.0, 99.9) as f32;
                            let written = if pstate.0 > 0 {
                                pstate.0.min(total_frames)
                            } else {
                                ((out_secs * (target_fps as f64)).round() as u64).min(total_frames)
                            };
                            let fps_val = if pstate.2 > 0.0 {
                                pstate.2
                            } else {
                                (written as f32) / elapsed_sec
                            };
                            let _ = app.emit(
                                "ffmpeg-burnin-progress",
                                ExportProgress {
                                    session_id: sid.clone(),
                                    frames_written: written,
                                    total_frames,
                                    percentage: pct,
                                    fps: fps_val,
                                },
                            );
                        }
                    }
                    Err(_) => break,
                }
            }
        }

        with_sessions(|map| map.remove(&sid));
        if let Ok(temps) = session.temp_files.lock() {
            for temp_path in temps.iter() {
                let p = Path::new(temp_path);
                if p.is_dir() {
                    let _ = fs::remove_dir_all(p);
                } else if p.exists() {
                    let _ = fs::remove_file(p);
                }
            }
        }

        if session.cancelled.load(std::sync::atomic::Ordering::Relaxed) {
            return Ok(ExportResult {
                success: false,
                output_path,
                file_size_bytes: 0,
                elapsed_seconds: start.elapsed().as_secs_f64(),
                error_message: Some("Export was cancelled by user".to_string()),
            });
        }

        let maybe_child = session
            .child
            .lock()
            .ok()
            .and_then(|mut g| g.take());

        let status_ok = if let Some(mut c) = maybe_child {
            c.wait()
                .map(|s| s.success())
                .map_err(|e| format!("Failed waiting for FFmpeg burn-in: {}", e))?
        } else {
            false
        };

        std::thread::sleep(Duration::from_millis(25));
        let elapsed = start.elapsed().as_secs_f64();

        if status_ok {
            let file_size = fs::metadata(&output_path).map(|m| m.len()).unwrap_or(0);
            let _ = app.emit(
                "ffmpeg-burnin-progress",
                ExportProgress {
                    session_id: sid,
                    frames_written: total_frames,
                    total_frames,
                    percentage: 100.0,
                    fps: (total_frames as f32) / (elapsed as f32).max(0.001),
                },
            );
            Ok(ExportResult {
                success: true,
                output_path,
                file_size_bytes: file_size,
                elapsed_seconds: elapsed,
                error_message: None,
            })
        } else {
            let err_text = stderr_log
                .lock()
                .map(|s| s.trim().to_string())
                .unwrap_or_default();
            Ok(ExportResult {
                success: false,
                output_path,
                file_size_bytes: 0,
                elapsed_seconds: elapsed,
                error_message: Some(if err_text.is_empty() {
                    "FFmpeg ASS burn-in exited with non-zero status".to_string()
                } else {
                    err_text
                }),
            })
        }
    })
    .await
    .map_err(|e| format!("ASS burn-in worker thread failed: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_ffmpeg() {
        let bin = find_ffmpeg();
        assert!(bin.is_some(), "FFmpeg should be detected on host system");
    }

    #[test]
    fn test_ffmpeg_check_binary() {
        let info = ffmpeg_check_binary().expect("Check binary should not error");
        assert!(info.found);
        assert!(!info.version.is_empty());
    }

    #[test]
    fn test_probe_hardware_capabilities() {
        let caps = probe_hardware_capabilities().expect("Hardware probe should succeed");
        assert!(caps.ffmpeg_found);
        assert!(!caps.primary_encoder.is_empty());
        assert!(!caps.available_encoders.is_empty());
    }

    #[test]
    fn test_build_ass_burnin_filter_escapes_windows_paths() {
        let vf = build_ass_burnin_filter(
            "F:\\Videos\\My 'Song'\\test.burnin.ass",
            Some("C:\\Users\\Test\\Fonts"),
        );
        assert_eq!(
            vf,
            "ass='F\\:/Videos/My \\'Song\\'/test.burnin.ass':fontsdir='C\\:/Users/Test/Fonts'"
        );

        let vf_no_fonts = build_ass_burnin_filter("D:\\out.ass", None);
        assert_eq!(vf_no_fonts, "ass='D\\:/out.ass'");
    }

    #[test]
    fn test_parse_ffmpeg_progress_line() {
        let mut state = (0u64, 0u64, 0.0f32);
        assert!(!parse_ffmpeg_progress_line("frame=125", &mut state));
        assert!(!parse_ffmpeg_progress_line("fps=142.50", &mut state));
        assert!(!parse_ffmpeg_progress_line("out_time_us=2083333", &mut state));
        assert!(parse_ffmpeg_progress_line("progress=continue", &mut state));
        assert_eq!(state.0, 125);
        assert_eq!(state.1, 2083333);
        assert!((state.2 - 142.5).abs() < 0.01);
    }
}

