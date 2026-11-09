use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub app_version: String,
    pub os_name: String,
    pub arch: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HardwareCapabilities {
    pub gpu_accelerated: bool,
    pub recommended_quality: String,
    pub available_encoders: Vec<String>,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os_name: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    })
}

#[tauri::command]
pub fn probe_hardware_capabilities() -> Result<HardwareCapabilities, String> {
    // Basic probe for phase 1; will be expanded with actual FFmpeg nvenc/qsv/amf probe in phase 6
    Ok(HardwareCapabilities {
        gpu_accelerated: true,
        recommended_quality: "balanced".to_string(),
        available_encoders: vec!["libx264".to_string()],
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

    #[test]
    fn test_probe_hardware_capabilities() {
        let caps = probe_hardware_capabilities().expect("caps should succeed");
        assert!(caps.gpu_accelerated);
        assert_eq!(caps.recommended_quality, "balanced");
        assert!(!caps.available_encoders.is_empty());
    }
}
