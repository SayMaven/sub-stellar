use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemFontEntry {
    pub family: String,
}

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn push_unique_family(
    seen_lower: &mut HashSet<String>,
    out: &mut Vec<String>,
    raw_name: &str,
) {
    let trimmed = raw_name.trim().trim_matches('"').trim();
    if trimmed.is_empty() || trimmed.starts_with('@') || trimmed.len() > 120 {
        return;
    }
    let key = trimmed.to_lowercase();
    if seen_lower.insert(key) {
        out.push(trimmed.to_string());
    }
}

/// Cleans a Windows Registry font display name into CSS family candidate names.
/// Example: "Yu Gothic Bold & Yu Gothic UI Semibold (TrueType)" -> ["Yu Gothic", "Yu Gothic UI"]
pub fn clean_windows_registry_font_name(raw: &str) -> Vec<String> {
    let mut cleaned = raw.trim().to_string();
    for tag in [
        "(TrueType)",
        "(OpenType)",
        "(All res)",
        "(VGA res)",
        "(8514a res)",
        "(Type 1)",
    ] {
        if let Some(pos) = cleaned.to_lowercase().find(&tag.to_lowercase()) {
            cleaned.truncate(pos);
        }
    }

    let style_suffixes = [
        " Bold Italic",
        " Bold Oblique",
        " SemiBold Italic",
        " Demibold Italic",
        " Light Italic",
        " Thin Italic",
        " Medium Italic",
        " ExtraBold Italic",
        " Black Italic",
        " Regular",
        " Bold",
        " Italic",
        " Oblique",
        " SemiBold",
        " Semibold",
        " Demibold",
        " Light",
        " ExtraLight",
        " UltraLight",
        " Medium",
        " ExtraBold",
        " Black",
        " Heavy",
        " Thin",
        " Narrow",
        " Condensed",
    ];

    let mut results = Vec::new();
    for part in cleaned.split('&') {
        let mut family = part.trim().to_string();
        // Repeatedly strip trailing weight/style words when separated by space
        loop {
            let mut stripped = false;
            for suffix in &style_suffixes {
                if family.len() > suffix.len()
                    && family[family.len() - suffix.len()..].eq_ignore_ascii_case(suffix)
                {
                    let next_len = family.len() - suffix.len();
                    family.truncate(next_len);
                    family = family.trim().to_string();
                    stripped = true;
                    break;
                }
            }
            if !stripped {
                break;
            }
        }
        if !family.is_empty() && !family.starts_with('@') {
            results.push(family);
        }
    }
    results
}

fn read_u16_be(bytes: &[u8], offset: usize) -> Option<u16> {
    let slice = bytes.get(offset..offset + 2)?;
    Some(u16::from_be_bytes([slice[0], slice[1]]))
}

fn read_u32_be(bytes: &[u8], offset: usize) -> Option<u32> {
    let slice = bytes.get(offset..offset + 4)?;
    Some(u32::from_be_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn decode_utf16_be(bytes: &[u8]) -> Option<String> {
    if bytes.len() < 2 || bytes.len() % 2 != 0 {
        return None;
    }
    let units: Vec<u16> = bytes
        .chunks_exact(2)
        .map(|c| u16::from_be_bytes([c[0], c[1]]))
        .collect();
    let s = String::from_utf16(&units).ok()?;
    let trimmed = s.trim_matches('\0').trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

/// Parses OpenType/TrueType `name` table from a single SFNT offset inside a font file.
fn parse_sfnt_family_at_offset(file: &mut File, sfnt_offset: u64) -> Option<String> {
    file.seek(SeekFrom::Start(sfnt_offset)).ok()?;
    let mut header = [0u8; 12];
    file.read_exact(&mut header).ok()?;

    let sfnt_tag = &header[0..4];
    let valid_sfnt = sfnt_tag == [0x00, 0x01, 0x00, 0x00]
        || sfnt_tag == b"OTTO"
        || sfnt_tag == b"true"
        || sfnt_tag == b"typ1";
    if !valid_sfnt {
        return None;
    }

    let num_tables = u16::from_be_bytes([header[4], header[5]]) as usize;
    if num_tables == 0 || num_tables > 128 {
        return None;
    }

    let mut dir_buf = vec![0u8; num_tables * 16];
    file.read_exact(&mut dir_buf).ok()?;

    let mut name_table_offset = 0u64;
    let mut name_table_length = 0usize;

    for i in 0..num_tables {
        let base = i * 16;
        if &dir_buf[base..base + 4] == b"name" {
            name_table_offset = read_u32_be(&dir_buf, base + 8)? as u64;
            name_table_length = read_u32_be(&dir_buf, base + 12)? as usize;
            break;
        }
    }

    if name_table_offset == 0 || name_table_length < 6 || name_table_length > 1_048_576 {
        return None;
    }

    file.seek(SeekFrom::Start(name_table_offset)).ok()?;
    let mut name_buf = vec![0u8; name_table_length];
    file.read_exact(&mut name_buf).ok()?;

    let count = read_u16_be(&name_buf, 2)? as usize;
    let string_offset = read_u16_be(&name_buf, 4)? as usize;
    if string_offset >= name_buf.len() {
        return None;
    }

    let mut best_typographic_en: Option<String> = None;
    let mut best_typographic_any: Option<String> = None;
    let mut best_family_en: Option<String> = None;
    let mut best_family_any: Option<String> = None;

    for i in 0..count.min(256) {
        let rec = 6 + i * 12;
        if rec + 12 > string_offset {
            break;
        }
        let platform_id = read_u16_be(&name_buf, rec)?;
        let encoding_id = read_u16_be(&name_buf, rec + 2)?;
        let language_id = read_u16_be(&name_buf, rec + 4)?;
        let name_id = read_u16_be(&name_buf, rec + 6)?;
        let length = read_u16_be(&name_buf, rec + 8)? as usize;
        let offset = read_u16_be(&name_buf, rec + 10)? as usize;

        if name_id != 1 && name_id != 16 {
            continue;
        }
        let start = string_offset.saturating_add(offset);
        let end = start.saturating_add(length);
        let raw_str = name_buf.get(start..end)?;

        let decoded = if platform_id == 3 || platform_id == 0 {
            decode_utf16_be(raw_str)
        } else if platform_id == 1 && encoding_id == 0 {
            let s = String::from_utf8_lossy(raw_str).trim().to_string();
            if s.is_empty() { None } else { Some(s) }
        } else {
            None
        };

        let Some(val) = decoded else { continue };
        if val.starts_with('@') {
            continue;
        }

        let is_english = (platform_id == 3 && language_id == 0x0409)
            || (platform_id == 1 && language_id == 0);

        match (name_id, is_english) {
            (16, true) => {
                best_typographic_en = Some(val);
                break;
            }
            (16, false) if best_typographic_any.is_none() => {
                best_typographic_any = Some(val);
            }
            (1, true) if best_family_en.is_none() => {
                best_family_en = Some(val);
            }
            (1, false) if best_family_any.is_none() => {
                best_family_any = Some(val);
            }
            _ => {}
        }
    }

    best_typographic_en
        .or(best_family_en)
        .or(best_typographic_any)
        .or(best_family_any)
}

/// Extracts family name(s) from a `.ttf`, `.otf`, or `.ttc` file cleanly.
pub fn extract_font_families_from_file(path: &Path) -> Vec<String> {
    let mut families = Vec::new();
    let Ok(mut file) = File::open(path) else {
        return families;
    };

    let mut magic = [0u8; 12];
    if file.read_exact(&mut magic).is_err() {
        return families;
    }

    if &magic[0..4] == b"ttcf" {
        let num_fonts = u32::from_be_bytes([magic[8], magic[9], magic[10], magic[11]]) as usize;
        let capped = num_fonts.min(32);
        let mut offsets_buf = vec![0u8; capped * 4];
        if file.read_exact(&mut offsets_buf).is_ok() {
            for i in 0..capped {
                if let Some(off) = read_u32_be(&offsets_buf, i * 4) {
                    if let Some(fam) = parse_sfnt_family_at_offset(&mut file, off as u64) {
                        families.push(fam);
                    }
                }
            }
        }
    } else if let Some(fam) = parse_sfnt_family_at_offset(&mut file, 0) {
        families.push(fam);
    }

    families
}

fn scan_font_dir(dir: &Path, seen_lower: &mut HashSet<String>, out: &mut Vec<String>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_font_dir(&path, seen_lower, out);
            continue;
        }
        let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
            continue;
        };
        let ext_lower = ext.to_lowercase();
        if matches!(ext_lower.as_str(), "ttf" | "otf" | "ttc" | "otc") {
            for fam in extract_font_families_from_file(&path) {
                push_unique_family(seen_lower, out, &fam);
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn query_windows_registry_fonts(
    reg_key: &str,
    seen_lower: &mut HashSet<String>,
    out: &mut Vec<String>,
    extra_font_files: &mut Vec<PathBuf>,
) {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    let Ok(output) = Command::new("reg")
        .args(["query", reg_key])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    else {
        return;
    };
    if !output.status.success() {
        return;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("HKEY_") {
            continue;
        }
        // Format: "    Arial (TrueType)    REG_SZ    arial.ttf"
        if let Some((left, right)) = trimmed.split_once("REG_SZ") {
            let display_name = left.trim();
            let file_val = right.trim();
            if !file_val.is_empty() {
                let p = PathBuf::from(file_val);
                if p.is_absolute() && p.exists() {
                    extra_font_files.push(p);
                }
            }
            for cand in clean_windows_registry_font_name(display_name) {
                push_unique_family(seen_lower, out, &cand);
            }
        }
    }
}

#[tauri::command]
pub fn get_system_fonts() -> Result<Vec<SystemFontEntry>, String> {
    let mut seen_lower: HashSet<String> = HashSet::new();
    let mut families: Vec<String> = Vec::new();

    #[cfg(target_os = "windows")]
    {
        let mut extra_files: Vec<PathBuf> = Vec::new();

        // 1. Scan system and user font directories directly using SFNT OpenType name parser
        if let Ok(windir) = std::env::var("WINDIR") {
            scan_font_dir(
                &PathBuf::from(windir).join("Fonts"),
                &mut seen_lower,
                &mut families,
            );
        } else {
            scan_font_dir(Path::new(r"C:\Windows\Fonts"), &mut seen_lower, &mut families);
        }

        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            scan_font_dir(
                &PathBuf::from(local_app_data)
                    .join("Microsoft")
                    .join("Windows")
                    .join("Fonts"),
                &mut seen_lower,
                &mut families,
            );
        }

        // 2. Query HKLM & HKCU Registry for any additional or linked font paths
        query_windows_registry_fonts(
            r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts",
            &mut seen_lower,
            &mut families,
            &mut extra_files,
        );
        query_windows_registry_fonts(
            r"HKCU\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts",
            &mut seen_lower,
            &mut families,
            &mut extra_files,
        );

        for file_path in extra_files {
            for fam in extract_font_families_from_file(&file_path) {
                push_unique_family(&mut seen_lower, &mut families, &fam);
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut dirs: Vec<PathBuf> = Vec::new();
        #[cfg(target_os = "macos")]
        {
            dirs.push(PathBuf::from("/System/Library/Fonts"));
            dirs.push(PathBuf::from("/Library/Fonts"));
            if let Ok(home) = std::env::var("HOME") {
                dirs.push(PathBuf::from(home).join("Library").join("Fonts"));
            }
        }
        #[cfg(target_os = "linux")]
        {
            dirs.push(PathBuf::from("/usr/share/fonts"));
            dirs.push(PathBuf::from("/usr/local/share/fonts"));
            if let Ok(home) = std::env::var("HOME") {
                dirs.push(PathBuf::from(home).join(".local").join("share").join("fonts"));
                dirs.push(PathBuf::from(home).join(".fonts"));
            }
        }
        for dir in dirs {
            scan_font_dir(&dir, &mut seen_lower, &mut families);
        }
    }

    families.sort_by_key(|a| a.to_lowercase());
    Ok(families
        .into_iter()
        .map(|family| SystemFontEntry { family })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_windows_registry_font_name() {
        assert_eq!(
            clean_windows_registry_font_name("Arial Bold Italic (TrueType)"),
            vec!["Arial"]
        );
        assert_eq!(
            clean_windows_registry_font_name(
                "Yu Gothic Bold & Yu Gothic UI Semibold (TrueType)"
            ),
            vec!["Yu Gothic", "Yu Gothic UI"]
        );
        assert_eq!(
            clean_windows_registry_font_name("Dela Gothic One Regular (OpenType)"),
            vec!["Dela Gothic One"]
        );
        assert_eq!(
            clean_windows_registry_font_name("@MS Gothic (TrueType)"),
            Vec::<String>::new()
        );
    }

    #[test]
    fn test_get_system_fonts_executes_cleanly() {
        let fonts = get_system_fonts().expect("get_system_fonts should succeed");
        // On any Windows/macOS/Linux host with desktop fonts, should return fonts cleanly without duplicates
        let mut unique = HashSet::new();
        for f in &fonts {
            assert!(!f.family.is_empty());
            assert!(unique.insert(f.family.to_lowercase()));
        }
        #[cfg(target_os = "windows")]
        assert!(
            !fonts.is_empty(),
            "Windows host should discover installed fonts"
        );
    }
}

