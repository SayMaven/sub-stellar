use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{LazyLock, Mutex};

static VIDEO_ID_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^https?://(?:(?:www|m|music)\.)?(?:youtube\.com/(?:watch\?(?:[^#\s]*&)?v=|shorts/|embed/|v/)|youtu\.be/)([a-zA-Z0-9_-]{11})",
    )
    .expect("Valid YouTube video ID regex")
});

static FORMAT_HEIGHT_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^h(\d{3,4})$").expect("Valid format height regex")
});

static SUB_LANG_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-zA-Z0-9._-]{2,24}$").expect("Valid subtitle language code regex")
});

static BRACKET_TAG_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(.*?)\s*\[([a-zA-Z0-9_-]{11})_([a-zA-Z0-9]+)\]$")
        .expect("Valid bracketed cache filename regex")
});

static LEGACY_TAG_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^([a-zA-Z0-9_-]{11})_([a-zA-Z0-9]+)$")
        .expect("Valid legacy cache filename regex")
});

static YTDLP_STATUS_CACHE: LazyLock<Mutex<Option<YtDlpStatus>>> =
    LazyLock::new(|| Mutex::new(None));

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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YouTubeFormat {
    pub format_id: String,
    pub resolution: String,
    pub filesize_approx: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct YouTubeSubtitleTrack {
    pub lang: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YouTubeMetadata {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub duration_seconds: f64,
    pub thumbnail_url: String,
    pub formats: Vec<YouTubeFormat>,
    #[serde(default)]
    pub subtitles: Vec<YouTubeSubtitleTrack>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YtDlpStatus {
    pub available: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CachedMediaItem {
    pub file_name: String,
    pub file_path: String,
    pub video_id: String,
    pub title: String,
    pub channel: String,
    pub thumbnail_url: String,
    pub duration_seconds: f64,
    pub format_id: String,
    pub format_label: String,
    pub size_bytes: u64,
    pub is_audio: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct CachedMediaSidecar {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub duration_seconds: f64,
    pub thumbnail_url: String,
}

#[derive(Debug, Deserialize)]
struct OEmbedResponse {
    title: String,
    author_name: String,
    thumbnail_url: Option<String>,
}

pub fn extract_video_id(url: &str) -> Result<String, String> {
    let trimmed = url.trim();
    if let Some(captures) = VIDEO_ID_RE.captures(trimmed) {
        if let Some(id_match) = captures.get(1) {
            return Ok(id_match.as_str().to_string());
        }
    }

    Err("Invalid YouTube URL. Must be in youtube.com/watch?v=, youtu.be/, or youtube.com/shorts/ format.".to_string())
}

/// Sanitizes a video title so it is safe to use as a Windows/POSIX file name prefix.
pub fn sanitize_filename_title(raw_title: &str) -> String {
    let cleaned: String = raw_title
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => ' ',
            c if c.is_control() => ' ',
            _ => c,
        })
        .collect();

    let collapsed = cleaned
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches(|c: char| c == '.' || c == ' ')
        .to_string();

    if collapsed.is_empty() {
        return "YouTube_Video".to_string();
    }

    collapsed.chars().take(72).collect::<String>().trim().to_string()
}

/// Parses a cached media file stem into `(optional_title, video_id, format_id)`.
pub fn parse_cached_filename_stem(stem: &str) -> (Option<String>, String, String) {
    if let Some(caps) = BRACKET_TAG_RE.captures(stem) {
        let title_part = caps.get(1).map(|m| m.as_str().trim().to_string()).filter(|s| !s.is_empty());
        let vid = caps.get(2).map(|m| m.as_str().to_string()).unwrap_or_default();
        let fmt = caps.get(3).map(|m| m.as_str().to_string()).unwrap_or_default();
        return (title_part, vid, fmt);
    }
    if let Some(caps) = LEGACY_TAG_RE.captures(stem) {
        let vid = caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
        let fmt = caps.get(2).map(|m| m.as_str().to_string()).unwrap_or_default();
        return (None, vid, fmt);
    }
    if let Some(idx) = stem.rfind('_') {
        return (None, stem[..idx].to_string(), stem[idx + 1..].to_string());
    }
    (None, stem.to_string(), String::new())
}

fn save_sidecar_meta(media_dir: &Path, meta: &CachedMediaSidecar) {
    let sidecar_path = media_dir.join(format!("{}.meta.json", meta.id));
    if let Ok(json_str) = serde_json::to_string_pretty(meta) {
        let _ = std::fs::write(sidecar_path, json_str);
    }
}

fn load_sidecar_meta(media_dir: &Path, video_id: &str) -> Option<CachedMediaSidecar> {
    let sidecar_path = media_dir.join(format!("{video_id}.meta.json"));
    let raw = std::fs::read_to_string(sidecar_path).ok()?;
    serde_json::from_str::<CachedMediaSidecar>(&raw).ok()
}

pub fn probe_ytdlp_sync(force_refresh: bool) -> YtDlpStatus {
    if !force_refresh {
        if let Ok(guard) = YTDLP_STATUS_CACHE.lock() {
            if let Some(cached) = guard.as_ref() {
                return cached.clone();
            }
        }
    }

    let mut cmd = Command::new("yt-dlp");
    hide_console_window(&mut cmd);
    let output = cmd.arg("--version").output();

    let status = match output {
        Ok(out) if out.status.success() => {
            let ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
            YtDlpStatus {
                available: true,
                path: Some("yt-dlp".to_string()),
                version: Some(ver),
            }
        }
        _ => YtDlpStatus {
            available: false,
            path: None,
            version: None,
        },
    };

    if let Ok(mut guard) = YTDLP_STATUS_CACHE.lock() {
        *guard = Some(status.clone());
    }
    status
}

#[tauri::command]
pub async fn ytdl_check_binary(force_refresh: Option<bool>) -> Result<YtDlpStatus, String> {
    let refresh = force_refresh.unwrap_or(false);
    if !refresh {
        if let Ok(guard) = YTDLP_STATUS_CACHE.lock() {
            if let Some(cached) = guard.as_ref() {
                return Ok(cached.clone());
            }
        }
    }

    tauri::async_runtime::spawn_blocking(move || probe_ytdlp_sync(refresh))
        .await
        .map_err(|e| format!("Failed to check yt-dlp binary: {e}"))
}

#[tauri::command]
pub async fn ytdl_get_info(
    app: tauri::AppHandle,
    url: String,
) -> Result<YouTubeMetadata, String> {
    use tauri::Manager;

    let video_id = extract_video_id(&url)?;
    let canonical = format!("https://www.youtube.com/watch?v={video_id}");
    let media_dir: Option<PathBuf> = app
        .path()
        .app_cache_dir()
        .ok()
        .map(|d| d.join("media"));

    // 1. Try native yt-dlp binary if installed on system (run in blocking pool to avoid starving async runtime)
    let status = tauri::async_runtime::spawn_blocking(|| probe_ytdlp_sync(false))
        .await
        .unwrap_or(YtDlpStatus {
            available: false,
            path: None,
            version: None,
        });

    if status.available {
        let canonical_for_cmd = canonical.clone();
        let output = tauri::async_runtime::spawn_blocking(move || {
            let mut cmd = Command::new("yt-dlp");
            hide_console_window(&mut cmd);
            cmd.args([
                "--dump-json",
                "--no-warnings",
                "--skip-download",
                "--no-playlist",
                "--",
                &canonical_for_cmd,
            ])
            .output()
        })
        .await
        .ok()
        .and_then(|res| res.ok());

        if let Some(out) = output {
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

                    if let Some(ref dir) = media_dir {
                        let _ = std::fs::create_dir_all(dir);
                        save_sidecar_meta(
                            dir,
                            &CachedMediaSidecar {
                                id: video_id.clone(),
                                title: title.clone(),
                                channel: channel.clone(),
                                duration_seconds: duration,
                                thumbnail_url: thumbnail.clone(),
                            },
                        );
                    }

                    return Ok(YouTubeMetadata {
                        id: video_id,
                        title,
                        channel,
                        duration_seconds: duration,
                        thumbnail_url: thumbnail,
                        formats: build_formats(&json),
                        subtitles: build_manual_subtitles(&json),
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

        if let Some(ref dir) = media_dir {
            let _ = std::fs::create_dir_all(dir);
            save_sidecar_meta(
                dir,
                &CachedMediaSidecar {
                    id: video_id.clone(),
                    title: oembed.title.clone(),
                    channel: oembed.author_name.clone(),
                    duration_seconds: 215.0,
                    thumbnail_url: thumbnail.clone(),
                },
            );
        }

        return Ok(YouTubeMetadata {
            id: video_id,
            title: oembed.title,
            channel: oembed.author_name,
            duration_seconds: 215.0,
            thumbnail_url: thumbnail,
            formats: vec![YouTubeFormat {
                format_id: "preview".to_string(),
                resolution: "Stream Preview".to_string(),
                filesize_approx: 0,
            }],
            subtitles: vec![],
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
        subtitles: vec![],
    })
}

fn default_language_display_name(lang: &str) -> String {
    let lower = lang.to_lowercase();
    if lower == "ja" || lower.starts_with("ja-") {
        "Japanese (日本語)".to_string()
    } else if lower == "id" || lower.starts_with("id-") {
        "Indonesian (Bahasa Indonesia)".to_string()
    } else if lower == "en" || lower.starts_with("en-") {
        "English".to_string()
    } else if lower == "ko" || lower.starts_with("ko-") {
        "Korean (한국어)".to_string()
    } else if lower == "zh-hans" || lower == "zh-cn" || lower == "zh" {
        "Chinese Simplified (简体中文)".to_string()
    } else if lower == "zh-hant" || lower == "zh-tw" || lower == "zh-hk" {
        "Chinese Traditional (繁體中文)".to_string()
    } else if lower == "es" || lower.starts_with("es-") {
        "Spanish (Español)".to_string()
    } else {
        lang.to_string()
    }
}

fn language_sort_priority(lang: &str) -> u8 {
    let lower = lang.to_lowercase();
    if lower == "ja" || lower.starts_with("ja-") {
        0
    } else if lower == "id" || lower.starts_with("id-") {
        1
    } else if lower == "en" || lower.starts_with("en-") {
        2
    } else if lower == "ko" || lower.starts_with("ko-") {
        3
    } else if lower.starts_with("zh") {
        4
    } else {
        10
    }
}

/// Extracts ONLY manual/creator-provided subtitle tracks from `json["subtitles"]`.
/// Strictly ignores `automatic_captions` and filters out any track whose URLs use `tlang=`
/// (machine auto-translation) or `kind=asr` (auto speech recognition).
pub fn build_manual_subtitles(json: &serde_json::Value) -> Vec<YouTubeSubtitleTrack> {
    let Some(subs_obj) = json["subtitles"].as_object() else {
        return Vec::new();
    };

    let mut out = Vec::new();

    for (lang, entries_val) in subs_obj {
        let lower_lang = lang.to_lowercase();
        if lower_lang == "live_chat" || lower_lang == "rechat" {
            continue;
        }

        let Some(entries) = entries_val.as_array() else {
            continue;
        };
        if entries.is_empty() {
            continue;
        }

        let mut has_genuine_manual_entry = false;
        let mut resolved_name: Option<String> = None;

        for entry in entries {
            let url = entry["url"].as_str().unwrap_or("");
            let name = entry["name"].as_str().unwrap_or("");
            let name_lower = name.to_lowercase();

            // Exclude machine-translated (`tlang=`) or auto-generated (`kind=asr`) tracks
            let is_auto_translated = url.contains("tlang=")
                || url.contains("kind=asr")
                || name_lower.contains("auto-translat")
                || name_lower.contains("auto-generat")
                || name_lower.contains("otomatis");

            if !is_auto_translated {
                has_genuine_manual_entry = true;
                if resolved_name.is_none() && !name.trim().is_empty() {
                    resolved_name = Some(name.trim().to_string());
                }
            }
        }

        if has_genuine_manual_entry {
            let label = resolved_name.unwrap_or_else(|| default_language_display_name(lang));
            out.push(YouTubeSubtitleTrack {
                lang: lang.clone(),
                name: label,
            });
        }
    }

    out.sort_by(|a, b| {
        language_sort_priority(&a.lang)
            .cmp(&language_sort_priority(&b.lang))
            .then_with(|| a.lang.cmp(&b.lang))
    });

    out
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
    let caps = FORMAT_HEIGHT_RE
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
    title: Option<String>,
    channel: Option<String>,
    duration_seconds: Option<f64>,
) -> Result<String, String> {
    use tauri::Manager;

    let video_id = extract_video_id(&url)?;
    let (selector, kind) = selector_for(&format_id)?;

    // Downloads live in the app cache dir, which is the only scope exposed to the asset protocol.
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Cannot resolve cache directory: {e}"))?
        .join("media");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create cache directory: {e}"))?;

    // Save or update sidecar metadata if title was provided
    let existing_sidecar = load_sidecar_meta(&dir, &video_id);
    let effective_title = title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .or_else(|| existing_sidecar.as_ref().map(|m| m.title.clone()))
        .unwrap_or_else(|| video_id.clone());

    let effective_channel = channel
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .or_else(|| existing_sidecar.as_ref().map(|m| m.channel.clone()))
        .unwrap_or_else(|| "YouTube Creator".to_string());

    let effective_duration = duration_seconds
        .or_else(|| existing_sidecar.as_ref().map(|m| m.duration_seconds))
        .unwrap_or(180.0);

    save_sidecar_meta(
        &dir,
        &CachedMediaSidecar {
            id: video_id.clone(),
            title: effective_title.clone(),
            channel: effective_channel,
            duration_seconds: effective_duration,
            thumbnail_url: format!("https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"),
        },
    );

    let safe_title = sanitize_filename_title(&effective_title);
    let bracket_suffix = format!("[{video_id}_{format_id}].");
    let legacy_prefix = format!("{video_id}_{format_id}.");

    // Fast path: if this exact video_id + format_id already exists in cache and is non-empty, reuse it immediately!
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".part") || name.ends_with(".ytdl") || name.ends_with(".json") {
                    continue;
                }
                if name.contains(&bracket_suffix) || name.starts_with(&legacy_prefix) {
                    if let Ok(meta) = entry.metadata() {
                        if meta.is_file() && meta.len() > 0 {
                            let current_path = entry.path();
                            // If it's a legacy file name (`ID_h1080.mp4`), upgrade it to `{Title} [ID_h1080].mp4`
                            if name.starts_with(&legacy_prefix) && safe_title != video_id {
                                let ext = current_path
                                    .extension()
                                    .and_then(|e| e.to_str())
                                    .unwrap_or("mp4");
                                let upgraded =
                                    dir.join(format!("{safe_title} [{video_id}_{format_id}].{ext}"));
                                if std::fs::rename(&current_path, &upgraded).is_ok() {
                                    return Ok(upgraded.to_string_lossy().into_owned());
                                }
                            }
                            return Ok(current_path.to_string_lossy().into_owned());
                        }
                    }
                }
            }
        }
    }

    let status = tauri::async_runtime::spawn_blocking(|| probe_ytdlp_sync(false))
        .await
        .unwrap_or(YtDlpStatus {
            available: false,
            path: None,
            version: None,
        });
    if !status.available {
        return Err(
            "yt-dlp was not found on your system PATH. Install yt-dlp (and ffmpeg for video merging) to download media.".to_string(),
        );
    }

    let template = dir.join(format!("{safe_title} [{video_id}_{format_id}].%(ext)s"));
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

    let output = tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("yt-dlp");
        hide_console_window(&mut cmd);
        cmd.args(&args).output()
    })
    .await
    .map_err(|e| format!("Download task failed: {e}"))?
    .map_err(|e| format!("Failed to launch yt-dlp: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let last = stderr
            .lines()
            .rev()
            .find(|l| !l.trim().is_empty())
            .unwrap_or("unknown error");
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

/// Downloads a creator-provided manual subtitle track (`.srt` or `.vtt`) from YouTube via `yt-dlp`.
/// Strictly passes `--write-sub --no-write-auto-sub` so auto-translated or ASR tracks are never downloaded.
#[tauri::command]
pub async fn ytdl_download_subtitle(
    app: tauri::AppHandle,
    url: String,
    lang: String,
) -> Result<String, String> {
    use tauri::Manager;

    let video_id = extract_video_id(&url)?;
    let clean_lang = lang.trim().to_string();
    if !SUB_LANG_RE.is_match(&clean_lang) {
        return Err(format!("Invalid subtitle language code: {clean_lang}"));
    }

    let status = tauri::async_runtime::spawn_blocking(|| probe_ytdlp_sync(false))
        .await
        .unwrap_or(YtDlpStatus {
            available: false,
            path: None,
            version: None,
        });
    if !status.available {
        return Err(
            "yt-dlp is required to download embedded YouTube subtitle tracks.".to_string(),
        );
    }

    let subs_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Cannot resolve cache directory: {e}"))?
        .join("media")
        .join("subs");
    std::fs::create_dir_all(&subs_dir)
        .map_err(|e| format!("Cannot create subtitle cache directory: {e}"))?;

    // Remove any stale subtitle file for this video_id + lang
    let prefix = format!("{video_id}_{clean_lang}");
    if let Ok(entries) = std::fs::read_dir(&subs_dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if name.starts_with(&prefix) {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
    }

    let template = subs_dir.join(format!("{video_id}_{clean_lang}.%(ext)s"));
    let canonical = format!("https://www.youtube.com/watch?v={video_id}");

    let args: Vec<String> = vec![
        "--no-playlist".into(),
        "--no-warnings".into(),
        "--skip-download".into(),
        "--write-sub".into(),
        "--no-write-auto-sub".into(),
        "--sub-langs".into(),
        clean_lang.clone(),
        "--sub-format".into(),
        "srt/vtt/best".into(),
        "--convert-subs".into(),
        "srt".into(),
        "-o".into(),
        template.to_string_lossy().to_string(),
        "--".into(),
        canonical,
    ];

    let subs_dir_for_task = subs_dir.clone();
    let video_id_for_task = video_id.clone();
    let lang_for_task = clean_lang.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("yt-dlp");
        hide_console_window(&mut cmd);
        let output = cmd
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to launch yt-dlp for subtitle download: {e}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let last = stderr
                .lines()
                .rev()
                .find(|l| !l.trim().is_empty())
                .unwrap_or("unknown error");
            return Err(format!("yt-dlp subtitle extraction failed: {last}"));
        }

        // Locate generated .srt or .vtt file in subs_dir
        let entries = std::fs::read_dir(&subs_dir_for_task)
            .map_err(|e| format!("Cannot read subtitle cache folder: {e}"))?;

        let mut matched_path: Option<PathBuf> = None;
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with(&format!("{video_id_for_task}_{lang_for_task}"))
                    && (name.ends_with(".srt") || name.ends_with(".vtt"))
                {
                    matched_path = Some(path);
                    break;
                }
            }
        }

        let target = matched_path.ok_or_else(|| {
            format!("Creator subtitle track '{lang_for_task}' was not found on this video.")
        })?;

        std::fs::read_to_string(&target)
            .map_err(|e| format!("Failed to read downloaded subtitle file: {e}"))
    })
    .await
    .map_err(|e| format!("Subtitle download task failed: {e}"))?
}

#[tauri::command]
pub async fn ytdl_list_cached_media(app: tauri::AppHandle) -> Result<Vec<CachedMediaItem>, String> {
    use tauri::Manager;

    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Cannot resolve cache directory: {e}"))?
        .join("media");

    let mut raw_items = tauri::async_runtime::spawn_blocking({
        let dir = dir.clone();
        move || -> Result<Vec<(PathBuf, String, Option<String>, String, String, String, u64)>, String> {
            if !dir.exists() {
                return Ok(Vec::new());
            }

            let mut list = Vec::new();
            let entries = std::fs::read_dir(&dir)
                .map_err(|e| format!("Failed to read media cache directory: {e}"))?;

            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                let file_name = match path.file_name().and_then(|n| n.to_str()) {
                    Some(n) => n.to_string(),
                    None => continue,
                };
                // Skip temporary downloads and sidecar metadata files
                if file_name.ends_with(".part")
                    || file_name.ends_with(".ytdl")
                    || file_name.ends_with(".json")
                    || file_name.ends_with(".srt")
                    || file_name.ends_with(".vtt")
                {
                    continue;
                }

                let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                if size_bytes == 0 {
                    continue;
                }

                let stem = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or(&file_name)
                    .to_string();
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                let (parsed_title, video_id, raw_fmt) = parse_cached_filename_stem(&stem);
                list.push((path, file_name, parsed_title, video_id, raw_fmt, ext, size_bytes));
            }
            Ok(list)
        }
    })
    .await
    .map_err(|e| format!("Failed to scan cached media: {e}"))??;

    // Resolve sidecar metadata or auto-upgrade legacy files via YouTube oEmbed
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
        .ok();

    let mut items = Vec::new();

    for (path, file_name, parsed_title, video_id, raw_fmt, ext, size_bytes) in raw_items.drain(..) {
        let mut sidecar = load_sidecar_meta(&dir, &video_id);

        if sidecar.is_none() && video_id.len() == 11 {
            if let Some(ref http) = client {
                let oembed_url = format!(
                    "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
                );
                if let Ok(res) = http
                    .get(&oembed_url)
                    .header(
                        reqwest::header::USER_AGENT,
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    )
                    .send()
                    .await
                {
                    if res.status().is_success() {
                        if let Ok(oembed) = res.json::<OEmbedResponse>().await {
                            let resolved = CachedMediaSidecar {
                                id: video_id.clone(),
                                title: oembed.title,
                                channel: oembed.author_name,
                                duration_seconds: 180.0,
                                thumbnail_url: oembed.thumbnail_url.unwrap_or_else(|| {
                                    format!("https://i.ytimg.com/vi/{video_id}/hqdefault.jpg")
                                }),
                            };
                            save_sidecar_meta(&dir, &resolved);
                            sidecar = Some(resolved);
                        }
                    }
                }
            }
        }

        let title = sidecar
            .as_ref()
            .map(|m| m.title.clone())
            .or(parsed_title.clone())
            .unwrap_or_else(|| format!("YouTube Video ({video_id})"));

        let channel = sidecar
            .as_ref()
            .map(|m| m.channel.clone())
            .unwrap_or_else(|| "YouTube Creator".to_string());

        let duration_seconds = sidecar.as_ref().map(|m| m.duration_seconds).unwrap_or(180.0);

        let thumbnail_url = sidecar
            .as_ref()
            .map(|m| m.thumbnail_url.clone())
            .unwrap_or_else(|| format!("https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"));

        // Auto-rename legacy `ID_format.ext` file on disk to `{Title} [ID_format].ext` when real title is known
        let mut final_file_name = file_name;
        let mut final_file_path = path.to_string_lossy().into_owned();
        if parsed_title.is_none() && sidecar.is_some() && !raw_fmt.is_empty() {
            let safe_title = sanitize_filename_title(&title);
            let upgraded_name = format!("{safe_title} [{video_id}_{raw_fmt}].{ext}");
            let upgraded_path = dir.join(&upgraded_name);
            if !upgraded_path.exists() && std::fs::rename(&path, &upgraded_path).is_ok() {
                final_file_name = upgraded_name;
                final_file_path = upgraded_path.to_string_lossy().into_owned();
            }
        }

        let is_audio = raw_fmt == "audio"
            || matches!(ext.as_str(), "m4a" | "mp3" | "wav" | "ogg" | "flac" | "opus");
        let format_label = if raw_fmt == "audio" {
            format!("Audio ({})", ext.to_uppercase())
        } else if let Some(h) = raw_fmt.strip_prefix('h') {
            format!("{h}p {}", ext.to_uppercase())
        } else {
            ext.to_uppercase()
        };

        items.push(CachedMediaItem {
            file_name: final_file_name,
            file_path: final_file_path,
            video_id,
            title,
            channel,
            thumbnail_url,
            duration_seconds,
            format_id: raw_fmt,
            format_label,
            size_bytes,
            is_audio,
        });
    }

    items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    Ok(items)
}

#[tauri::command]
pub async fn ytdl_delete_cached_media(
    app: tauri::AppHandle,
    file_name: String,
) -> Result<(), String> {
    use tauri::Manager;

    let clean_name = file_name.trim().to_string();
    if clean_name.is_empty()
        || clean_name.contains("..")
        || clean_name.contains('/')
        || clean_name.contains('\\')
    {
        return Err("Invalid cache file name".to_string());
    }

    let target = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Cannot resolve cache directory: {e}"))?
        .join("media")
        .join(&clean_name);

    tauri::async_runtime::spawn_blocking(move || {
        if target.exists() && target.is_file() {
            std::fs::remove_file(&target)
                .map_err(|e| format!("Failed to delete cached media file: {e}"))?;
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Failed to delete cached media task: {e}"))?
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
    fn test_extract_video_id_music_and_query_params() {
        let music_url = "https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVMdQw4w9WgXcQ";
        assert_eq!(extract_video_id(music_url).unwrap(), "dQw4w9WgXcQ");

        let reordered_query = "https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ";
        assert_eq!(extract_video_id(reordered_query).unwrap(), "dQw4w9WgXcQ");
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
    fn test_build_manual_subtitles_excludes_auto_translated_and_asr() {
        let json = serde_json::json!({
            "subtitles": {
                "ja": [
                    {"ext": "vtt", "url": "https://www.youtube.com/api/timedtext?v=123&lang=ja", "name": "Japanese"}
                ],
                "id": [
                    {"ext": "vtt", "url": "https://www.youtube.com/api/timedtext?v=123&lang=id", "name": "Indonesian"}
                ],
                "fr": [
                    {"ext": "vtt", "url": "https://www.youtube.com/api/timedtext?v=123&lang=ja&tlang=fr", "name": "French (auto-translated)"}
                ],
                "live_chat": [
                    {"ext": "json", "url": "https://www.youtube.com/live_chat"}
                ]
            },
            "automatic_captions": {
                "de": [
                    {"ext": "vtt", "url": "https://www.youtube.com/api/timedtext?v=123&lang=de&kind=asr"}
                ]
            }
        });

        let subs = build_manual_subtitles(&json);
        assert_eq!(subs.len(), 2);
        assert_eq!(subs[0].lang, "ja");
        assert_eq!(subs[1].lang, "id");
    }

    #[test]
    fn test_sanitize_and_parse_cached_filename() {
        let safe = sanitize_filename_title("YOASOBI「アイドル」/ Idol: [Official MV]*?");
        assert!(!safe.contains('/'));
        assert!(!safe.contains(':'));
        assert!(!safe.contains('*'));

        let (title, vid, fmt) =
            parse_cached_filename_stem("YOASOBI - Idol [VEZ5PMVkysg_h1080]");
        assert_eq!(title.as_deref(), Some("YOASOBI - Idol"));
        assert_eq!(vid, "VEZ5PMVkysg");
        assert_eq!(fmt, "h1080");

        let (legacy_title, legacy_vid, legacy_fmt) =
            parse_cached_filename_stem("VEZ5PMVkysg_h1080");
        assert!(legacy_title.is_none());
        assert_eq!(legacy_vid, "VEZ5PMVkysg");
        assert_eq!(legacy_fmt, "h1080");
    }

    #[test]
    fn test_extract_video_id_invalid() {
        let url = "https://malicious.site/hack?v=123";
        assert!(extract_video_id(url).is_err());
    }
}
