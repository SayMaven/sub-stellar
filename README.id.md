<div align="center">

# SubStellar

### Studio Subtitle Animasi & Partikel Generasi Berikutnya

**[English](README.md)** • **[Bahasa Indonesia](README.id.md)** • **[日本語](README.ja.md)** • **[简体中文](README.zh-CN.md)**

[![License: MIT OR Apache-2.0](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2.2-24C8D8?logo=tauri&logoColor=white)](https://tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PixiJS v8](https://img.shields.io/badge/PixiJS-v8.6-E72264?logo=pixijs&logoColor=white)](https://pixijs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Platform: Windows | macOS | Linux](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#)
[![Performance](https://img.shields.io/badge/Low--End%20Ready-RAM%20%3C%20120MB%20%7C%2060%20FPS-success)](#)

*Software desktop profesional untuk pembuatan subtitle & video lirik tingkat lanjut dengan efek partikel kosmik, pendaran glow berlapis, Furigana otomatis, sinkronisasi vokal per-kata/per-huruf, dan integrasi YouTube 1-klik, dibalut desain visual Gatefold yang elegan.*

[Fitur Utama](#fitur-utama) • [Tech Stack](#tech-stack) • [Memulai Cepat](#memulai-quick-start) • [Shortcut Keyboard](#shortcut-keyboard) • [Lisensi](#lisensi--penghargaan)

</div>

---

## Mengapa SubStellar?

Membuat video lirik lagu beranimasi estetik saat ini terpecah di dua kutub ekstrem:
* **Terlalu Sulit:** Software subtitle klasik (**Aegisub**) membutuhkan keahlian script Lua rumit (`kara-templater` / `PyonFX`).
* **Terlalu Kaku & Berat:** Editor mainstream (**CapCut / Premiere / After Effects**) tidak memiliki dukungan bawaan untuk Furigana (bacaan hiragana di atas kanji), boros RAM (sering memakan 16 GB+), dan lambat untuk sinkronisasi lirik manual per kata.

**SubStellar** hadir sebagai solusi seimbang: **Semudah 1-klik di CapCut, seindah efek partikel di After Effects, seringan Aegisub**—bahkan dapat berjalan mulus (60 FPS konstan) di laptop low-end dengan RAM 4 GB dan Intel HD Graphics.

---

## Fitur Utama

- **1-Klik Unduh Video & Audio YouTube (`yt-dlp`):** Cukup tempel tautan YouTube, pilih resolusi video (`360p` hingga `4K`) atau ekstrak audio saja, lalu unduh langsung ke dalam studio lengkap dengan ekstraksi thumbnail & palet warna otomatis tanpa perlu Google API Key.
- **Multi-Source Synced Lyrics:** Pencarian lirik otomatis dari 5 database online (LRCLIB, NetEase Cloud Music, QQ Music, Kugou, Musixmatch) serta impor file lokal `.lrc` dan `.srt`.
- **Kontrol Vocal Timing Per-Kata & Per-Huruf Presisi Tinggi:**
  - Deteksi otomatis per-kata dan karakter CJK (Jepang/Mandarin).
  - **Pisah & Gabung Kata/Huruf:** Pecah kata menjadi per-huruf (`Split to Chars` / `All Chars`) atau gabungkan huruf/tanda baca bersebelahan (`← Merge Left` / `Merge Right →`).
  - **Matikan Animasi per Area Kata:** Nonaktifkan animasi vokal pada kata atau tanda baca tertentu (`Anim: OFF (Static)`) agar area tersebut tetap diam tanpa memicu lompatan atau partikel.
  - **Gaya Transisi Antar-Kata:** Pilihan animasi **Pop Bounce**, **Karaoke Sweep**, dan **Vocal Float** dengan durasi transisi (`0ms–500ms`) serta pembatas kata yang bisa digeser langsung di atas waveform timeline.
- **Furigana / Ruby Text & Terjemahan Baris Kedua:** Dukungan sintaks `{漢字|かんじ}` dengan editor visual klik-untuk-edit serta teks terjemahan sekunder yang tampil bersamaan.
- **Real-Time Particle Engine Zero-GC (PixiJS v8):** Partikel bintang (*stardust*), kelopak sakura, dan bara kosmik yang meletup mengikuti ketukan vokal pada 60 FPS stabil tanpa kebocoran memori (RAM leak).
- **Kustomisasi Warna, Gradasi & Posisi X/Y Tanpa Batas:** Atur warna isi, warna kata aktif, warna gradasi, ketebalan stroke ganda, anchor vertikal (`Bottom` / `Center` / `Top`), serta posisi `X/Y Offset` bebas menggunakan slider maupun input angka langsung.
- **Layout Gatefold & Sidebar Kanan Resizable:** Antarmuka gelap obsidian dengan menu bar editor klasik (`File`, `Subtitle`, `View`, `Export`), timeline multi-lane anti-tumpuk, serta pembatas antara preview video dan sidebar tool kanan yang bisa digeser-geser ukurannya.
- **Simpan Proyek Native & Render Video Hardware (FFmpeg):**
  - Simpan dan buka file proyek `.substellar` melalui jendela Windows Explorer (`Save` / `Save As` / `Open`), dilengkapi pemulihan otomatis proyek dan video terakhir saat aplikasi dibuka kembali.
  - **Render Video Penuh (`.mp4`, `.webm`, `.mov`):** Menggabungkan animasi subtitle & partikel langsung di atas video sumber beserta audionya melalui RGBA Frame Pipe maupun Fast Hardware ASS Burn-in (`NVENC` / `QSV` / `AMF` / `libx264`).
  - **Ekspor Subtitle Jelas & Informatif:** Ekspor ke `.ass` dan `.srt` dengan dialog pemilihan lokasi target dan tombol **Buka di Explorer**.

---

## Tech Stack

| Lapisan | Pilihan Teknologi | Peran |
| :--- | :--- | :--- |
| **Desktop Shell** | **Tauri v2 (Rust 1.94+)** | Runtime ringan, dialog file native OS, dan manajemen proses aman. |
| **Frontend** | **React 19 + TypeScript (Strict)** | UI deklaratif studio, strict type safety, dan pemutaran bebas re-render. |
| **Rendering Canvas** | **PixiJS v8 (WebGPU / WebGL)** | Engine subtitle & partikel 60 FPS tanpa alokasi tekstur berulang per frame. |
| **Desain & Theming** | **Tailwind CSS + Gatefold OKLCH** | Sistem warna OKLCH dan ekstraksi palet ambient dinamis. |
| **State Management** | **Zustand** | Sinkronisasi timecode 60 FPS (`getState()` di RAF) tanpa membebani React. |
| **Media Processing** | **FFmpeg (Native / Sidecar)** | Deteksi hardware encoder, overlay compositing video, dan burn-in ASS. |
| **Downloader** | **yt-dlp + Rust Allowlist Proxy** | Pengunduhan video/audio YouTube multi-resolusi dan proxy pencarian lirik. |

---

## Memulai (Quick Start)

### Prasyarat Sistem
* [Node.js](https://nodejs.org/) v20+ atau v24+
* [Rust & Cargo](https://rustup.rs/) v1.80+ (v1.94+ direkomendasikan)
* [FFmpeg](https://ffmpeg.org/) & [yt-dlp](https://github.com/yt-dlp/yt-dlp) tersedia di `PATH` sistem (untuk fitur render video dan unduh YouTube)

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
# Build paket installer desktop (.msi / .exe / .dmg / .AppImage)
npm run tauri build
```

---

## Shortcut Keyboard

| Tombol | Fungsi |
| :--- | :--- |
| **`Space`** | Putar / Jeda Video atau Audio (Play/Pause) |
| **`Ctrl + N`** | Tambah baris subtitle kosong baru pada posisi playhead |
| **`Ctrl + S`** | Simpan Proyek (`.substellar`) |
| **`Ctrl + Shift + S`** | Simpan Proyek Sebagai / Save As (`.substellar`) |
| **`Delete`** | Hapus baris subtitle yang dipilih |
| **`Ctrl + K`** | Buka pengunduh video YouTube |
| **`Ctrl + Q`** | Ganti Mode Performa (`Low` / `Balanced` / `Ultra`) |
| **`Ctrl + Shift + D`** | Tampilkan / Sembunyikan Telemetri Performa (FPS, Frame Time, Partikel) |

---

## Lisensi & Penghargaan

SubStellar dilisensikan secara ganda (*dual-licensed*) di bawah pilihan Anda:

* **[MIT License](LICENSE-MIT)** ([http://opensource.org/licenses/MIT](http://opensource.org/licenses/MIT))
* **[Apache License, Version 2.0](LICENSE-APACHE)** ([http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0))

Lihat berkas [LICENSE](LICENSE) untuk informasi lebih lanjut.

**Penghargaan Khusus & Inspirasi:**
* **[Gatefold](https://github.com/DEVIROYrus/gatefold-foobar2000):** Inspirasi bahasa desain tema modern OKLCH dan arsitektur pencarian lirik multi-source.
* **[PixiJS](https://pixijs.com):** Engine rendering 2D WebGL/WebGPU performa tinggi.
* **[Tauri](https://tauri.app):** Framework desktop lintas-platform yang ringan dan aman.

