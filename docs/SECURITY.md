# Security Architecture & Threat Mitigation: SubStellar

**Document Version:** 1.0.0  
**Status:** Approved Standard  
**Target Repository:** `https://github.com/SayMaven/sub-stellar`  
**Reference Architecture:** Tauri v2 Security Model & OWASP Desktop Security Top 10

---

## 1. Praktik Penulisan Kode Aman (Secure Coding Practices)

### 1.1 Pencegahan Command Injection (Shell Safety)
* **Aturan Mutlak:** Dilarang keras menggabungkan string (*string concatenation/interpolation*) dari input pengguna langsung ke baris perintah shell sistem.
* **Standar Implementasi di Rust (`src-tauri/src/commands/`):**
  Semua eksekusi proses eksternal (FFmpeg & yt-dlp) wajib meneruskan argumen sebagai elemen array terpisah (*vector of arguments*), bukan melalui string shell:
  ```rust
  // BENAR (Aman dari Command Injection):
  let mut cmd = std::process::Command::new(&sidecar_path);
  cmd.args(["-i", &safe_input_path, "-c:v", "libx264", &safe_output_path]);

  // DILARANG KERAS (Rentan Exploit):
  // std::process::Command::new("cmd").arg(format!("/C ffmpeg -i {} ...", raw_user_input));
  ```

### 1.2 Pencegahan Path Traversal & File Sandbox
* Akses file proyek dan media divalidasi menggunakan resolusi path kanonikal (`std::fs::canonicalize`).
* Menolak segala bentuk karakter path melompat (`../`, `..\`) yang berusaha mengakses direktori sensitif sistem (misal: `C:\Windows\System32`).

### 1.3 Content Security Policy (CSP) di WebView2
* Konfigurasi ketat diterapkan pada `tauri.conf.json` untuk mencegah serangan Cross-Site Scripting (XSS):
  ```json
  "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com blob:; media-src 'self' blob: data:; connect-src 'self' https://lrclib.net https://music.163.com https://*.qq.com; font-src 'self' data: https://fonts.gstatic.com;"
  ```
* Evaluasi kode dinamis (`eval()` atau `new Function()`) dinonaktifkan sepenuhnya.

---

## 2. Validasi & Sanitasi Input (Input Validation)

1. **Validasi URL YouTube & Lirik:**
   - Sebelum diteruskan ke sidecar yt-dlp, string URL wajib lolos uji regex yang ketat:
     `^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}`
   - Menolak skema berbahaya seperti `file://`, `javascript:`, atau `data:` pada dialog input unduhan.
2. **Sanitasi File Subtitle (ASS / SRT / LRC):**
   - Parser subtitle membatasi ukuran input file maksimal 15 MB untuk mencegah serangan kehabisan memori (*Buffer Bomb*).
   - Regex parsing dilindungi dari serangan *Regular Expression Denial of Service (ReDoS)* dengan menghindari pola backtracking tak terbatas.

---

## 3. Model Hak Akses Minimal (Tauri v2 Permissions & ACLs)

SubStellar menerapkan prinsip hak istimewa paling rendah (*Principle of Least Privilege*) menggunakan sistem **Capabilities Tauri v2** (`src-tauri/capabilities/default.json`):

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default-capability",
  "description": "Default permissions for SubStellar client",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-execute",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "dialog:allow-open",
    "dialog:allow-save"
  ]
}
```

* **Pembatasan Shell Sidecar:** Izin `shell:allow-execute` dikunci secara eksplisit hanya untuk binary sidecar yang terdaftar (`ffmpeg` dan `yt-dlp`). Webview tidak memiliki akses untuk mengeksekusi sembarang file executable lain di sistem pengguna.
* **Scoped File Access:** Akses tulis sistem file dibatasi pada dialog pemilih folder yang dikonfirmasi langsung oleh pengguna (*user-selected directory*).

---

## 4. Pemindaian Kerentanan Dependensi (Vulnerability Scanning)

Pengecekan keamanan dependensi dijalankan otomatis pada pipeline CI/CD:

1. **Frontend (npm audit):**
   - Setiap build wajib melewati pemeriksaan `npm audit --audit-level=high`.
   - Tidak ada toleransi untuk kerentanan berkategori *High* atau *Critical*.
2. **Backend Rust (cargo audit):**
   - Menjalankan `cargo audit` terhadap basis data *RustSec Advisory Database* untuk memastikan seluruh crate Rust (Tauri, Serde, Tokio, dll.) bebas dari CVE yang diketahui.
3. **Pemberitahuan Otomatis:** Mengaktifkan GitHub Dependabot untuk pembaruan patch keamanan otomatis (*automated security pull requests*).

---

## 5. Perlindungan Data Pengguna (Privacy & Data Protection)

* **100% Pemrosesan Media Lokal:**
  - File video, audio, dan lirik yang diimpor tidak pernah diunggah ke server analitik atau cloud milik SubStellar.
  - SubStellar tidak menyematkan telemetry atau pelacak perilaku pengguna (*zero analytics / tracking trackers*).
* **Penyimpanan Konfigurasi & Cache:**
  - Pengaturan aplikasi dan cache thumbnail disimpan di direktori standar sistem operasi:
    - Windows: `%APPDATA%\SubStellar\`
    - macOS: `~/Library/Application Support/SubStellar/`
    - Linux: `~/.config/substellar/`
  - Pengguna memiliki tombol 1-klik di menu Settings untuk menghapus seluruh cache media dan riwayat unduhan kapan saja.

---

## 6. Penandatanganan Kode (Code Signing)

Penandatanganan kode binary sangat krusial untuk mencegah sistem keamanan OS memblokir aplikasi saat didistribusikan:

### 6.1 Distribusi Windows (Microsoft Authenticode)
* Menggunakan sertifikat digital resmi (*Code Signing Certificate OV/EV*).
* Eksekusi via `signtool.exe` pada file `SubStellar.exe` dan installer `.msi`/`.exe`:
  ```bash
  signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a "path/to/SubStellar-Setup.exe"
  ```
* **Hasil:** Mencegah munculnya peringatan merah yang menakutkan dari **Windows SmartScreen** (*"Windows protected your PC"*).

### 6.2 Distribusi macOS (Apple Developer Notarization)
* Penandatanganan dengan *Developer ID Application Certificate*.
* Proses Notarisasi otomatis via Apple Notary Service (`xcrun notarytool submit`) sebelum file `.dmg` dirilis, sehingga lolos pemeriksaan **macOS Gatekeeper**.

---

## 7. Mekanisme Pembaruan Aplikasi yang Aman (Auto-Updater)

SubStellar menggunakan modul resmi **Tauri Updater Plugin** (`@tauri-apps/plugin-updater`) yang diamankan dengan enkripsi kriptografi:

1. **Verifikasi Tanda Tangan Kriptografis (Minisign):**
   - Setiap file rilis biner ditandatangani menggunakan *Private Key* pengembang secara offline.
   - Public key disematkan di dalam konfigurasi aplikasi (`tauri.conf.json`):
     ```json
     "plugins": {
       "updater": {
         "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk..."
       }
     }
     ```
   - Aplikasi akan memverifikasi integritas file biner baru sebelum mengizinkan instalasi. Jika tanda tangan tidak cocok atau file telah dimodifikasi pihak ketiga, pembaruan akan ditolak otomatis.
2. **Koneksi Terenkripsi (TLS 1.3):**
   - Manifest update dan unduhan biner wajib menggunakan endpoint HTTPS resmi GitHub Releases (`https://github.com/SayMaven/sub-stellar/releases/...`).

