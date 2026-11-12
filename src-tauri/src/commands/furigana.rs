use lindera::dictionary::load_dictionary;
use lindera::mode::Mode;
use lindera::segmenter::Segmenter;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::sync::{OnceLock, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MorphTokenDto {
    pub surface: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reading: Option<String>,
}

static SEGMENTER_CACHE: OnceLock<RwLock<Option<Segmenter>>> = OnceLock::new();

fn segmenter_lock() -> &'static RwLock<Option<Segmenter>> {
    SEGMENTER_CACHE.get_or_init(|| RwLock::new(None))
}

fn ensure_segmenter_loaded() -> Result<(), String> {
    {
        let guard = segmenter_lock()
            .read()
            .map_err(|_| "Furigana segmenter lock poisoned".to_string())?;
        if guard.is_some() {
            return Ok(());
        }
    }

    let dictionary = load_dictionary("embedded://ipadic")
        .map_err(|e| format!("Failed to load embedded IPADIC dictionary: {}", e))?;
    let segmenter = Segmenter::new(Mode::Normal, dictionary, None);

    let mut guard = segmenter_lock()
        .write()
        .map_err(|_| "Furigana segmenter lock poisoned".to_string())?;
    if guard.is_none() {
        *guard = Some(segmenter);
    }
    Ok(())
}

pub fn analyze_lines_native(lines: &[String]) -> Result<Vec<Vec<MorphTokenDto>>, String> {
    ensure_segmenter_loaded()?;
    let guard = segmenter_lock()
        .read()
        .map_err(|_| "Furigana segmenter lock poisoned".to_string())?;
    let segmenter = guard
        .as_ref()
        .ok_or_else(|| "Furigana segmenter not initialized".to_string())?;

    let mut out = Vec::with_capacity(lines.len());
    for line in lines {
        if line.trim().is_empty() {
            out.push(Vec::new());
            continue;
        }
        let mut tokens = segmenter
            .segment(Cow::Borrowed(line.as_str()))
            .map_err(|e| format!("Lindera segmentation failed: {}", e))?;

        let mut line_tokens = Vec::with_capacity(tokens.len() * 2);
        let mut cursor = 0;
        let line_str = line.as_str();

        for token in tokens.iter_mut() {
            let surface = token.surface.to_string();
            if surface.is_empty() {
                continue;
            }

            // Preserve whitespace and non-morphemic characters that Lindera skips
            if let Some(pos) = line_str[cursor..].find(&surface) {
                let match_start = cursor + pos;
                if match_start > cursor {
                    let gap = &line_str[cursor..match_start];
                    line_tokens.push(MorphTokenDto {
                        surface: gap.to_string(),
                        reading: None,
                    });
                }

                let details = token.details();
                let reading = details
                    .get(7)
                    .map(|r| r.trim())
                    .filter(|r| !r.is_empty() && *r != "*")
                    .map(|r| r.to_string());

                let surface_len = surface.len();
                line_tokens.push(MorphTokenDto { surface, reading });
                cursor = match_start + surface_len;
            } else {
                let details = token.details();
                let reading = details
                    .get(7)
                    .map(|r| r.trim())
                    .filter(|r| !r.is_empty() && *r != "*")
                    .map(|r| r.to_string());

                line_tokens.push(MorphTokenDto { surface, reading });
            }
        }

        if cursor < line_str.len() {
            let trailing = &line_str[cursor..];
            line_tokens.push(MorphTokenDto {
                surface: trailing.to_string(),
                reading: None,
            });
        }
        out.push(line_tokens);
    }
    Ok(out)
}

#[tauri::command]
pub async fn analyze_furigana_lines(lines: Vec<String>) -> Result<Vec<Vec<MorphTokenDto>>, String> {
    tauri::async_runtime::spawn_blocking(move || analyze_lines_native(&lines))
        .await
        .map_err(|e| format!("Furigana analysis task panicked: {}", e))?
}

#[tauri::command]
pub fn release_furigana_dictionary() -> Result<(), String> {
    let mut guard = segmenter_lock()
        .write()
        .map_err(|_| "Furigana segmenter lock poisoned".to_string())?;
    *guard = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyze_furigana_lines_preserves_spaces_and_symbols() {
        let lines = vec![
            "関西国際空港".to_string(),
            "   ".to_string(),
            "Lonely ロリロリ神 降臨".to_string(),
            "触ったら逮捕! (Ah!)".to_string(),
            "極Chu de 点呼! (Uh!)".to_string(),
            "粛聖! ロリ神レクイエム☆".to_string(),
            "ハァ? ごめんなさいが 聞こえなーい (え~?!)".to_string(),
            "法廷で会おう? (ねっ~)".to_string(),
            "ういは 全てを赦します".to_string(),
        ];
        let res = analyze_lines_native(&lines).expect("lindera analysis should succeed");
        assert_eq!(res.len(), lines.len());

        for (i, line) in lines.iter().enumerate() {
            if line.trim().is_empty() {
                assert!(res[i].is_empty());
                continue;
            }
            let joined: String = res[i].iter().map(|t| t.surface.as_str()).collect();
            assert_eq!(
                line, &joined,
                "Line {} mismatch: original='{}', joined='{}'",
                i, line, joined
            );
        }
    }
}

