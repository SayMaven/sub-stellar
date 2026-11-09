# DevOps, CI/CD & Distribution Strategy: SubStellar

**Document Version:** 1.0.0  
**Status:** Approved Standard  
**Target Repository:** `https://github.com/SayMaven/sub-stellar`  
**Distribution Target:** Windows 10/11 (MSI, NSIS .exe, Portable .zip), macOS (.dmg Universal), Linux (.AppImage, .deb)

---

## 1. Arsitektur Pipeline CI/CD (GitHub Actions)

Alur kerja integrasi dan pengiriman berkelanjutan terbagi menjadi dua pipeline utama:
1. **CI Pipeline (`ci.yml`):** Dijalankan pada setiap *Pull Request* dan *push* ke cabang `main` untuk pengujian statis, unit test, dan verifikasi kompilasi.
2. **Release Pipeline (`release.yml`):** Dipicu secara otomatis ketika tag versi baru dibuat (`v*.*.*`), membangun biner installer untuk Windows, macOS, dan Linux, menandatangani kode (*code signing*), dan mempublikasikan artefak ke **GitHub Releases**.

```
+---------------------------------------------------------------------------------+
|                       GITHUB ACTIONS RELEASE PIPELINE                           |
|                                                                                 |
|   Trigger: Git Tag Push (misal: v1.0.0-beta.1)                                  |
|         │                                                                       |
|         ├── Windows Runner (windows-latest) ➔ NSIS .exe, .msi (Authenticode)    |
|         ├── macOS Runner (macos-latest)     ➔ .dmg (Universal Binary + Notarized)|
|         └── Linux Runner (ubuntu-latest)    ➔ .AppImage, .deb                   |
|         │                                                                       |
|   Minisign Cryptographic Signing ➔ Generate latest.json manifest                |
|         │                                                                       |
|   Publish to GitHub Releases + Auto-Updater CDN                                 |
+---------------------------------------------------------------------------------+
```

---

## 2. Rincian Konfigurasi Build Terotomasi (Multi-Platform Matrix)

Workflow menggunakan aksi resmi `@tauri-apps/tauri-action`:

```yaml
name: Release SubStellar
on:
  push:
    tags:
      - 'v*'

jobs:
  build-substellar:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'windows-latest'
            args: '--target x86_64-pc-windows-msvc'
          - platform: 'macos-latest'
            args: '--target universal-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install Rust Stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Rust Cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install Linux Dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

      - name: Install Frontend Dependencies
        run: npm ci

      - name: Build & Package Tauri App
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          # Windows Code Signing
          WINDOWS_CERTIFICATE_BASE64: ${{ secrets.WINDOWS_CERTIFICATE_BASE64 }}
          WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
          # Apple Notarization
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'SubStellar ${{ github.ref_name }}'
          releaseBody: 'Lihat CHANGELOG.md untuk rincian perubahan versi ini.'
          releaseDraft: false
          prerelease: ${{ contains(github.ref_name, '-alpha') || contains(github.ref_name, '-beta') }}
          args: ${{ matrix.args }}
```

---

## 3. Penandatanganan Kode & Notarisasi (Code Signing & Notarization)

### 3.1 Windows Authenticode
* Sertifikat digital disimpan sebagai Base64 terenkripsi di *GitHub Action Secrets*.
* Runner Windows menjalankan penandatanganan via `signtool.exe` dengan timestamp server DigiCert (SHA-256).
* **Hasil:** Installer `.msi` dan setup `.exe` lolos verifikasi **SmartScreen**, menampilkan nama penerbit terverifikasi (*Verified Publisher*) tanpa popup bahaya.

### 3.2 macOS Developer ID & Notary Service
* Biner dikompilasi ke format **Universal Binary** (berjalan native di Mac Intel x86_64 dan Apple Silicon M1/M2/M3/M4 aarch64).
* Ditandatangani dengan *Developer ID Application Certificate* dan diserahkan ke Apple Notary Service (`notarytool`).
* Tiket notarisasi distempel (*stapled*) ke dalam file `.dmg` agar dapat dibuka langsung oleh **macOS Gatekeeper**.

---

## 4. Infrastruktur Auto-Updater Tanpa Downtime

SubStellar menggunakan plugin resmi `@tauri-apps/plugin-updater`:

1. **Manifest Pembaruan (`latest.json`):**
   - GitHub Action menghasilkan file `latest.json` yang berisi versi terbaru, catatan rilis, tautan unduhan tiap OS, dan tanda tangan digital Minisign:
     ```json
     {
       "version": "1.0.0",
       "notes": "Pembaruan performa dan dukungan efek partikel baru.",
       "pub_date": "2026-11-09T22:00:00Z",
       "platforms": {
         "windows-x86_64": {
           "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
           "url": "https://github.com/SayMaven/sub-stellar/releases/download/v1.0.0/SubStellar_1.0.0_x64-setup.nsis.zip"
         }
       }
     }
     ```
2. **Pengecekan di Aplikasi:**
   - Aplikasi memeriksa update secara senyap (*background check*) saat startup.
   - Jika tersedia versi baru, pill notifikasi halus muncul di header: *"Pembaruan Tersedia (v1.0.0) — [Perbarui Sekarang]"*.
   - Pembaruan diunduh di background, diverifikasi integritasnya via Minisign, dan diterapkan dengan restart instan.

---

## 5. Pelaporan Kerusakan (Crash Reporting) yang Aman & Privat

* **Prinsip Privasi:** SubStellar tidak mengirim data crash secara diam-diam tanpa izin pengguna.
* **Mekanisme Penanganan Crash di Rust:**
  - Mengatur Rust Panic Hook kustom (`std::panic::set_hook`).
  - Saat terjadi *fatal panic*, sistem mencatat *stack backtrace* ke file lokal:
    `%APPDATA%\SubStellar\logs\crash-<timestamp>.log`.
  - Informasi sensitif (seperti path direktori pribadi pengguna atau token) disaring (*redacted*) dari log.
* **Dialog Pemulihan Pengguna (User Recovery Prompt):**
  - Saat aplikasi dibuka kembali setelah crash, muncul dialog ramah:
    > *"SubStellar ditutup secara tidak terduga pada sesi sebelumnya. Apakah Anda ingin menyalin laporan kesalahan untuk dilaporkan ke GitHub Issues?"* $\rightarrow$ `[Buka File Log]` `[Salin Ringkasan]` `[Abaikan]`.

---

## 6. Telemetri & Analitik (100% Opt-In & Privacy-Friendly)

* **Status Bawaan: DINONAKTIFKAN (Default: OFF).**
* Pengguna memiliki kontrol penuh di menu `Settings > Privacy`.
* Jika pengguna secara sukarela mengaktifkan analitik (*opt-in*):
  - Yang dikirim **hanya**: Sistem Operasi (Windows/Mac/Linux), Vendor GPU (Intel/NVIDIA/AMD), dan Pilihan Mode Kualitas (Low/Balanced/Ultra).
  - **Dilarang keras mengumpulkan:** Judul video, nama lagu, isi lirik, nama artis, URL YouTube, alamat IP, atau identitas perangkat unik.

---

## 7. Strategi Siklus Rilis (Release Lifecycle Strategy)

```
[ Alpha Releases (v1.0.0-alpha.x) ]
  ├── Fokus: Fungsionalitas inti, integrasi PixiJS + Tauri + FFmpeg
  └── Target Pengguna: Pengembang internal & kreator AMV tester awal

[ Beta Releases (v1.0.0-beta.x) ]
  ├── Fokus: Feature complete, uji performa laptop low-end, stabilisasi i18n
  └── Target Pengguna: Komunitas publik (feedback lirik & format video)

[ Release Candidates (v1.0.0-rc.x) ]
  ├── Fokus: Code freeze, audit keamanan, penandatanganan kode final
  └── Target Pengguna: Pengujian regresi akhir

[ General Availability / Stable (v1.0.0) ]
  └── Rilis publik resmi di GitHub Releases, winget, dan Homebrew
```

### Saluran Distribusi Tambahan (Masa Depan):
* **Windows:** Windows Package Manager (`winget install SayMaven.SubStellar`) dan Microsoft Store.
* **macOS:** Homebrew Cask (`brew install --cask substellar`).
* **Linux:** Flathub (Flatpak) dan Snapcraft.

