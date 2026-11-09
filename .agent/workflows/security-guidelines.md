# Security & Threat Mitigation Guidelines

Mengatur standar baku keamanan kode, penanganan input pengguna, pembatasan hak akses Tauri, dan auto-updater pada repositori **SubStellar**.

---

## 1. Aturan Mutlak Eksekusi Proses (Shell Safety)
* **Dilarang keras** menggabungkan string mentah input pengguna ke perintah shell.
* Di backend Rust, selalu teruskan parameter sebagai array argumen:
  `Command::new(&binary).args([...])`

## 2. Hak Akses Minimal (Tauri v2 Capabilities)
* Izin `shell:allow-execute` dikunci **hanya untuk sidecar `ffmpeg` dan `yt-dlp`**.
* Akses file dibatasi pada direktori yang dipilih secara eksplisit oleh pengguna.

## 3. Sanitasi Input & CSP
* Validasi ketat format URL YouTube menggunakan regex sebelum diteruskan ke downloader.
* Terapkan Content Security Policy (CSP) ketat pada `tauri.conf.json`. Dilarang menggunakan `eval()`.
* Batasi ukuran file subtitle maksimal 15 MB untuk mencegah buffer bomb.

## 4. Perlindungan Data & Privasi
* 100% pemrosesan video dan audio berjalan lokal. Dilarang mengirim data media ke server pihak ketiga.
* Tidak ada telemetri atau pelacak privasi.

## 5. Keamanan Distribusi (Signing & Updater)
* Rilis biner wajib ditandatangani via Authenticode (Windows) dan Notarization (macOS).
* Auto-updater wajib memvalidasi cryptographic signature Minisign dari manifest rilis.

