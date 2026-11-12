use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RubyTokenDto {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ruby: Option<String>,
    #[serde(rename = "startTime")]
    pub start_time: f64,
    #[serde(rename = "endTime")]
    pub end_time: f64,
    #[serde(rename = "disableAnim", skip_serializing_if = "Option::is_none")]
    pub disable_anim: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SubtitleLineDto {
    pub id: String,
    #[serde(rename = "startTime")]
    pub start_time: f64,
    #[serde(rename = "endTime")]
    pub end_time: f64,
    pub text: String,
    pub tokens: Vec<RubyTokenDto>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub translation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleStyleDto {
    #[serde(rename = "fontFamily")]
    pub font_family: String,
    #[serde(rename = "fontSize")]
    pub font_size: f64,
    #[serde(rename = "fillColor")]
    pub fill_color: String,
    #[serde(rename = "outerStrokeColor")]
    pub outer_stroke_color: String,
    #[serde(rename = "outerStrokeWidth")]
    pub outer_stroke_width: f64,
    #[serde(rename = "innerStrokeColor")]
    pub inner_stroke_color: String,
    #[serde(rename = "rubyFillColor")]
    pub ruby_fill_color: String,
    #[serde(rename = "rubyActiveColor")]
    pub ruby_active_color: String,
    #[serde(rename = "translationFillColor")]
    pub translation_fill_color: String,
    #[serde(rename = "verticalPosition")]
    pub vertical_position: String,
    #[serde(rename = "yOffset")]
    pub y_offset: f64,
    #[serde(rename = "rubyScale")]
    pub ruby_scale: f64,
    #[serde(rename = "wordActiveColor")]
    pub word_active_color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackMetadataDto {
    pub title: Option<String>,
    pub artist: Option<String>,
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

fn is_cjk_char(ch: char) -> bool {
    let c = ch as u32;
    (0x3040..=0x30FF).contains(&c)
        || (0x3400..=0x4DBF).contains(&c)
        || (0x4E00..=0x9FFF).contains(&c)
        || (0xF900..=0xFAFF).contains(&c)
}

fn contains_cjk(text: &str) -> bool {
    text.chars().any(is_cjk_char)
}

/// Parses `{Base|Ruby}` syntax and segments CJK / whitespace words identically to `RubyLayout.ts`.
pub fn tokenize_subtitle_text(text: &str) -> Vec<(String, Option<String>)> {
    static RUBY_RE: OnceLock<Regex> = OnceLock::new();
    let re = RUBY_RE.get_or_init(|| Regex::new(r"\{([^|{}]+)\|([^|{}]+)\}").unwrap());

    let mut raw_parts: Vec<(String, Option<String>, bool)> = Vec::new();
    let mut last_idx = 0;

    for cap in re.captures_iter(text) {
        let m = cap.get(0).unwrap();
        if m.start() > last_idx {
            raw_parts.push((text[last_idx..m.start()].to_string(), None, false));
        }
        raw_parts.push((cap[1].to_string(), Some(cap[2].to_string()), true));
        last_idx = m.end();
    }
    if last_idx < text.len() {
        raw_parts.push((text[last_idx..].to_string(), None, false));
    }

    let mut result = Vec::new();
    for (base, ruby, is_ruby) in raw_parts {
        if is_ruby {
            result.push((base, ruby));
            continue;
        }
        for part in base.split_whitespace() {
            if part.is_empty() {
                continue;
            }
            if !contains_cjk(part) {
                result.push((part.to_string(), None));
            } else {
                let chars: Vec<char> = part.chars().collect();
                if chars.len() <= 1 {
                    result.push((part.to_string(), None));
                } else {
                    for chunk in chars.chunks(2) {
                        let s: String = chunk.iter().collect();
                        if !s.is_empty() {
                            result.push((s, None));
                        }
                    }
                }
            }
        }
    }
    result
}

pub fn parse_lrc_timestamp(time_str: &str) -> Option<f64> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"(\d+):(\d+(?:\.\d+)?)").unwrap());
    let cap = re.captures(time_str)?;
    let minutes: f64 = cap[1].parse().ok()?;
    let seconds: f64 = cap[2].parse().ok()?;
    Some(minutes * 60.0 + seconds)
}

pub fn parse_srt_timestamp(time_str: &str) -> Option<f64> {
    static HMS_RE: OnceLock<Regex> = OnceLock::new();
    static MS_RE: OnceLock<Regex> = OnceLock::new();
    let hms_re = HMS_RE.get_or_init(|| Regex::new(r"^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$").unwrap());
    let ms_re = MS_RE.get_or_init(|| Regex::new(r"^(\d{1,2}):(\d{1,2}(?:\.\d+)?)$").unwrap());

    let cleaned = time_str.trim().replace(',', ".");
    if let Some(cap) = hms_re.captures(&cleaned) {
        let h: f64 = cap[1].parse().ok()?;
        let m: f64 = cap[2].parse().ok()?;
        let s: f64 = cap[3].parse().ok()?;
        return Some(h * 3600.0 + m * 60.0 + s);
    }
    if let Some(cap) = ms_re.captures(&cleaned) {
        let m: f64 = cap[1].parse().ok()?;
        let s: f64 = cap[2].parse().ok()?;
        return Some(m * 60.0 + s);
    }
    None
}

pub fn is_srt_format(raw: &str) -> bool {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        Regex::new(r"\d{1,2}:\d{2}(?::\d{2})?[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?[,.]\d{1,3}")
            .unwrap()
    });
    re.is_match(raw)
}

pub fn is_yrc_format(raw: &str) -> bool {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"\[\d+,\d+\]\(\d+,\d+,\d+\)").unwrap());
    re.is_match(raw)
}

fn decode_html_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
}

fn strip_html_and_ass_tags(s: &str) -> String {
    static HTML_RE: OnceLock<Regex> = OnceLock::new();
    static ASS_RE: OnceLock<Regex> = OnceLock::new();
    let html_re = HTML_RE.get_or_init(|| Regex::new(r"<[^>]+>").unwrap());
    let ass_re = ASS_RE.get_or_init(|| Regex::new(r"\{\\[^}]+\}").unwrap());
    let no_html = html_re.replace_all(s, "");
    let no_ass = ass_re.replace_all(&no_html, "");
    decode_html_entities(&no_ass).trim().to_string()
}

fn extract_bracketed_inner(s: &str) -> Option<&str> {
    let trimmed = s.trim();
    let first = trimmed.chars().next()?;
    let last = trimmed.chars().last()?;
    let valid_pair = matches!(
        (first, last),
        ('(', ')') | ('[', ']') | ('（', '）') | ('【', '】')
    );
    if !valid_pair {
        return None;
    }
    let inner = &trimmed[first.len_utf8()..trimmed.len() - last.len_utf8()];
    if inner.is_empty() {
        None
    } else {
        Some(inner)
    }
}

pub fn parse_yrc(raw: &str) -> Vec<SubtitleLineDto> {
    static LINE_RE: OnceLock<Regex> = OnceLock::new();
    static TOKEN_RE: OnceLock<Regex> = OnceLock::new();
    let line_re = LINE_RE.get_or_init(|| Regex::new(r"^\[(\d+),(\d+)\](.*)$").unwrap());
    let token_re = TOKEN_RE.get_or_init(|| Regex::new(r"\((\d+),(\d+),\d+\)([^(]+)").unwrap());

    let mut result = Vec::new();
    for (i, raw_line) in raw.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        let Some(cap) = line_re.captures(line) else {
            continue;
        };
        let line_start_sec = cap[1].parse::<f64>().unwrap_or(0.0) / 1000.0;
        let line_dur_sec = cap[2].parse::<f64>().unwrap_or(0.0) / 1000.0;
        let line_end_sec = line_start_sec + line_dur_sec;
        let tokens_content = &cap[3];

        let mut tokens = Vec::new();
        let mut full_text = String::new();
        for tcap in token_re.captures_iter(tokens_content) {
            let t_start = tcap[1].parse::<f64>().unwrap_or(0.0) / 1000.0;
            let t_dur = tcap[2].parse::<f64>().unwrap_or(0.0) / 1000.0;
            let t_text = tcap[3].to_string();
            full_text.push_str(&t_text);
            tokens.push(RubyTokenDto {
                text: t_text,
                ruby: None,
                start_time: t_start,
                end_time: t_start + t_dur,
                disable_anim: None,
            });
        }

        let clean_full = full_text.trim().to_string();
        if !clean_full.is_empty() {
            if tokens.is_empty() {
                tokens.push(RubyTokenDto {
                    text: clean_full.clone(),
                    ruby: None,
                    start_time: line_start_sec,
                    end_time: line_end_sec,
                    disable_anim: None,
                });
            }
            result.push(SubtitleLineDto {
                id: format!("line-{}", i + 1),
                start_time: round2(line_start_sec),
                end_time: round2(line_end_sec),
                text: clean_full,
                tokens,
                translation: None,
            });
        }
    }
    result
}

pub fn parse_srt(raw: &str, translation_raw: Option<&str>) -> Vec<SubtitleLineDto> {
    static BLOCK_SPLIT_RE: OnceLock<Regex> = OnceLock::new();
    static VTT_HEADER_RE: OnceLock<Regex> = OnceLock::new();
    let block_re = BLOCK_SPLIT_RE.get_or_init(|| Regex::new(r"\r?\n\s*\r?\n").unwrap());
    let vtt_re = VTT_HEADER_RE.get_or_init(|| Regex::new(r"(?i)^(WEBVTT|STYLE|NOTE)\b").unwrap());

    let clean_raw = raw.trim_start_matches('\u{FEFF}').trim();
    if clean_raw.is_empty() {
        return Vec::new();
    }

    let mut result: Vec<SubtitleLineDto> = Vec::new();

    for block in block_re.split(clean_raw) {
        let lines: Vec<&str> = block
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect();
        if lines.is_empty() {
            continue;
        }
        if vtt_re.is_match(lines[0]) && !lines.iter().any(|l| l.contains("-->")) {
            continue;
        }

        let Some(arrow_idx) = lines.iter().position(|l| l.contains("-->")) else {
            continue;
        };
        let timing_line = lines[arrow_idx];
        let parts: Vec<&str> = timing_line.split("-->").collect();
        if parts.len() < 2 {
            continue;
        }

        let Some(raw_start) = parse_srt_timestamp(parts[0]) else {
            continue;
        };
        let end_token = parts[1].trim().split_whitespace().next().unwrap_or("");
        let Some(raw_end) = parse_srt_timestamp(end_token) else {
            continue;
        };

        let start_time = round2(raw_start);
        let end_time = round2(raw_end.max(start_time + 0.3));

        let content_lines: Vec<String> = lines[arrow_idx + 1..]
            .iter()
            .map(|l| strip_html_and_ass_tags(l))
            .filter(|l| !l.is_empty())
            .collect();
        if content_lines.is_empty() {
            continue;
        }

        let mut primary_text = content_lines[0].clone();
        let mut inline_translation = if content_lines.len() > 1 {
            Some(content_lines[1..].join(" "))
        } else {
            None
        };

        if content_lines.len() >= 2 {
            if let Some(inner0) = extract_bracketed_inner(&content_lines[0]) {
                if extract_bracketed_inner(&content_lines[1]).is_none() {
                    primary_text = content_lines[1].clone();
                    inline_translation = Some(inner0.trim().to_string());
                }
            }
        } else if content_lines.len() == 1 {
            if let Some(inner) = extract_bracketed_inner(&content_lines[0]) {
                if !inner.contains('|') {
                    primary_text = inner.trim().to_string();
                }
            }
        }

        if let Some(prev) = result.last_mut() {
            if prev.text == primary_text && (start_time - prev.end_time).abs() <= 0.15 {
                prev.end_time = prev.end_time.max(end_time);
                continue;
            }
        }

        let parsed_tokens = tokenize_subtitle_text(&primary_text);
        let span = (end_time - start_time).max(0.1);
        let step = span / (parsed_tokens.len().max(1) as f64);
        let len = parsed_tokens.len();

        let tokens: Vec<RubyTokenDto> = parsed_tokens
            .into_iter()
            .enumerate()
            .map(|(idx, (base, ruby))| RubyTokenDto {
                text: base,
                ruby,
                start_time: round2(start_time + (idx as f64) * step),
                end_time: if idx + 1 == len {
                    end_time
                } else {
                    round2(start_time + ((idx + 1) as f64) * step)
                },
                disable_anim: None,
            })
            .collect();

        result.push(SubtitleLineDto {
            id: format!("line-{}", result.len() + 1),
            start_time,
            end_time,
            text: primary_text,
            tokens,
            translation: inline_translation,
        });
    }

    if let Some(tr) = translation_raw {
        if !tr.trim().is_empty() && is_srt_format(tr) {
            let trans_cues = parse_srt(tr, None);
            for line in &mut result {
                let mid = (line.start_time + line.end_time) / 2.0;
                let matched = trans_cues
                    .iter()
                    .find(|tc| mid >= tc.start_time - 0.4 && mid <= tc.end_time + 0.4)
                    .or_else(|| {
                        trans_cues
                            .iter()
                            .find(|tc| (tc.start_time - line.start_time).abs() <= 0.9)
                    });
                if let Some(m) = matched {
                    let trimmed = m.text.trim();
                    if !trimmed.is_empty() {
                        line.translation = Some(trimmed.to_string());
                    }
                }
            }
        }
    }

    result
}

pub fn parse_lrc(raw: &str, translation_raw: Option<&str>) -> Vec<SubtitleLineDto> {
    if is_yrc_format(raw) {
        return parse_yrc(raw);
    }
    if is_srt_format(raw) {
        return parse_srt(raw, translation_raw);
    }

    static META_RE: OnceLock<Regex> = OnceLock::new();
    static TS_RE: OnceLock<Regex> = OnceLock::new();
    static WORD_RE: OnceLock<Regex> = OnceLock::new();
    static TRANS_RE: OnceLock<Regex> = OnceLock::new();

    let meta_re = META_RE.get_or_init(|| Regex::new(r"^\[[a-zA-Z]+:").unwrap());
    let ts_re = TS_RE.get_or_init(|| Regex::new(r"\[(\d+:\d+(?:\.\d+)?)\]").unwrap());
    let word_re = WORD_RE.get_or_init(|| Regex::new(r"<(\d+:\d+(?:\.\d+)?)>([^<]+)").unwrap());
    let trans_re = TRANS_RE.get_or_init(|| Regex::new(r"^\[(\d+:\d+(?:\.\d+)?)\](.*)$").unwrap());

    struct ParsedItem {
        time: f64,
        text: String,
    }

    let clean_raw = raw.trim_start_matches('\u{FEFF}');
    let mut parsed_items: Vec<ParsedItem> = Vec::new();

    for line in clean_raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || meta_re.is_match(trimmed) {
            continue;
        }
        let mut timestamps = Vec::new();
        let mut last_idx = 0;
        for cap in ts_re.captures_iter(trimmed) {
            if let Some(t) = parse_lrc_timestamp(&cap[1]) {
                timestamps.push(t);
            }
            last_idx = cap.get(0).unwrap().end();
        }
        if !timestamps.is_empty() {
            let text_content = trimmed[last_idx..].trim().to_string();
            for time in timestamps {
                parsed_items.push(ParsedItem {
                    time,
                    text: text_content.clone(),
                });
            }
        }
    }

    parsed_items.sort_by(|a, b| {
        a.time
            .partial_cmp(&b.time)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut translations_map: HashMap<i64, String> = HashMap::new();
    if let Some(tr) = translation_raw {
        for tline in tr.lines() {
            if let Some(cap) = trans_re.captures(tline.trim()) {
                if let Some(time) = parse_lrc_timestamp(&cap[1]) {
                    let content = cap[2].trim();
                    if !content.is_empty() {
                        let key = (time * 2.0).round() as i64;
                        translations_map.insert(key, content.to_string());
                    }
                }
            }
        }
    }

    let mut result: Vec<SubtitleLineDto> = Vec::new();
    for i in 0..parsed_items.len() {
        let item = &parsed_items[i];
        if item.text.trim().is_empty() {
            continue;
        }

        let start_time = round2(item.time);
        let mut end_time = if let Some(next_item) = parsed_items.get(i + 1) {
            (start_time + 6.0).min(next_item.time)
        } else {
            start_time + 4.5
        };
        if end_time <= start_time {
            end_time = start_time + 3.0;
        }
        end_time = round2(end_time);

        let line_duration = (end_time - start_time).max(0.5);
        let mut tokens: Vec<RubyTokenDto> = Vec::new();

        for cap in word_re.captures_iter(&item.text) {
            if let Some(w_time) = parse_lrc_timestamp(&cap[1]) {
                let w_text = cap[2].trim();
                if !w_text.is_empty() {
                    tokens.push(RubyTokenDto {
                        text: w_text.to_string(),
                        ruby: None,
                        start_time: round2(w_time),
                        end_time: round2(w_time + 0.6),
                        disable_anim: None,
                    });
                }
            }
        }

        if !tokens.is_empty() {
            let len = tokens.len();
            for k in 0..len {
                if k + 1 < len {
                    let next_start = tokens[k + 1].start_time;
                    tokens[k].end_time = next_start.max(tokens[k].start_time + 0.05);
                } else {
                    tokens[k].end_time = end_time.max(tokens[k].start_time + 0.1);
                }
            }
        }

        let clean_line_text = word_re.replace_all(&item.text, "").trim().to_string();

        if tokens.is_empty() {
            let ruby_tokens = tokenize_subtitle_text(&clean_line_text);
            let token_dur = line_duration / (ruby_tokens.len().max(1) as f64);
            let len = ruby_tokens.len();
            for (idx, (base, ruby)) in ruby_tokens.into_iter().enumerate() {
                let t_start = round2(start_time + (idx as f64) * token_dur);
                let t_end = if idx + 1 == len {
                    end_time
                } else {
                    round2(start_time + ((idx + 1) as f64) * token_dur)
                };
                tokens.push(RubyTokenDto {
                    text: base,
                    ruby,
                    start_time: t_start,
                    end_time: t_end,
                    disable_anim: None,
                });
            }
        }

        let rounded_key = (start_time * 2.0).round() as i64;
        let translation = translations_map.get(&rounded_key).cloned();

        result.push(SubtitleLineDto {
            id: format!("line-{}", result.len() + 1),
            start_time,
            end_time,
            text: clean_line_text,
            tokens,
            translation,
        });
    }

    if result.is_empty() {
        let plain_lines: Vec<&str> = clean_raw
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty() && !meta_re.is_match(l))
            .collect();

        for (idx, line_text) in plain_lines.into_iter().enumerate() {
            let start_time = round2((idx as f64) * 3.5);
            let end_time = round2(start_time + 3.2);
            let ruby_tokens = tokenize_subtitle_text(line_text);
            let step = (end_time - start_time) / (ruby_tokens.len().max(1) as f64);
            let len = ruby_tokens.len();
            let tokens = ruby_tokens
                .into_iter()
                .enumerate()
                .map(|(t_idx, (base, ruby))| RubyTokenDto {
                    text: base,
                    ruby,
                    start_time: round2(start_time + (t_idx as f64) * step),
                    end_time: if t_idx + 1 == len {
                        end_time
                    } else {
                        round2(start_time + ((t_idx + 1) as f64) * step)
                    },
                    disable_anim: None,
                })
                .collect();
            result.push(SubtitleLineDto {
                id: format!("line-{}", idx + 1),
                start_time,
                end_time,
                text: line_text.to_string(),
                tokens,
                translation: None,
            });
        }
    }

    result
}

fn format_ass_time(seconds: f64) -> String {
    let s_total = seconds.max(0.0);
    let h = (s_total / 3600.0).floor() as u64;
    let m = ((s_total % 3600.0) / 60.0).floor() as u64;
    let s = (s_total % 60.0).floor() as u64;
    let cs = ((s_total % 1.0) * 100.0).floor() as u64;
    format!("{}:{:02}:{:02}.{:02}", h, m, s, cs)
}

fn format_srt_time(seconds: f64) -> String {
    let s_total = seconds.max(0.0);
    let h = (s_total / 3600.0).floor() as u64;
    let m = ((s_total % 3600.0) / 60.0).floor() as u64;
    let s = (s_total % 60.0).floor() as u64;
    let ms = ((s_total % 1.0) * 1000.0).floor() as u64;
    format!("{:02}:{:02}:{:02},{:03}", h, m, s, ms)
}

pub fn hex_to_ass_bgr(hex: &str, fallback: &str) -> String {
    let cleaned = hex.trim().trim_start_matches('#');
    if cleaned.len() == 6 && cleaned.chars().all(|c| c.is_ascii_hexdigit()) {
        let r = cleaned[0..2].to_uppercase();
        let g = cleaned[2..4].to_uppercase();
        let b = cleaned[4..6].to_uppercase();
        return format!("&H00{}{}{}", b, g, r);
    }
    if cleaned.len() == 3 && cleaned.chars().all(|c| c.is_ascii_hexdigit()) {
        let chars: Vec<char> = cleaned.chars().collect();
        let r = format!("{0}{0}", chars[0]).to_uppercase();
        let g = format!("{0}{0}", chars[1]).to_uppercase();
        let b = format!("{0}{0}", chars[2]).to_uppercase();
        return format!("&H00{}{}{}", b, g, r);
    }
    fallback.to_string()
}

fn primary_font_name(font_family: &str) -> String {
    font_family
        .split(',')
        .next()
        .map(|s| s.trim().trim_matches('"').trim_matches('\''))
        .filter(|s| !s.is_empty())
        .unwrap_or("Segoe UI")
        .to_string()
}

pub fn generate_ass(
    lines: &[SubtitleLineDto],
    style: &SubtitleStyleDto,
    track: Option<&TrackMetadataDto>,
    width: u32,
    height: u32,
) -> String {
    let title = track
        .and_then(|t| t.title.as_deref())
        .filter(|s| !s.is_empty())
        .unwrap_or("SubStellar Project");
    let artist = track
        .and_then(|t| t.artist.as_deref())
        .filter(|s| !s.is_empty())
        .unwrap_or("Unknown Artist");

    let font_name = primary_font_name(&style.font_family);
    let trans_font_size = (style.font_size * 0.55).round().max(18.0) as i32;
    let trans_margin_v = (style.y_offset - trans_font_size as f64 - 10.0).max(16.0);
    let alignment = match style.vertical_position.as_str() {
        "top" => 8,
        "center" => 5,
        _ => 2,
    };

    let primary_color = hex_to_ass_bgr(&style.fill_color, "&H00FFFFFF");
    let secondary_source = if style.word_active_color.trim().is_empty() {
        &style.inner_stroke_color
    } else {
        &style.word_active_color
    };
    let secondary_color = hex_to_ass_bgr(secondary_source, "&H00FFB48F");
    let outline_color = hex_to_ass_bgr(&style.outer_stroke_color, "&H001B1614");
    let ruby_primary_color = hex_to_ass_bgr(&style.ruby_active_color, "&H00B5FF5A");
    let ruby_secondary_color = hex_to_ass_bgr(&style.ruby_fill_color, "&H00FFB48F");
    let trans_color = hex_to_ass_bgr(&style.translation_fill_color, "&H00CAC3BF");

    let furigana_size = (style.font_size * style.ruby_scale).round() as i32;
    let furigana_outline = (style.outer_stroke_width * 0.5).round().max(2.0);
    let furigana_margin_v = style.y_offset + (style.font_size * 0.9).round();

    let mut events = Vec::with_capacity(lines.len() * 2);
    for line in lines {
        let start = format_ass_time(line.start_time);
        let end = format_ass_time(line.end_time);

        let event_text = if !line.tokens.is_empty() {
            let has_space_in_raw = line.text.chars().any(char::is_whitespace);
            let mut buf = String::new();
            let last_idx = line.tokens.len() - 1;
            for (i, token) in line.tokens.iter().enumerate() {
                let dur_cs = ((token.end_time - token.start_time) * 100.0).round().max(1.0) as u64;
                let trailing_space = if has_space_in_raw && i < last_idx {
                    " "
                } else {
                    ""
                };
                buf.push_str(&format!("{{\\k{}}}{}{}", dur_cs, token.text, trailing_space));
            }
            buf
        } else {
            line.text.clone()
        };

        events.push(format!(
            "Dialogue: 0,{},{},Default,,0,0,0,,{}",
            start, end, event_text
        ));
        if let Some(tr) = &line.translation {
            let trimmed = tr.trim();
            if !trimmed.is_empty() {
                events.push(format!(
                    "Dialogue: 0,{},{},Translation,,0,0,0,,{}",
                    start, end, trimmed
                ));
            }
        }
    }

    format!(
        "[Script Info]
; Script generated by SubStellar Studio (https://github.com/SayMaven/sub-stellar)
; Title: {} - {}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: {}
PlayResY: {}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{},{},{},{},{},&H80000000,-1,0,0,0,100,100,0,0,1,{},2,{},40,40,{},1
Style: Furigana,{},{},{},{},{},&H80000000,-1,0,0,0,100,100,0,0,1,{},1,{},40,40,{},1
Style: Translation,{},{},{},{},{},&H80000000,0,0,0,0,100,100,0,0,1,4,1,{},40,40,{},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
{}
",
        title,
        artist,
        width,
        height,
        font_name,
        style.font_size,
        primary_color,
        secondary_color,
        outline_color,
        style.outer_stroke_width,
        alignment,
        style.y_offset,
        font_name,
        furigana_size,
        ruby_primary_color,
        ruby_secondary_color,
        outline_color,
        furigana_outline,
        alignment,
        furigana_margin_v,
        font_name,
        trans_font_size,
        trans_color,
        trans_color,
        outline_color,
        alignment,
        trans_margin_v,
        events.join("\n")
    )
}

pub fn generate_srt(lines: &[SubtitleLineDto]) -> String {
    static RUBY_RE: OnceLock<Regex> = OnceLock::new();
    let ruby_re = RUBY_RE.get_or_init(|| Regex::new(r"\{([^|{}]+)\|[^}]+\}").unwrap());

    lines
        .iter()
        .enumerate()
        .map(|(idx, line)| {
            let start = format_srt_time(line.start_time);
            let end = format_srt_time(line.end_time);
            let clean_text = ruby_re.replace_all(&line.text, "$1");
            let trans_line = line
                .translation
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| format!("\n{}", s))
                .unwrap_or_default();
            format!("{}\n{} --> {}\n{}{}\n", idx + 1, start, end, clean_text, trans_line)
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[tauri::command]
pub fn parse_subtitle_text(
    raw: String,
    translation_raw: Option<String>,
) -> Result<Vec<SubtitleLineDto>, String> {
    Ok(parse_lrc(&raw, translation_raw.as_deref()))
}

#[tauri::command]
pub fn generate_ass_text(
    lines: Vec<SubtitleLineDto>,
    style: SubtitleStyleDto,
    track: Option<TrackMetadataDto>,
    width: u32,
    height: u32,
) -> Result<String, String> {
    Ok(generate_ass(&lines, &style, track.as_ref(), width, height))
}

#[tauri::command]
pub fn generate_srt_text(lines: Vec<SubtitleLineDto>) -> Result<String, String> {
    Ok(generate_srt(&lines))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_lrc_standard_and_enhanced() {
        let lrc = "[ti:Test]\n[00:01.50]Hello world\n[00:05.00]<00:05.00>Kimi <00:05.50>no <00:06.00>na\n";
        let lines = parse_lrc(lrc, None);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].text, "Hello world");
        assert_eq!(lines[0].tokens.len(), 2);
        assert_eq!(lines[1].tokens.len(), 3);
        assert_eq!(lines[1].tokens[0].text, "Kimi");
        assert_eq!(lines[1].tokens[1].start_time, 5.5);
    }

    #[test]
    fn test_parse_srt_with_brackets_and_entities() {
        let srt = "1\n00:00:01,000 --> 00:00:03,500\n[Atashi wa]\n<i>Watashi &amp; Kimi</i>\n";
        let lines = parse_lrc(srt, None);
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].text, "Watashi & Kimi");
        assert_eq!(lines[0].translation.as_deref(), Some("Atashi wa"));
    }

    #[test]
    fn test_generate_srt_strips_ruby() {
        let lines = vec![SubtitleLineDto {
            id: "line-1".into(),
            start_time: 1.0,
            end_time: 3.5,
            text: "もう{何|なに}も".into(),
            tokens: vec![],
            translation: Some("Nothing anymore".into()),
        }];
        let srt = generate_srt(&lines);
        assert!(srt.contains("もう何も"));
        assert!(srt.contains("00:00:01,000 --> 00:00:03,500"));
        assert!(srt.contains("Nothing anymore"));
    }

    #[test]
    fn test_hex_to_ass_bgr() {
        assert_eq!(hex_to_ass_bgr("#FF8800", "&H00FFFFFF"), "&H000088FF");
        assert_eq!(hex_to_ass_bgr("#F80", "&H00FFFFFF"), "&H000088FF");
    }
}

