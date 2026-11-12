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

#[derive(Debug, Clone, Copy)]
pub struct CoarseAudioBlock {
    pub min: f32,
    pub max: f32,
    pub rms: f32,
    pub count: usize,
}

#[cfg(windows)]
fn apply_no_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn apply_no_window(_cmd: &mut Command) {}

/// Downsamples coarse audio blocks using an RMS + average-peak dynamic envelope
/// so mastered tracks show clear verse/chorus dynamics instead of flat ±1.0 brick walls.
pub fn downsample_coarse_blocks(blocks: &[CoarseAudioBlock], target_bins: usize) -> Vec<f32> {
    let bins = target_bins.max(1);
    let mut peaks = vec![0.0f32; bins * 2];
    if blocks.is_empty() {
        return peaks;
    }

    let total_blocks = blocks.len();
    let mut raw_envelopes = vec![0.0f32; bins];
    let mut max_envelope = 0.0f32;

    for b in 0..bins {
        let start = (b * total_blocks) / bins;
        let end = (((b + 1) * total_blocks) / bins).max(start + 1).min(total_blocks);

        let mut weighted_sq_sum = 0.0f64;
        let mut total_samples = 0usize;
        let mut peak_sum = 0.0f64;
        let mut block_count = 0usize;

        for blk in &blocks[start..end] {
            if blk.count == 0 {
                continue;
            }
            let r = blk.rms as f64;
            weighted_sq_sum += r * r * (blk.count as f64);
            total_samples += blk.count;
            let half_span = ((blk.max - blk.min) * 0.5).max(0.0) as f64;
            peak_sum += half_span;
            block_count += 1;
        }

        if total_samples > 0 && block_count > 0 {
            let bin_rms = (weighted_sq_sum / total_samples as f64).sqrt() as f32;
            let avg_peak = (peak_sum / block_count as f64) as f32;
            // 72% RMS energy + 28% averaged transient peak preserves musical dynamics
            let env = (0.72 * bin_rms + 0.28 * avg_peak).clamp(0.0, 1.0);
            raw_envelopes[b] = env;
            if env > max_envelope {
                max_envelope = env;
            }
        }
    }

    // Gentle auto-normalization: keeps quiet acoustic tracks readable without clipping loud tracks
    let gain = if max_envelope > 0.05 {
        (0.92 / max_envelope).min(2.5)
    } else {
        1.0
    };

    for (b, env) in raw_envelopes.into_iter().enumerate() {
        let amp = (env * gain).clamp(0.0, 0.96);
        peaks[b * 2] = -amp;
        peaks[b * 2 + 1] = amp;
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
    let mut coarse_blocks: Vec<CoarseAudioBlock> = Vec::new();
    let mut cur_min = 1.0f32;
    let mut cur_max = -1.0f32;
    let mut cur_sq_sum = 0.0f64;
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
            cur_sq_sum += (mono as f64) * (mono as f64);
            cur_count += 1;

            if cur_count >= COARSE_BLOCK_SAMPLES {
                let rms = (cur_sq_sum / cur_count as f64).sqrt() as f32;
                coarse_blocks.push(CoarseAudioBlock {
                    min: cur_min,
                    max: cur_max,
                    rms,
                    count: cur_count,
                });
                cur_min = 1.0;
                cur_max = -1.0;
                cur_sq_sum = 0.0;
                cur_count = 0;
            }
        }
    }

    if cur_count > 0 && cur_min <= cur_max {
        let rms = (cur_sq_sum / cur_count as f64).sqrt() as f32;
        coarse_blocks.push(CoarseAudioBlock {
            min: cur_min,
            max: cur_max,
            rms,
            count: cur_count,
        });
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

    let mut coarse_blocks: Vec<CoarseAudioBlock> = Vec::new();
    let mut cur_min = 1.0f32;
    let mut cur_max = -1.0f32;
    let mut cur_sq_sum = 0.0f64;
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
                    cur_sq_sum += (val as f64) * (val as f64);
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
                cur_sq_sum += (val as f64) * (val as f64);
            }
            cur_count += 1;
            if cur_count >= block_samples {
                let rms = (cur_sq_sum / cur_count as f64).sqrt() as f32;
                coarse_blocks.push(CoarseAudioBlock {
                    min: cur_min,
                    max: cur_max,
                    rms,
                    count: cur_count,
                });
                cur_min = 1.0;
                cur_max = -1.0;
                cur_sq_sum = 0.0;
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
        let rms = (cur_sq_sum / cur_count as f64).sqrt() as f32;
        coarse_blocks.push(CoarseAudioBlock {
            min: cur_min,
            max: cur_max,
            rms,
            count: cur_count,
        });
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
    fn test_downsample_coarse_blocks_preserves_dynamics() {
        let quiet = CoarseAudioBlock {
            min: -0.2,
            max: 0.2,
            rms: 0.08,
            count: 2048,
        };
        let loud = CoarseAudioBlock {
            min: -0.95,
            max: 0.95,
            rms: 0.45,
            count: 2048,
        };
        let peaks = downsample_coarse_blocks(&[quiet, loud], 2);
        assert_eq!(peaks.len(), 4);
        // Quiet bin should be noticeably smaller than loud bin
        assert!(peaks[1] < peaks[3]);
        assert!(peaks[3] <= 0.96);
        assert!((peaks[0] + peaks[1]).abs() < 1e-5);
    }

    #[test]
    fn test_downsample_empty_blocks() {
        let peaks = downsample_coarse_blocks(&[], 10);
        assert_eq!(peaks.len(), 20);
        assert!(peaks.iter().all(|&v| v == 0.0));
    }
}
