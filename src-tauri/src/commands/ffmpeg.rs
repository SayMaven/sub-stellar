use std::collections::HashMap;
use std::fs;
use std::io::{BufWriter, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use serde::{Deserialize, Serialize};

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
}

#[derive(Debug, Serialize, Deserialize)]
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
    bytes_per_frame: usize,
    total_frames: u64,
    frames_written: u64,
    blank_frame: Option<Vec<u8>>,
    blank_accumulator: Vec<u8>,
    start_time: Instant,
}

struct ActiveExportSession {
    child: Mutex<Option<Child>>,
    pipe: Mutex<PipeWriterState>,
    output_path: String,
    cancelled: std::sync::atomic::AtomicBool,
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

    let mut cmd = Command::new(&ffmpeg_bin);
    hide_console_window(&mut cmd);
    cmd.args(["-y", "-hide_banner", "-loglevel", "error"]);

    // Raw video input from stdin
    cmd.args([
        "-thread_queue_size",
        "64",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-s",
        &format!("{}x{}", config.width, config.height),
        "-r",
        &config.fps.to_string(),
        "-i",
        "-",
    ]);

    // Optional media (video or audio) source input
    let mut is_video_source = false;
    let has_audio = if let Some(ref audio_path) = config.audio_source_path {
        if Path::new(audio_path).exists() {
            cmd.args(["-thread_queue_size", "64", "-i", audio_path]);
            let lower = audio_path.to_lowercase();
            is_video_source = lower.ends_with(".mp4")
                || lower.ends_with(".webm")
                || lower.ends_with(".mkv")
                || lower.ends_with(".mov");
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
            ]);
            if has_audio {
                cmd.args(["-map", "0:v", "-map", "1:a?", "-c:a", "libopus", "-b:a", "128k", "-shortest"]);
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
            ]);
            if has_audio {
                cmd.args(["-map", "0:v", "-map", "1:a?", "-c:a", "pcm_s16le", "-shortest"]);
            }
        }
        _ => {
            // Default: mp4_burnin (Composites RGBA subtitle overlay [0:v] over source video [1:v] when present)
            if is_video_source {
                let filter = format!(
                    "[1:v]scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1[bg];[bg][0:v]overlay=0:0:shortest=1[outv]",
                    w = config.width,
                    h = config.height
                );
                cmd.args(["-filter_complex", &filter, "-map", "[outv]", "-map", "1:a?"]);
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
                        "p4",
                        "-cq",
                        "22",
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
                cmd.args(["-c:a", "aac", "-b:a", &ab, "-shortest"]);
            }
        }
    }

    cmd.arg(&config.output_path);
    cmd.stdin(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;
    let stdin = child.stdin.take().ok_or_else(|| "Failed to open FFmpeg stdin".to_string())?;
    let bytes_per_frame = (config.width as usize).saturating_mul(config.height as usize).saturating_mul(4);

    let session_id = config.session_id.clone();
    let session = Arc::new(ActiveExportSession {
        child: Mutex::new(Some(child)),
        pipe: Mutex::new(PipeWriterState {
            stdin: Some(BufWriter::with_capacity(1024 * 1024, stdin)),
            bytes_per_frame,
            total_frames: config.total_frames,
            frames_written: 0,
            blank_frame: None,
            blank_accumulator: Vec::new(),
            start_time: Instant::now(),
        }),
        output_path: config.output_path,
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
        tauri::ipc::InvokeBody::Json(_) if use_blank => Vec::new(),
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

        let bytes_per_frame = pipe.bytes_per_frame;

        if use_blank {
            let state = &mut *pipe;
            let frames_to_write = state.total_frames.saturating_sub(state.frames_written).min(repeat_count);
            let blank = state
                .blank_frame
                .as_deref()
                .ok_or_else(|| "Blank frame cache not initialized".to_string())?;
            let stdin = state
                .stdin
                .as_mut()
                .ok_or_else(|| "Stdin already closed".to_string())?;
            for _ in 0..frames_to_write {
                stdin
                    .write_all(blank)
                    .map_err(|e| format!("Failed to write cached blank frame to FFmpeg: {}", e))?;
            }
            state.frames_written += frames_to_write;
        } else {
            if cache_blank {
                if pipe.blank_accumulator.is_empty() && bytes_per_frame > 0 {
                    pipe.blank_accumulator.reserve(bytes_per_frame);
                }
                pipe.blank_accumulator.extend_from_slice(&chunk_bytes);
                if commit_frame {
                    let cached = std::mem::take(&mut pipe.blank_accumulator);
                    pipe.blank_frame = Some(cached);
                }
            }

            let stdin = pipe
                .stdin
                .as_mut()
                .ok_or_else(|| "Stdin already closed".to_string())?;
            stdin
                .write_all(&chunk_bytes)
                .map_err(|e| format!("Failed to write raw frame to FFmpeg: {}", e))?;

            if commit_frame {
                pipe.frames_written += 1;
            }
        }

        let elapsed = pipe.start_time.elapsed().as_secs_f32().max(0.001);
        let fps = pipe.frames_written as f32 / elapsed;
        let percentage = if pipe.total_frames > 0 {
            (pipe.frames_written as f32 / pipe.total_frames as f32 * 100.0).min(100.0)
        } else {
            0.0
        };

        Ok(ExportProgress {
            session_id,
            frames_written: pipe.frames_written,
            total_frames: pipe.total_frames,
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
            pipe.start_time.elapsed().as_secs_f64()
        };

        let child = session
            .child
            .lock()
            .map_err(|_| "Export child lock poisoned".to_string())?
            .take()
            .ok_or_else(|| "FFmpeg process already finalized".to_string())?;

        let output = child
            .wait_with_output()
            .map_err(|e| format!("Failed to wait for FFmpeg: {}", e))?;

        if output.status.success() {
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
            let err_text = String::from_utf8_lossy(&output.stderr).to_string();
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
            }
        }
        if let Ok(mut pipe_guard) = session.pipe.lock() {
            pipe_guard.stdin.take();
        }
        if Path::new(&session.output_path).exists() {
            let _ = fs::remove_file(&session.output_path);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn ffmpeg_export_ass_burnin(
    video_input: String,
    ass_path: String,
    output_path: String,
    encoder: Option<String>,
) -> Result<ExportResult, String> {
    let ffmpeg_bin = find_ffmpeg().ok_or_else(|| "FFmpeg binary not found on system".to_string())?;

    let start = Instant::now();
    let enc = encoder.unwrap_or_else(|| "libx264".to_string());

    // Normalize Windows path for FFmpeg subtitles filter: replace backslash with forward slash and escape colons
    let normalized_ass = ass_path.replace('\\', "/").replace(':', "\\:");
    let vf_arg = format!("subtitles='{}'", normalized_ass);

    let mut cmd = Command::new(&ffmpeg_bin);
    hide_console_window(&mut cmd);
    cmd.args(["-y", "-hide_banner", "-i", &video_input, "-vf", &vf_arg]);

    match enc.as_str() {
        "h264_nvenc" => {
            cmd.args(["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "22"]);
        }
        "h264_qsv" => {
            cmd.args(["-c:v", "h264_qsv", "-global_quality", "22"]);
        }
        "h264_amf" => {
            cmd.args(["-c:v", "h264_amf", "-quality", "speed"]);
        }
        _ => {
            cmd.args(["-c:v", "libx264", "-preset", "veryfast", "-crf", "22"]);
        }
    }

    cmd.args(["-c:a", "copy", &output_path]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute FFmpeg burn-in: {}", e))?;

    let elapsed = start.elapsed().as_secs_f64();

    if output.status.success() {
        let file_size = fs::metadata(&output_path).map(|m| m.len()).unwrap_or(0);
        Ok(ExportResult {
            success: true,
            output_path,
            file_size_bytes: file_size,
            elapsed_seconds: elapsed,
            error_message: None,
        })
    } else {
        let err_text = String::from_utf8_lossy(&output.stderr).to_string();
        Ok(ExportResult {
            success: false,
            output_path,
            file_size_bytes: 0,
            elapsed_seconds: elapsed,
            error_message: Some(err_text),
        })
    }
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
}

