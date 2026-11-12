<div align="center">

# SubStellar

### Next-Generation Animated & Particle Subtitle Studio

**[English](README.md)** • **[Bahasa Indonesia](README.id.md)** • **[日本語](README.ja.md)** • **[简体中文](README.zh-CN.md)**

[![License: MIT OR Apache-2.0](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2.2-24C8D8?logo=tauri&logoColor=white)](https://tauri.app)
[![Rust 1.94+](https://img.shields.io/badge/Rust-1.94%2B-DEA584?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PixiJS v8](https://img.shields.io/badge/PixiJS-v8.6-E72264?logo=pixijs&logoColor=white)](https://pixijs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Platform: Windows | macOS | Linux](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#)
[![Performance](https://img.shields.io/badge/Low--End%20Ready-RAM%20%3C%20120MB%20%7C%2060%20FPS-success)](#)

*A high-performance desktop studio for crafting animated lyric & subtitle videos with cosmic particle effects, double-stroke glow typography, native Japanese Furigana tokenization, per-word vocal synchronization, and 1-click YouTube integration — engineered with a Rust Core and wrapped in an obsidian Gatefold interface.*

[Key Features](#key-features) • [Rust Core Architecture](#rust-core-engine) • [Tech Stack](#tech-stack) • [Quick Start](#quick-start) • [Keyboard Shortcuts](#keyboard-shortcuts) • [License](#license--acknowledgments)

</div>

---

## Why SubStellar?

Creating expressive animated lyric and subtitle videos today usually forces creators into one of two extremes:
* **Too Complex:** Traditional subtitle tools (**Aegisub**) require writing complex Lua automation scripts (`kara-templater` / `PyonFX`) for word animations and particle effects.
* **Too Heavy & Rigid:** Mainstream video editors (**CapCut / Premiere Pro / After Effects**) lack native support for Japanese Furigana (ruby readings above Kanji), consume massive amounts of RAM (often 16 GB+), and make manual per-word vocal timing tedious.

**SubStellar** bridges the gap: **as intuitive as CapCut, as visually expressive as After Effects, and as lightweight as Aegisub**—engineered to maintain a rock-solid 60 FPS even on low-end laptops with 4 GB RAM and integrated Intel HD Graphics.

---

## Key Features

- **High-Performance Rust Core Engine:** Heavy computation tasks (morphological tokenization, audio waveform downsampling, and subtitle parsing/generation) run natively in Rust for near-instant execution and zero-GC memory efficiency.
- **Native Japanese Furigana Tokenizer (`Lindera` + IPADIC):** Fast, accurate morphological analysis with embedded dictionary support, mapping Kanji to Hiragana/Romaji without bloating the browser heap.
- **Dynamic RMS Waveform Peak Extractor (`Symphonia` + FFmpeg):** Native audio decoding with RMS + averaged peak downsampling, displaying clear musical dynamics without brick-wall waveform clipping.
- **1-Click YouTube Media Downloader (`yt-dlp`):** Paste any YouTube URL, choose your target video resolution (`360p` to `4K`) or audio stream, and download directly into the studio with automatic thumbnail & palette extraction—no Google API key required.
- **Multi-Source Synced Lyrics Engine:** Search and import synchronized lyrics from 5 online providers (LRCLIB, NetEase Cloud Music, QQ Music, Kugou, Musixmatch) or local `.lrc`, `.srt`, and `.vtt` files via native zero-copy Rust parsers.
- **Granular Per-Word & Per-Character Vocal Timing:**
  - Automatic smart tokenization for Latin, CJK (Japanese/Chinese), and mixed scripts.
  - **Split & Merge Controls:** Split any word into individual characters (`Split to Chars` / `All Chars`) or merge neighboring tokens (`← Merge Left` / `Merge Right →`).
  - **Per-Word Animation Mute:** Disable vocal animation on specific words or punctuation (`Anim: OFF (Static)`) so non-sung tokens remain still without triggering motion or particles.
  - **Word-to-Word Transition Styles:** Choose between **Pop Bounce**, **Karaoke Sweep**, **Smooth Sweep**, and **Vocal Float** with customizable transition duration (`0ms–500ms`) and draggable word boundaries directly on the waveform timeline.
- **Furigana / Ruby Text & Secondary Translations:** Supports `{漢字|かんじ}` inline ruby syntax with visual click-to-edit controls, plus dedicated secondary translation subtitles rendered simultaneously.
- **Real-Time Zero-GC Particle Engine (PixiJS v8):** Hundreds of stardust, sparkle, sakura, cosmic, firefly, and heart particles burst on vocal beats at 60 FPS using pre-allocated object pooling and reused GPU textures to prevent memory leaks.
- **Unlimited Typography & Position Customization:** Customize fill colors, active word highlight color, gradient stops, double-stroke outlines, vertical anchor (`Bottom` / `Center` / `Top`), and unrestricted `X/Y` pixel offsets with both sliders and direct numeric inputs.
- **Gatefold 3-Zone Workspace & Resizable Inspector:** Obsidian dark UI with dynamic OKLCH ambient backlighting, classic top menu bar (`File`, `Subtitle`, `View`, `Export`), multi-lane non-overlapping timeline, and a draggable divider to resize the right inspector sidebar.
- **Native Project Save/Open & Hardware Video Render (FFmpeg):**
  - Save and restore complete `.substellar` project files via native OS Explorer dialogs, backed by automatic session recovery (`localStorage` + IndexedDB media cache).
  - **Full Canvas Overlay Pipe (WebSocket Sparse RLE):** Ultra-fast streaming of rendered canvas frames to local FFmpeg with full particle and furigana visual parity (BT.709 colorimetry).
  - **Fast Hardware ASS Burn-In:** Direct GPU-accelerated video encode (`NVENC` / `QSV` / `AMF` / `libx264`) with multi-layer styled subtitle burn-in.
  - **Subtitle File Export:** Native Rust export for `.ass` (with full `\k` karaoke tags & Furigana positioning) and `.srt` with target path confirmation and **Show in Explorer**.

---

## Rust Core Engine

SubStellar features a dedicated **Rust Core** (`src-tauri/`) that offloads compute-heavy workloads from the TypeScript frontend:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          SUBSTELLAR STUDIO                             │
├───────────────────────────────────┬────────────────────────────────────┤
│      Frontend (React 19 / TS)     │       Rust Core (Tauri v2 IPC)     │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Gatefold OKLCH Studio UI        │ • Lindera Japanese Morphological   │
│ • PixiJS v8 60 FPS Viewport       │   Analyzer (Embedded IPADIC)       │
│ • Interactive Timeline Scrubber   │ • Symphonia Native Audio Decoder   │
│ • Ruby / Furigana Visual Editor   │ • RMS Waveform Peak Downsampler    │
│ • Zero-GC Particle Pool System    │ • Zero-Copy ASS / SRT / LRC Parser │
│ • Zustand High-Frequency Store    │ • WebSocket Sparse RLE Frame Pipe  │
│                                   │ • Hardware Probing & FFmpeg Pipe   │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Desktop Shell & Core** | **Tauri v2 (Rust 1.94+)** | Native window management, file dialogs, process control, and core computing engines. |
| **Frontend** | **React 19 + TypeScript (Strict)** | Declarative studio UI, strict type safety, and zero-re-render playback loop. |
| **Rendering Canvas** | **PixiJS v8 (WebGPU / WebGL)** | Zero-allocation 60 FPS subtitle layout, double-stroke typography, and particle bursts. |
| **Design & Theming** | **Tailwind CSS + Gatefold OKLCH** | Perceptually uniform OKLCH color tokens and ambient dynamic palette extraction. |
| **State Management** | **Zustand** | High-frequency playhead synchronization (`getState()` in RAF) without React tree thrashing. |
| **NLP & Furigana** | **Lindera (Rust) + Kuromoji Fallback** | Native Japanese morphological tokenization with memory-mapped dictionary support. |
| **Audio Processing** | **Symphonia (Rust) + Web Worker** | Native audio decoding with RMS + peak downsampling for timeline waveform. |
| **Media & Render** | **FFmpeg (Native / Sidecar)** | Hardware encoder probing (`NVENC`/`QSV`/`AMF`), sparse RLE frame pipe, and ASS hardware burn-in. |
| **Media Fetcher** | **yt-dlp + Rust Allowlist Proxy** | Multi-resolution YouTube video/audio downloading and CORS-free lyrics fetching. |

---

## Quick Start

### Prerequisites
* [Node.js](https://nodejs.org/) v20+ or v24+
* [Rust & Cargo](https://rustup.rs/) v1.80+ (v1.94+ recommended)
* [FFmpeg](https://ffmpeg.org/) & [yt-dlp](https://github.com/yt-dlp/yt-dlp) available in system `PATH` (for video rendering and YouTube downloading)

### Installation & Development

```bash
# 1. Clone the repository
git clone https://github.com/SayMaven/sub-stellar.git
cd sub-stellar

# 2. Install frontend dependencies
npm install

# 3. Launch the Tauri v2 desktop development app
npm run tauri dev
```

### Production Build

```bash
# Build native desktop installer (.msi / .exe / .dmg / .AppImage)
npm run tauri build
```

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Space`** | Play / Pause media playback |
| **`Ctrl + N`** | Add new empty subtitle line at playhead |
| **`Ctrl + S`** | Save Project (`.substellar`) |
| **`Ctrl + Shift + S`** | Save Project As (`.substellar`) |
| **`Delete`** | Delete selected subtitle line |
| **`Ctrl + K`** | Open YouTube Media Downloader |
| **`Ctrl + Q`** | Cycle Hardware Quality Profile (`Low` / `Balanced` / `Ultra`) |
| **`Ctrl + Shift + D`** | Toggle Real-Time Performance Telemetry (FPS, Frame Time, Particles) |

---

## License & Acknowledgments

SubStellar is dual-licensed under your choice of either:

* **[MIT License](LICENSE-MIT)** ([http://opensource.org/licenses/MIT](http://opensource.org/licenses/MIT))
* **[Apache License, Version 2.0](LICENSE-APACHE)** ([http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0))

See [LICENSE](LICENSE) for details.

**Special Thanks & Inspiration:**
* **[Gatefold](https://github.com/DEVIROYrus/gatefold-foobar2000):** Inspiration for the OKLCH design language and multi-source lyrics architecture.
* **[PixiJS](https://pixijs.com):** High-performance 2D WebGL/WebGPU rendering engine.
* **[Tauri](https://tauri.app):** Lightweight, secure cross-platform desktop framework.
* **[Lindera](https://github.com/lindera/lindera):** Fast morphological analysis library in Rust.
* **[Symphonia](https://github.com/pdeljanov/Symphonia):** Pure Rust media decoding library.
