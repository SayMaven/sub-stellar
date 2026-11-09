# API & IPC Documentation: SubStellar

Dokumen ini mendefinisikan antarmuka komunikasi antara **Frontend React 19** dan **Backend Tauri v2 (Rust)** melalui mekanisme Inter-Process Communication (IPC).

---

## 1. Overview Arsitektur IPC

Semua panggilan native dari frontend dibungkus rapi di dalam service `src/services/tauriBridge.ts`.
Frontend menggunakan `invoke()` untuk permintaan *request-response* dan mendengarkan `listen()` untuk event asinkronus (seperti progres download dan render).

---

## 2. Command Modul YouTube (`src-tauri/src/commands/ytdl.rs`)

### 2.1 `ytdl_get_info`
Mendapatkan metadata ringkas video tanpa mengunduh file media.

* **Signature (Rust):**
  ```rust
  #[tauri::command]
  pub async fn ytdl_get_info(url: String) -> Result<YouTubeMetadata, String>
  ```
* **Payload Request:**
  ```typescript
  await invoke<YouTubeMetadata>('ytdl_get_info', { url: 'https://youtube.com/watch?v=...' });
  ```
* **Payload Response (`YouTubeMetadata`):**
  ```typescript
  export interface YouTubeMetadata {
    id: string;
    title: string;
    channel: string;
    durationSeconds: number;
    thumbnailUrl: string;
    formats: {
      formatId: string;
      resolution: string; // "1080p", "720p", "audio-only"
      filesizeApprox: number;
    }[];
  }
  ```

### 2.2 `ytdl_download_media`
Mengunduh video atau audio ke direktori cache lokal aplikasi.

* **Signature (Rust):**
  ```rust
  #[tauri::command]
  pub async fn ytdl_download_media(
    app: tauri::AppHandle,
    url: String,
    formatId: String,
    targetType: String // "video" | "audio"
  ) -> Result<String, String> // Mengembalikan path lokal file tersimpan
  ```
* **Event Stream (`ytdl-progress`):**
  ```typescript
  export interface DownloadProgressEvent {
    url: string;
    percent: number;      // 0.0 - 100.0
    speedBytesPerSec: number;
    etaSeconds: number;
  }
  ```

---

## 3. Command Modul FFmpeg & Ekspor (`src-tauri/src/commands/ffmpeg.rs`)

### 3.1 `ffmpeg_probe_hardware`
Mendeteksi encoder GPU yang didukung oleh komputer pengguna.

* **Signature (Rust):**
  ```rust
  #[tauri::command]
  pub async fn ffmpeg_probe_hardware() -> Result<HardwareEncoderInfo, String>
  ```
* **Payload Response:**
  ```typescript
  export interface HardwareEncoderInfo {
    activeEncoder: 'h264_nvenc' | 'h264_qsv' | 'h264_amf' | 'libx264';
    vendor: 'NVIDIA' | 'Intel' | 'AMD' | 'CPU';
    isHardwareAccelerated: boolean;
  }
  ```

### 3.2 `ffmpeg_start_export_pipe`
Membuka proses child FFmpeg dengan standard input pipe (`stdin`) untuk menerima raw frame buffer.

* **Signature (Rust):**
  ```rust
  #[tauri::command]
  pub async fn ffmpeg_start_export_pipe(
    app: tauri::AppHandle,
    config: ExportSessionConfig
  ) -> Result<String, String> // Mengembalikan session_id
  ```

### 3.3 `ffmpeg_write_frame_chunk`
Mengirimkan buffer byte frame RGBA mentah dari canvas ke stdin pipe.

* **Signature (Rust):**
  ```rust
  #[tauri::command]
  pub async fn ffmpeg_write_frame_chunk(
    sessionId: String,
    frameIndex: u32,
    rgbaBuffer: Vec<u8>
  ) -> Result<(), String>
  ```

---

## 4. Command Sistem File & Proyek (`src-tauri/src/commands/fs_ops.rs`)

### 4.1 `fs_save_project`
Menyimpan seluruh state proyek SubStellar ke file biner/JSON terkompresi `.substellar`.

* **Signature (Rust):**
  ```rust
  #[tauri::command]
  pub async fn fs_save_project(path: String, projectDataJson: String) -> Result<(), String>
  ```

### 4.2 `fs_load_project`
Membuka dan memvalidasi file proyek `.substellar`.

* **Signature (Rust):**
  ```rust
  #[tauri::command]
  pub async fn fs_load_project(path: String) -> Result<String, String>
  ```

---

## 5. Command Proxy Lirik Anti-CORS (`src-tauri/src/commands/lyrics_proxy.rs`)

### 5.1 `lyrics_http_get`
Menjalankan request HTTP GET dari backend native Rust ke endpoint NetEase, QQ Music, atau LRCLIB untuk menghindari pembatasan CORS browser.

* **Signature (Rust):**
  ```rust
  #[tauri::command]
  pub async fn lyrics_http_get(url: String, headers: HashMap<String, String>) -> Result<String, String>
  ```

