use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenedProjectFile {
    pub path: String,
    pub contents: String,
}

#[cfg(target_os = "windows")]
mod win_dialog {
    use std::ffi::OsString;
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use std::ptr;

    #[repr(C)]
    struct OPENFILENAMEW {
        l_struct_size: u32,
        hwnd_owner: *mut core::ffi::c_void,
        h_instance: *mut core::ffi::c_void,
        lpstr_filter: *const u16,
        lpstr_custom_filter: *mut u16,
        n_max_cust_filter: u32,
        n_filter_index: u32,
        lpstr_file: *mut u16,
        n_max_file: u32,
        lpstr_file_title: *mut u16,
        n_max_file_title: u32,
        lpstr_initial_dir: *const u16,
        lpstr_title: *const u16,
        flags: u32,
        n_file_offset: u16,
        n_file_extension: u16,
        lpstr_def_ext: *const u16,
        l_cust_data: isize,
        lpfn_hook: *mut core::ffi::c_void,
        lp_template_name: *const u16,
        pv_reserved: *mut core::ffi::c_void,
        dw_reserved: u32,
        flags_ex: u32,
    }

    const OFN_OVERWRITEPROMPT: u32 = 0x00000002;
    const OFN_NOCHANGEDIR: u32 = 0x00000008;
    const OFN_PATHMUSTEXIST: u32 = 0x00000800;
    const OFN_FILEMUSTEXIST: u32 = 0x00001000;
    const OFN_EXPLORER: u32 = 0x00080000;

    #[link(name = "comdlg32")]
    extern "system" {
        fn GetSaveFileNameW(lpofn: *mut OPENFILENAMEW) -> i32;
        fn GetOpenFileNameW(lpofn: *mut OPENFILENAMEW) -> i32;
    }

    fn to_wide_null(s: &str) -> Vec<u16> {
        std::ffi::OsStr::new(s)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    pub fn show_save_project_dialog(default_name: &str) -> Option<String> {
        let filter = "SubStellar Project (*.substellar)\0*.substellar\0JSON Project (*.json)\0*.json\0All Files (*.*)\0*.*\0\0";
        let filter_wide: Vec<u16> = std::ffi::OsStr::new(filter).encode_wide().collect();
        let title_wide = to_wide_null("Save SubStellar Project As");
        let def_ext_wide = to_wide_null("substellar");

        let mut file_buf = vec![0u16; 1024];
        let initial_wide: Vec<u16> = std::ffi::OsStr::new(default_name).encode_wide().collect();
        let copy_len = initial_wide.len().min(file_buf.len() - 1);
        file_buf[..copy_len].copy_from_slice(&initial_wide[..copy_len]);

        let mut ofn = OPENFILENAMEW {
            l_struct_size: std::mem::size_of::<OPENFILENAMEW>() as u32,
            hwnd_owner: ptr::null_mut(),
            h_instance: ptr::null_mut(),
            lpstr_filter: filter_wide.as_ptr(),
            lpstr_custom_filter: ptr::null_mut(),
            n_max_cust_filter: 0,
            n_filter_index: 1,
            lpstr_file: file_buf.as_mut_ptr(),
            n_max_file: file_buf.len() as u32,
            lpstr_file_title: ptr::null_mut(),
            n_max_file_title: 0,
            lpstr_initial_dir: ptr::null(),
            lpstr_title: title_wide.as_ptr(),
            flags: OFN_EXPLORER | OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR,
            n_file_offset: 0,
            n_file_extension: 0,
            lpstr_def_ext: def_ext_wide.as_ptr(),
            l_cust_data: 0,
            lpfn_hook: ptr::null_mut(),
            lp_template_name: ptr::null(),
            pv_reserved: ptr::null_mut(),
            dw_reserved: 0,
            flags_ex: 0,
        };

        let ok = unsafe { GetSaveFileNameW(&mut ofn) };
        if ok != 0 {
            let end = file_buf.iter().position(|&c| c == 0).unwrap_or(file_buf.len());
            let path = OsString::from_wide(&file_buf[..end])
                .to_string_lossy()
                .into_owned();
            Some(path)
        } else {
            None
        }
    }

    pub fn show_open_project_dialog() -> Option<String> {
        let filter = "SubStellar Project (*.substellar;*.json)\0*.substellar;*.json\0All Files (*.*)\0*.*\0\0";
        let filter_wide: Vec<u16> = std::ffi::OsStr::new(filter).encode_wide().collect();
        let title_wide = to_wide_null("Open SubStellar Project");
        let def_ext_wide = to_wide_null("substellar");

        let mut file_buf = vec![0u16; 1024];

        let mut ofn = OPENFILENAMEW {
            l_struct_size: std::mem::size_of::<OPENFILENAMEW>() as u32,
            hwnd_owner: ptr::null_mut(),
            h_instance: ptr::null_mut(),
            lpstr_filter: filter_wide.as_ptr(),
            lpstr_custom_filter: ptr::null_mut(),
            n_max_cust_filter: 0,
            n_filter_index: 1,
            lpstr_file: file_buf.as_mut_ptr(),
            n_max_file: file_buf.len() as u32,
            lpstr_file_title: ptr::null_mut(),
            n_max_file_title: 0,
            lpstr_initial_dir: ptr::null(),
            lpstr_title: title_wide.as_ptr(),
            flags: OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR,
            n_file_offset: 0,
            n_file_extension: 0,
            lpstr_def_ext: def_ext_wide.as_ptr(),
            l_cust_data: 0,
            lpfn_hook: ptr::null_mut(),
            lp_template_name: ptr::null(),
            pv_reserved: ptr::null_mut(),
            dw_reserved: 0,
            flags_ex: 0,
        };

        let ok = unsafe { GetOpenFileNameW(&mut ofn) };
        if ok != 0 {
            let end = file_buf.iter().position(|&c| c == 0).unwrap_or(file_buf.len());
            let path = OsString::from_wide(&file_buf[..end])
                .to_string_lossy()
                .into_owned();
            Some(path)
        } else {
            None
        }
    }

    pub fn show_open_media_dialog() -> Option<String> {
        let filter = "Video & Audio Files (*.mp4;*.webm;*.mkv;*.mov;*.mp3;*.wav;*.flac;*.ogg;*.m4a)\0*.mp4;*.webm;*.mkv;*.mov;*.mp3;*.wav;*.flac;*.ogg;*.m4a\0All Files (*.*)\0*.*\0\0";
        let filter_wide: Vec<u16> = std::ffi::OsStr::new(filter).encode_wide().collect();
        let title_wide = to_wide_null("Open Video or Audio File");

        let mut file_buf = vec![0u16; 1024];

        let mut ofn = OPENFILENAMEW {
            l_struct_size: std::mem::size_of::<OPENFILENAMEW>() as u32,
            hwnd_owner: ptr::null_mut(),
            h_instance: ptr::null_mut(),
            lpstr_filter: filter_wide.as_ptr(),
            lpstr_custom_filter: ptr::null_mut(),
            n_max_cust_filter: 0,
            n_filter_index: 1,
            lpstr_file: file_buf.as_mut_ptr(),
            n_max_file: file_buf.len() as u32,
            lpstr_file_title: ptr::null_mut(),
            n_max_file_title: 0,
            lpstr_initial_dir: ptr::null(),
            lpstr_title: title_wide.as_ptr(),
            flags: OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR,
            n_file_offset: 0,
            n_file_extension: 0,
            lpstr_def_ext: ptr::null(),
            l_cust_data: 0,
            lpfn_hook: ptr::null_mut(),
            lp_template_name: ptr::null(),
            pv_reserved: ptr::null_mut(),
            dw_reserved: 0,
            flags_ex: 0,
        };

        let ok = unsafe { GetOpenFileNameW(&mut ofn) };
        if ok != 0 {
            let end = file_buf.iter().position(|&c| c == 0).unwrap_or(file_buf.len());
            let path = OsString::from_wide(&file_buf[..end])
                .to_string_lossy()
                .into_owned();
            Some(path)
        } else {
            None
        }
    }

    pub fn show_save_export_dialog(default_name: &str, ext: &str) -> Option<String> {
        let filter = match ext {
            "ass" => "Advanced SubStation Alpha (*.ass)\0*.ass\0All Files (*.*)\0*.*\0\0",
            "srt" => "SubRip Subtitle (*.srt)\0*.srt\0All Files (*.*)\0*.*\0\0",
            "mp4" => "MP4 Video (*.mp4)\0*.mp4\0All Files (*.*)\0*.*\0\0",
            "webm" => "WebM Transparent Video (*.webm)\0*.webm\0All Files (*.*)\0*.*\0\0",
            "mov" => "Apple ProRes 4444 Video (*.mov)\0*.mov\0All Files (*.*)\0*.*\0\0",
            _ => "All Files (*.*)\0*.*\0\0",
        };
        let filter_wide: Vec<u16> = std::ffi::OsStr::new(filter).encode_wide().collect();
        let title_wide = to_wide_null("Choose Export Save Location");
        let def_ext_wide = to_wide_null(ext);

        let mut file_buf = vec![0u16; 1024];
        let initial_wide: Vec<u16> = std::ffi::OsStr::new(default_name).encode_wide().collect();
        let copy_len = initial_wide.len().min(file_buf.len() - 1);
        file_buf[..copy_len].copy_from_slice(&initial_wide[..copy_len]);

        let mut ofn = OPENFILENAMEW {
            l_struct_size: std::mem::size_of::<OPENFILENAMEW>() as u32,
            hwnd_owner: ptr::null_mut(),
            h_instance: ptr::null_mut(),
            lpstr_filter: filter_wide.as_ptr(),
            lpstr_custom_filter: ptr::null_mut(),
            n_max_cust_filter: 0,
            n_filter_index: 1,
            lpstr_file: file_buf.as_mut_ptr(),
            n_max_file: file_buf.len() as u32,
            lpstr_file_title: ptr::null_mut(),
            n_max_file_title: 0,
            lpstr_initial_dir: ptr::null(),
            lpstr_title: title_wide.as_ptr(),
            flags: OFN_EXPLORER | OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR,
            n_file_offset: 0,
            n_file_extension: 0,
            lpstr_def_ext: def_ext_wide.as_ptr(),
            l_cust_data: 0,
            lpfn_hook: ptr::null_mut(),
            lp_template_name: ptr::null(),
            pv_reserved: ptr::null_mut(),
            dw_reserved: 0,
            flags_ex: 0,
        };

        let ok = unsafe { GetSaveFileNameW(&mut ofn) };
        if ok != 0 {
            let end = file_buf.iter().position(|&c| c == 0).unwrap_or(file_buf.len());
            let path = OsString::from_wide(&file_buf[..end])
                .to_string_lossy()
                .into_owned();
            Some(path)
        } else {
            None
        }
    }
}

#[tauri::command]
pub async fn project_save_dialog(default_name: String) -> Result<Option<String>, String> {
    let safe_default = if default_name.trim().is_empty() {
        "substellar_project.substellar".to_string()
    } else if default_name.ends_with(".substellar") || default_name.ends_with(".json") {
        default_name
    } else {
        format!("{}.substellar", default_name)
    };

    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn_blocking(move || win_dialog::show_save_project_dialog(&safe_default))
            .await
            .map_err(|e| format!("Failed to open save dialog: {}", e))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = safe_default;
        Ok(None)
    }
}

#[tauri::command]
pub async fn project_write_file(path: String, contents: String) -> Result<String, String> {
    let target = PathBuf::from(path.trim());
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
        }
    }
    fs::write(&target, contents.as_bytes())
        .map_err(|e| format!("Failed to write project file {}: {}", target.display(), e))?;
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn project_open_dialog() -> Result<Option<OpenedProjectFile>, String> {
    #[cfg(target_os = "windows")]
    {
        let chosen = tauri::async_runtime::spawn_blocking(win_dialog::show_open_project_dialog)
            .await
            .map_err(|e| format!("Failed to open file dialog: {}", e))?;

        if let Some(path) = chosen {
            let contents = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read project file {}: {}", path, e))?;
            Ok(Some(OpenedProjectFile { path, contents }))
        } else {
            Ok(None)
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

#[tauri::command]
pub async fn media_open_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let chosen = tauri::async_runtime::spawn_blocking(win_dialog::show_open_media_dialog)
            .await
            .map_err(|e| format!("Failed to open media file dialog: {}", e))?;

        if let Some(ref path) = chosen {
            let target = PathBuf::from(path);
            let _ = app.asset_protocol_scope().allow_file(&target);
            if let Some(parent) = target.parent() {
                let _ = app.asset_protocol_scope().allow_directory(parent, false);
            }
        }
        Ok(chosen)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Ok(None)
    }
}

#[tauri::command]
pub fn allow_asset_file(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let target = PathBuf::from(path.trim());
    if !target.exists() {
        return Err(format!("Media file not found on disk: {}", target.display()));
    }
    let _ = app.asset_protocol_scope().allow_file(&target);
    if let Some(parent) = target.parent() {
        let _ = app.asset_protocol_scope().allow_directory(parent, false);
    }
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn read_local_media_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    let target = PathBuf::from(path.trim());
    if !target.exists() {
        return Err(format!("Media file not found on disk: {}", target.display()));
    }
    let bytes = tauri::async_runtime::spawn_blocking(move || fs::read(&target))
        .await
        .map_err(|e| format!("Failed to join media read task: {}", e))?
        .map_err(|e| format!("Failed to read media file: {}", e))?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub async fn export_save_dialog(default_name: String, ext: String) -> Result<Option<String>, String> {
    let clean_ext = ext.trim().trim_start_matches('.').to_lowercase();
    let safe_default = if default_name.trim().is_empty() {
        format!("substellar_export.{}", clean_ext)
    } else if default_name.to_lowercase().ends_with(&format!(".{}", clean_ext)) {
        default_name
    } else {
        format!("{}.{}", default_name, clean_ext)
    };

    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn_blocking(move || {
            win_dialog::show_save_export_dialog(&safe_default, &clean_ext)
        })
        .await
        .map_err(|e| format!("Failed to open export save dialog: {}", e))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (safe_default, clean_ext);
        Ok(None)
    }
}

#[tauri::command]
pub fn reveal_in_explorer(path: String) -> Result<(), String> {
    let target = PathBuf::from(path.trim());
    if !target.exists() {
        return Err(format!("File does not exist: {}", target.display()));
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(format!("/select,{}", target.display()))
            .spawn()
            .map_err(|e| format!("Failed to launch Explorer: {}", e))?;
    }

    Ok(())
}



