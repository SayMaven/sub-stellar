use regex::Regex;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YouTubeFormat {
    pub format_id: String,
    pub resolution: String,
    pub filesize_approx: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YouTubeMetadata {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub duration_seconds: f64,
    pub thumbnail_url: String,
    pub formats: Vec<YouTubeFormat>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YtDlpStatus {
    pub available: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OEmbedResponse {
    title: String,
    author_name: String,
    thumbnail_url: Option<String>,
}

pub fn extract_video_id(url: &str) -> Result<String, String> {
    let re = Regex::new(r"^https?://(www\.)?(youtube\.com/(watch\?v=|shorts/)|youtu\.be/)([a-zA-Z0-9_-]{11})")
        .map_err(|e| format!("Regex compilation failed: {e}"))?;

    if let Some(captures) = re.captures(url) {
        if let Some(id_match) = captures.get(4) {
            return Ok(id_match.as_str().to_string());
        }
    }

    Err("Invalid YouTube URL. Must be in youtube.com/watch?v=, youtu.be/, or youtube.com/shorts/ format.".to_string())
}

#[tauri::command]
pub fn ytdl_check_binary() -> Result<YtDlpStatus, String> {
    let output = Command::new("yt-dlp")
        .arg("--version")
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
            Ok(YtDlpStatus {
                available: true,
                path: Some("yt-dlp".to_string()),
                version: Some(ver),
            })
        }
        _ => Ok(YtDlpStatus {
            available: false,
            path: None,
            version: None,
        }),
    }
}

#[tauri::command]
pub async fn ytdl_get_info(url: String) -> Result<YouTubeMetadata, String> {
    let video_id = extract_video_id(&url)?;

    // 1. Try native yt-dlp binary if installed on system
    let status = ytdl_check_binary().unwrap_or(YtDlpStatus {
        available: false,
        path: None,
        version: None,
    });

    if status.available {
        let output = Command::new("yt-dlp")
            .args(["--dump-json", "--no-warnings", "--skip-download", &url])
            .output();

        if let Ok(out) = output {
            if out.status.success() {
                if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&out.stdout) {
                    let title = json["title"].as_str().unwrap_or("Unknown Title").to_string();
                    let channel = json["uploader"]
                        .as_str()
                        .or_else(|| json["channel"].as_str())
                        .unwrap_or("Unknown Artist")
                        .to_string();
                    let duration = json["duration"].as_f64().unwrap_or(180.0);
                    let thumbnail = json["thumbnail"]
                        .as_str()
                        .unwrap_or(&format!("https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"))
                        .to_string();

                    return Ok(YouTubeMetadata {
                        id: video_id,
                        title,
                        channel,
                        duration_seconds: duration,
                        thumbnail_url: thumbnail,
                        formats: build_formats(&json),
                    });
                }
            }
        }
    }

    // 2. High-speed fallback: Query official YouTube oEmbed API via reqwest
    let oembed_url = format!(
        "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| format!("Failed to create client: {e}"))?;

    let res = client
        .get(&oembed_url)
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        )
        .send()
        .await
        .map_err(|e| format!("Network request to YouTube oEmbed failed: {e}"))?;

    if res.status().is_success() {
        let oembed: OEmbedResponse = res
            .json()
            .await
            .map_err(|e| format!("Failed to parse oEmbed JSON: {e}"))?;

        let thumbnail = oembed.thumbnail_url.unwrap_or_else(|| {
            format!("https://i.ytimg.com/vi/{video_id}/hqdefault.jpg")
        });

        return Ok(YouTubeMetadata {
            id: video_id,
            title: oembed.title,
            channel: oembed.author_name,
            duration_seconds: 215.0, // Default duration placeholder for oEmbed
            thumbnail_url: thumbnail,
            formats: vec![
                YouTubeFormat {
                    format_id: "preview".to_string(),
                    resolution: "Stream Preview".to_string(),
                    filesize_approx: 0,
                },
            ],
        });
    }

    // 3. Resilient fallback when offline or oembed blocked
    Ok(YouTubeMetadata {
        id: video_id.clone(),
        title: format!("YouTube Track ({video_id})"),
        channel: "YouTube Artist".to_string(),
        duration_seconds: 180.0,
        thumbnail_url: format!("https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"),
        formats: vec![],
    })
}

/// Builds the selectable format list from yt-dlp JSON: one entry per available video height
/// (descending) plus an audio-only entry. IDs are symbolic ("h1080", "audio") and are
/// translated to a yt-dlp selector in Rust, so the frontend never supplies raw selector text.
fn build_formats(json: &serde_json::Value) -> Vec<YouTubeFormat> {
    use std::collections::BTreeMap;

    let empty = Vec::new();
    let formats = json["formats"].as_array().unwrap_or(&empty);

    let size_of = |f: &serde_json::Value| -> u64 {
        f["filesize"]
            .as_u64()
            .or_else(|| f["filesize_approx"].as_u64())
            .unwrap_or(0)
    };

    let mut best_audio: u64 = 0;
    let mut by_height: BTreeMap<u32, u64> = BTreeMap::new();

    for f in formats {
        let vcodec = f["vcodec"].as_str().unwrap_or("none");
        let acodec = f["acodec"].as_str().unwrap_or("none");
        if vcodec == "none" && acodec != "none" {
            best_audio = best_audio.max(size_of(f));
        } else if vcodec != "none" {
            if let Some(h) = f["height"].as_u64() {
                let entry = by_height.entry(h as u32).or_insert(0);
                *entry = (*entry).max(size_of(f));
            }
        }
    }

    let mut out: Vec<YouTubeFormat> = by_height
        .iter()
        .rev()
        .filter(|(h, _)| **h >= 144)
        .map(|(h, size)| YouTubeFormat {
            format_id: format!("h{h}"),
            resolution: format!("{h}p"),
            filesize_approx: size + best_audio,
        })
        .collect();

    out.push(YouTubeFormat {
        format_id: "audio".to_string(),
        resolution: "audio-only".to_string(),
        filesize_approx: best_audio,
    });
    out
}

/// Translates a symbolic format id into a yt-dlp `-f` selector. Prefers H.264/AAC (MP4) so the
/// WebView2 `<video>` element can decode it; falls back to any codec at that height.
fn selector_for(format_id: &str) -> Result<(String, &'static str), String> {
    if format_id == "audio" {
        return Ok(("bestaudio[ext=m4a]/bestaudio".to_string(), "audio"));
    }
    let re = Regex::new(r"^h(\d{3,4})$").map_err(|e| format!("Regex failed: {e}"))?;
    let caps = re
        .captures(format_id)
        .ok_or_else(|| format!("Unsupported format id: {format_id}"))?;
    let h = &caps[1];
    Ok((
        format!(
            "bv*[height<={h}][vcodec^=avc1]+ba[ext=m4a]/bv*[height<={h}]+ba/b[height<={h}]"
        ),
        "video",
    ))
}

#[tauri::command]
pub async fn ytdl_download_media(
    app: tauri::AppHandle,
    url: String,
    format_id: String,
    _target_type: String,
) -> Result<String, String> {
    use tauri::Manager;

    let video_id = extract_video_id(&url)?;
    let (selector, kind) = selector_for(&format_id)?;

    let status = ytdl_check_binary().unwrap_or(YtDlpStatus {
        available: false,
        path: None,
        version: None,
    });
    if !status.available {
        return Err(
            "yt-dlp was not found on your system PATH. Install yt-dlp (and ffmpeg for video merging) to download media.".to_string(),
        );
    }

    // Downloads live in the app cache dir, which is the only scope exposed to the asset protocol.
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Cannot resolve cache directory: {e}"))?
        .join("media");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create cache directory: {e}"))?;

    let template = dir.join(format!("{video_id}_{format_id}.%(ext)s"));
    // Canonical URL rebuilt from the validated ID; args are passed as an array (no shell).
    let canonical = format!("https://www.youtube.com/watch?v={video_id}");

    let mut args: Vec<String> = vec![
        "--no-playlist".into(),
        "--no-warnings".into(),
        "-f".into(),
        selector,
        "-o".into(),
        template.to_string_lossy().to_string(),
        "--print".into(),
        "after_move:filepath".into(),
        "--no-simulate".into(),
    ];
    if kind == "video" {
        args.push("--merge-output-format".into());
        args.push("mp4".into());
    }
    args.push("--".into());
    args.push(canonical);

    let output = tauri::async_runtime::spawn_blocking(move || Command::new("yt-dlp").args(&args).output())
        .await
        .map_err(|e| format!("Download task failed: {e}"))?
        .map_err(|e| format!("Failed to launch yt-dlp: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let last = stderr.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("unknown error");
        return Err(format!("yt-dlp failed: {last}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let path = stdout
        .lines()
        .rev()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .ok_or_else(|| "yt-dlp finished but reported no output file".to_string())?;

    if !std::path::Path::new(path).exists() {
        return Err(format!("Downloaded file not found: {path}"));
    }
    Ok(path.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_video_id_standard() {
        let url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
        assert_eq!(extract_video_id(url).unwrap(), "dQw4w9WgXcQ");
    }

    #[test]
    fn test_extract_video_id_short() {
        let url = "https://youtu.be/dQw4w9WgXcQ";
        assert_eq!(extract_video_id(url).unwrap(), "dQw4w9WgXcQ");
    }

    #[test]
    fn test_extract_video_id_shorts() {
        let url = "https://youtube.com/shorts/dQw4w9WgXcQ";
        assert_eq!(extract_video_id(url).unwrap(), "dQw4w9WgXcQ");
    }

    #[test]
    fn test_selector_for_video_and_audio() {
        let (sel, kind) = selector_for("h1080").unwrap();
        assert_eq!(kind, "video");
        assert!(sel.contains("height<=1080"));
        assert_eq!(selector_for("audio").unwrap().1, "audio");
    }

    #[test]
    fn test_selector_rejects_injection() {
        assert!(selector_for("h1080; rm -rf").is_err());
        assert!(selector_for("--exec").is_err());
        assert!(selector_for("bestvideo+bestaudio").is_err());
    }

    #[test]
    fn test_build_formats_sorted_with_audio_last() {
        let json = serde_json::json!({
            "formats": [
                {"vcodec": "avc1", "acodec": "none", "height": 720, "filesize": 1000},
                {"vcodec": "avc1", "acodec": "none", "height": 1080, "filesize": 2000},
                {"vcodec": "none", "acodec": "mp4a", "filesize": 300}
            ]
        });
        let f = build_formats(&json);
        assert_eq!(f[0].format_id, "h1080");
        assert_eq!(f[0].filesize_approx, 2300);
        assert_eq!(f[1].format_id, "h720");
        assert_eq!(f.last().unwrap().format_id, "audio");
    }

    #[test]
    fn test_extract_video_id_invalid() {
        let url = "https://malicious.site/hack?v=123";
        assert!(extract_video_id(url).is_err());
    }
}

