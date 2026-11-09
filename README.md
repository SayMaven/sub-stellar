<div align="center">

# SubStellar

### Next-Generation Animated & Particle Subtitle Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2.2-24C8D8?logo=tauri&logoColor=white)](https://tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PixiJS v8](https://img.shields.io/badge/PixiJS-v8.6-E72264?logo=pixijs&logoColor=white)](https://pixijs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Platform: Windows | macOS | Linux](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#)
[![Performance](https://img.shields.io/badge/Low--End%20Ready-RAM%20%3C%20120MB%20%7C%2060%20FPS-success)](#)

*Software desktop profesional untuk pembuatan subtitle video tingkat lanjut dengan efek partikel kosmik, pendaran glow, Furigana otomatis, dan integrasi YouTube 1-klik, dibalut desain visual Gatefold yang elegan.*

[Fitur Utama](#fitur-utama) • [Tech Stack](#tech-stack) • [Panduan Pengguna](#panduan-pengguna) • [Shortcut Keyboard](#shortcut-keyboard) • [Dokumentasi](#dokumentasi-lengkap)

</div>

---

## Mengapa SubStellar?

Membuat video lirik lagu beranimasi estetik saat ini terpecah di dua kutub ekstrem:
* **Terlalu Sulit:** Software subtitle klasik (**Aegisub**) membutuhkan keahlian script Lua rumit (`kara-templater` / `PyonFX`).
* **Terlalu Kaku & Berat:** Editor mainstream (**CapCut / Premiere / After Effects**) tidak memiliki dukungan bawaan untuk Furigana (bacaan hiragana di atas kanji), boros RAM (sering memakan 16GB+), dan lambat untuk sinkronisasi lirik manual per kata.

**SubStellar** hadir sebagai solusi seimbang: **Semudah 1-klik di CapCut, seindah efek partikel di After Effects, seringan Aegisub**—bahkan dapat berjalan mulus (60 FPS konstan) di laptop low-end dengan RAM 4 GB dan Intel HD Graphics.

---

## Fitur Utama

- **1-Klik Integrasi YouTube:** Cukup tempel tautan video YouTube; sistem mengunduh video/audio dan mengekstrak thumbnail secara otomatis tanpa perlu Google API Key.
- **Multi-Source Synced Lyrics:** Pencarian lirik otomatis dari 5 database online (LRCLIB, NetEase Cloud Music, QQ Music, Kugou, Musixmatch) dengan sinkronisasi suku kata (*word-level timing*).
- **Furigana / Ruby Text Otomatis:** Tokenisasi kanji Jepang otomatis ke bacaan Hiragana menggunakan NLP Kuroshiro + Kuromoji, dilengkapi editor klik-untuk-koreksi manual `{漢字|かんじ}`.
- **Real-Time Particle Engine (PixiJS v8):** Ribuan partikel bintang (*stardust*), kilau (*sparkles*), dan aura kosmik yang meletup mengikuti ketukan vokal lirik pada 60 FPS stabil.
- **Estetika Gatefold & Ambient Dynamic Palette:** Antarmuka gelap obsidian elegan dengan pencahayaan latar (*aurora backlight*) yang warnanya beradaptasi secara dinamis dari poster album/video via OKLCH.
- **Waveform Timeline Presisi:** Navigasi audio dengan visualisasi waveform instan yang diproses di background Web Worker tanpa pernah membekukan (*freeze*) antarmuka.
- **Ekspor Fleksibel (FFmpeg):**
  - **Burn-in Video (MP4):** Video langsung jadi dengan hardware acceleration (`NVENC` / `QSV` / `AMF` / `CPU`).
  - **Transparent Alpha Video (WebM VP9 & ProRes 4444):** Hanya subtitle dan partikel berlatar belakang transparan untuk di-*overlay* ke Premiere Pro, DaVinci Resolve, atau CapCut PC.
  - **Format Standar:** Ekspor ke format script `.ass` dan `.lrc`.
- **Dioptimalkan untuk Hardware Low-End:** RAM idle < 120MB, Zero-GC Object Pooling, dan auto-fallback CPU hemat daya.

---

## Tech Stack

| Lapisan | Pilihan Teknologi | Peran |
| :--- | :--- | :--- |
| **Desktop Shell** | **Tauri v2 (Rust 1.94+)** | Runtime ringan (~40MB RAM awal), native IPC kencang, sidecar security sandbox. |
| **Frontend** | **React 19 + TypeScript (Strict)** | UI deklaratif, state orchestration, strict null safety. |
| **Rendering Canvas** | **PixiJS v8 (WebGPU / WebGL)** | Engine partikel `ParticleContainer`, multi-stroke text, dan glow shaders. |
| **Desain & Theming** | **Tailwind CSS + Gatefold CSS Engine** | Token variabel CSS `@property` interpolasi warna OKLCH. |
| **State Management**| **Zustand (Transient Updates)** | Sinkronisasi timecode audio 60 FPS tanpa re-render pohon React. |
| **Media Processing** | **FFmpeg (Tauri Sidecar)** | Ekstraksi waveform, hardware encoding, zero-disk I/O render pipe. |
| **Downloader** | **yt-dlp (Sidecar) + Innertube API** | Scraping dan ekstraksi media YouTube. |
| **NLP Morfologi** | **Kuroshiro + Kuromoji** | Deteksi kanji offline & Furigana generator. |

---

## Memulai (Quick Start)

### Prasyarat Sistem
* [Node.js](https://nodejs.org/) v20+ atau v24+
* [Rust & Cargo](https://rustup.rs/) v1.80+ (v1.94 direkomendasikan)
* Git

### Instalasi & Mode Pengembangan

```bash
# 1. Kloning repositori
git clone https://github.com/SayMaven/sub-stellar.git
cd sub-stellar

# 2. Install dependensi frontend
npm install

# 3. Jalankan aplikasi dalam mode pengembangan desktop (Tauri v2)
npm run tauri dev
```

### Build Installer Produksi

```bash
# Build paket installer Windows (.msi / .exe)
npm run tauri build
```

---

## Shortcut Keyboard

| Tombol | Fungsi |
| :--- | :--- |
| **`Space`** | Putar / Jeda Audio (Play/Pause) |
| **`←` / `→`** | Mundur / Maju 1 frame sub-detik |
| **`Shift + ← / →`** | Mundur / Maju 1 detik |
| **`↑` / `↓`** | Pindah ke baris lirik Sebelumnya / Berikutnya |
| **`C` / `Ctrl + K`** | Potong kata / suku kata pada posisi kursor |
| **`L`** | Aktifkan / Nonaktifkan loop pemutaran baris aktif |
| **`Ctrl + F`** | Buka Quick Search / Tempel URL YouTube |
| **`Ctrl + S`** | Simpan Proyek (`.substellar`) |
| **`Ctrl + E`** | Buka Dialog Ekspor Video |
| **`Ctrl + Z` / `Ctrl + Shift + Z`** | Undo / Redo |
| **`Ctrl + Q`** | Ganti Mode Performa (Low / Balanced / Ultra) |
| **`Ctrl + Shift + D`** | Buka Telemetri Monitor (FPS, RAM, Partikel) |

---

## Dokumentasi Lengkap

Untuk panduan mendalam dan spesifikasi arsitektur teknis, silakan merujuk ke direktori `docs/`:

* [Product Requirements Document (PRD)](docs/PRD.md): Analisis kebutuhan fungsional & non-fungsional, personas, kompetitor, dan KPI.
* [Master Plan Teknis](docs/MASTER_PLAN.md): Rencana peta jalan menyeluruh fase 1 s/d 6.
* [Software Architecture Design](docs/ARCHITECTURE.md): Desain modular micro-kernel, diagram alur data, dan justifikasi teknologi.
* [Code Quality & Engineering Practices](docs/ENGINEERING_PRACTICES.md): Standar coding, prinsip SOLID, konvensi commit, dan git flow.
* [Testing & Quality Assurance Plan](docs/TESTING.md): Unit test, E2E Playwright, zero-GC memory leak test, dan CI matrix.
* [Security Architecture & Threat Mitigation](docs/SECURITY.md): Tauri capabilities, sandboxing, input sanitization, dan code signing.
* [Performance & Optimization Guide](docs/PERFORMANCE.md): Panduan 60 FPS, downsampling waveform off-thread, dan optimasi low-end.
* [UI/UX & Accessibility Design Guide](docs/UI_UX.md): Panduan sistem desain Gatefold, aksesibilitas WCAG, dan lokalisasi i18n.
* [Architecture Decision Records (ADR)](docs/adr/): Catatan keputusan penting arsitektural.
* [User Manual & Help Center](docs/USER_MANUAL.md): Panduan langkah demi langkah bagi pengguna.
* [API & IPC Documentation](docs/API.md): Dokumentasi command Tauri Rust dan interface TypeScript.

---

## Lisensi & Penghargaan

Proyek ini dilisensikan di bawah [MIT License](LICENSE).

**Penghargaan Khusus & Inspirasi:**
* **[Gatefold](https://github.com/SayMaven/gatefold-foobar2000):** Inspirasi bahasa desain tema modern OKLCH dan arsitektur pencarian lirik multi-source.
* **[PixiJS](https://pixijs.com):** Engine rendering 2D WebGL/WebGPU performa tinggi.
* **[Tauri](https://tauri.app):** Framework desktop masa depan yang ringan dan aman.
* **[Kuroshiro & Kuromoji](https://github.com/hexenq/kuroshiro):** Engine morfologi bahasa Jepang di web browser.
