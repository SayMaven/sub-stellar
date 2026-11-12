use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

const COARSE_BLOCK_SAMPLES: usize = 2048;

#[cfg(windows)]
fn apply_no_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn apply_no_window(_cmd: &mut Command) {}

/// Downsamples coarse `(min, max)` blocks into exact `target_bins * 2` interleaved `[min, max, ...]` f32 values.
pub fn downsample_coarse_blocks(blocks: &[(f32, f32)], target_bins: usize) -> Vec<f32> {
    let bins = target_bins.max(1);
    let mut peaks = vec![0.0f32; bins * 2];
    if blocks.is_empty() {
        return peaks;
    }

    let total_blocks = blocks.len();
    for b in 0..bins {
        let start = (b * total_blocks) / bins;
        let end = (((b + 1) * total_blocks) / bins).max(start + 1).min(total_blocks);

        let mut min_v = 1.0f32;
        let mut max_v = -1.0f32;
        for &(b_min, b_max) in &blocks[start..end] {
            if b_min < min_v {
                min_v = b_min;
            }
            if b_max > max_v {
                max_v = b_max;
            }
        }
        if min_v > max_v {
            min_v = 0.0;
            max_v = 0.0;
        }
        peaks[b * 2] = min_v.clamp(-1.0, 1.0);
        peaks[b * 2 + 1] = max_v.clamp(-1.0, 1.0);
    }
    peaks
}

fn extract_via_symphonia(path: &Path, target_bins: usize) -> Result<Vec<f32>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open audio file: {}", e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| format!("Symphonia probe failed: {}", e))?;

    let mut format = probed.format;
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| "No supported audio track found".to_string())?;

    let track_id = track.id;
    let channels = track
        .codec_params
        .channels
        .map(|c| c.count())
        .unwrap_or(1)
        .max(1);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Symphonia decoder init failed: {}", e))?;

    let mut sample_buf: Option<SampleBuffer<f32>> = None;
    let mut coarse_blocks: Vec<(f32, f32)> = Vec::new();
    let mut cur_min = 1.0f32;
    let mut cur_max = -1.0f32;
    let mut cur_count = 0usize;

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(SymphoniaError::IoError(err))
                if err.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(SymphoniaError::ResetRequired) => {
                decoder.reset();
                continue;
            }
            Err(_) => break,
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(_) => break,
        };

        let spec = *decoded.spec();
        let duration = decoded.capacity() as u64;
        let buf = sample_buf.get_or_insert_with(|| SampleBuffer::<f32>::new(duration, spec));
        if buf.capacity() < decoded.frames() * spec.channels.count() {
            *buf = SampleBuffer::<f32>::new(duration, spec);
        }
        buf.copy_interleaved_ref(decoded);

        let samples = buf.samples();
        let ch = spec.channels.count().max(channels);
        for frame in samples.chunks(ch) {
            let mut sum = 0.0f32;
            for &s in frame {
                sum += s;
            }
            let mono = sum / (frame.len().max(1) as f32);
            if mono < cur_min {
                cur_min = mono;
            }
            if mono > cur_max {
                cur_max = mono;
            }
            cur_count += 1;

            if cur_count >= COARSE_BLOCK_SAMPLES {
                coarse_blocks.push((cur_min, cur_max));
                cur_min = 1.0;
                cur_max = -1.0;
                cur_count = 0;
            }
        }
    }

    if cur_count > 0 && cur_min <= cur_max {
        coarse_blocks.push((cur_min, cur_max));
    }

    if coarse_blocks.is_empty() {
        return Err("No audio samples decoded".to_string());
    }

    Ok(downsample_coarse_blocks(&coarse_blocks, target_bins))
}

fn extract_via_ffmpeg(path: &Path, target_bins: usize) -> Result<Vec<f32>, String> {
    let mut cmd = Command::new("ffmpeg");
    apply_no_window(&mut cmd);
    cmd.args([
        "-v",
        "error",
        "-i",
        path.to_str().ok_or("Invalid file path")?,
        "-vn",
        "-ac",
        "1",
        "-f",
        "f32le",
        "-ar",
        "8000",
        "pipe:1",
    ])
    .stdout(Stdio::piped())
    .stderr(Stdio::null());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg for audio peaks: {}", e))?;

    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture ffmpeg stdout".to_string())?;

    // Stream 8000Hz f32le samples in small 16KB chunks (4096 floats) — zero large allocations.
    let mut buf = [0u8; 16384];
    let mut leftover = [0u8; 4];
    let mut leftover_len = 0usize;

    let mut coarse_blocks: Vec<(f32, f32)> = Vec::new();
    let mut cur_min = 1.0f32;
    let mut cur_max = -1.0f32;
    let mut cur_count = 0usize;
    let block_samples = 256usize; // at 8kHz, 256 samples = 32ms per coarse block

    loop {
        let n = stdout
            .read(&mut buf)
            .map_err(|e| format!("Error reading ffmpeg audio stream: {}", e))?;
        if n == 0 {
            break;
        }

        let mut offset = 0usize;
        if leftover_len > 0 {
            let need = 4 - leftover_len;
            if n >= need {
                leftover[leftover_len..4].copy_from_slice(&buf[..need]);
                let val = f32::from_le_bytes(leftover);
                if val.is_finite() {
                    cur_min = cur_min.min(val);
                    cur_max = cur_max.max(val);
                }
                cur_count += 1;
                offset = need;
                leftover_len = 0;
            } else {
                leftover[leftover_len..leftover_len + n].copy_from_slice(&buf[..n]);
                leftover_len += n;
                continue;
            }
        }

        while offset + 4 <= n {
            let val = f32::from_le_bytes([
                buf[offset],
                buf[offset + 1],
                buf[offset + 2],
                buf[offset + 3],
            ]);
            offset += 4;
            if val.is_finite() {
                cur_min = cur_min.min(val);
                cur_max = cur_max.max(val);
            }
            cur_count += 1;
            if cur_count >= block_samples {
                coarse_blocks.push((cur_min, cur_max));
                cur_min = 1.0;
                cur_max = -1.0;
                cur_count = 0;
            }
        }

        if offset < n {
            let rem = n - offset;
            leftover[..rem].copy_from_slice(&buf[offset..n]);
            leftover_len = rem;
        }
    }

    if cur_count > 0 && cur_min <= cur_max {
        coarse_blocks.push((cur_min, cur_max));
    }

    let _ = child.wait();

    if coarse_blocks.is_empty() {
        return Err("FFmpeg produced no audio samples".to_string());
    }

    Ok(downsample_coarse_blocks(&coarse_blocks, target_bins))
}

#[tauri::command]
pub async fn extract_audio_peaks(
    file_path: String,
    target_bins: Option<usize>,
) -> Result<Vec<f32>, String> {
    let bins = target_bins.unwrap_or(1000).clamp(64, 4096);
    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&file_path);
        if !path.exists() {
            return Err(format!("Audio source file does not exist: {}", file_path));
        }
        extract_via_symphonia(path, bins).or_else(|_| extract_via_ffmpeg(path, bins))
    })
    .await
    .map_err(|e| format!("Audio peak extraction task panicked: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_downsample_coarse_blocks_exact_bins() {
        let blocks = vec![(-0.2, 0.4), (-0.8, 0.9), (-0.1, 0.2), (-0.5, 0.6)];
        let peaks = downsample_coarse_blocks(&blocks, 2);
        assert_eq!(peaks.len(), 4);
        assert!((peaks[0] - (-0.8)).abs() < 1e-5);
        assert!((peaks[1] - 0.9).abs() < 1e-5);
        assert!((peaks[2] - (-0.5)).abs() < 1e-5);
        assert!((peaks[3] - 0.6).abs() < 1e-5);
    }

    #[test]
    fn test_downsample_empty_blocks() {
        let peaks = downsample_coarse_blocks(&[], 10);
        assert_eq!(peaks.len(), 20);
        assert!(peaks.iter().all(|&v| v == 0.0));
    }
}
