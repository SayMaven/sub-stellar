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

        let mut line_tokens = Vec::with_capacity(tokens.len());
        for token in tokens.iter_mut() {
            let surface = token.surface.as_ref().to_string();
            let details = token.details();
            // IPADIC CSV columns:
            // [0]=pos, [1..3]=subpos, [4..5]=conj, [6]=base, [7]=reading, [8]=pronunciation
            let reading = details
                .get(7)
                .map(|r| r.trim())
                .filter(|r| !r.is_empty() && *r != "*")
                .map(|r| r.to_string());
            line_tokens.push(MorphTokenDto { surface, reading });
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
    fn test_analyze_furigana_lines_japanese() {
        let lines = vec!["関西国際空港".to_string(), "   ".to_string(), "東京タワー".to_string()];
        let res = analyze_lines_native(&lines).expect("lindera analysis should succeed");
        assert_eq!(res.len(), 3);
        assert!(!res[0].is_empty());
        assert!(res[1].is_empty());
        let joined: String = res[0].iter().map(|t| t.surface.as_str()).collect();
        assert_eq!(joined, "関西国際空港");
        assert!(res[0].iter().any(|t| t.reading.is_some()));
    }
}

