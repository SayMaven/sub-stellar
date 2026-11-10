use serde::{Deserialize, Serialize};

pub mod ytdl;
pub mod lyrics_proxy;
pub mod ffmpeg;
pub mod project_io;

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub app_version: String,
    pub os_name: String,
    pub arch: String,
}

pub use ffmpeg::HardwareCapabilities;

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os_name: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_system_info() {
        let info = get_system_info().expect("system info should succeed");
        assert!(!info.app_version.is_empty());
        assert!(!info.os_name.is_empty());
        assert!(!info.arch.is_empty());
    }
}
