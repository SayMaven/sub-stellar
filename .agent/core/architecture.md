# System Architecture & Tech Stack Matrix

## Tech Stack Baku
| Layer | Komponen | Standar / Ketentuan |
| :--- | :--- | :--- |
| **Desktop Shell** | **Tauri v2 (Rust)** | Gunakan Tauri v2 API (`@tauri-apps/api`, `@tauri-apps/plugin-shell`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`). Hemat RAM (~30-60 MB). |
| **Frontend** | **React 19 + TypeScript (Strict)** | Strict typing tanpa `any`. Komponen berbasis fungsional murni + Hooks. |
| **Build Tool** | **Vite** | Fast HMR, optimized production build. |
| **Theming & Styling** | **Tailwind CSS + Gatefold CSS Engine** | CSS Variables `@property` OKLCH ambient palette tokens dari Gatefold. |
| **UI Primitives** | **Lucide React + Radix UI Primitives** | Ikon clean, accessible, dark mode first. |
| **State Management** | **Zustand** | Transient Updates untuk data frekuensi tinggi (audio timecode 60 FPS). |
| **Rendering Canvas** | **PixiJS v8** | `new Application()` + `await app.init()`. `ParticleContainer` untuk partikel, `Text` untuk tipografi presisi. |
| **Furigana Engine** | **Kuroshiro + Kuromoji Analyzer** | Konversi Kanji $\rightarrow$ Hiragana otomatis; kamus di-load on-demand. |
| **Media Processing** | **FFmpeg (Sidecar)** | Binary FFmpeg portable di bundle Tauri dengan hardware auto-detection. |
| **Downloader Engine**| **yt-dlp (Sidecar) + Innertube API** | Scraping metadata YouTube tanpa API key, ekstraksi stream via `yt-dlp`. |
| **Lyrics Fetcher** | **Gatefold Multi-Source Engine** | LRCLIB, NetEase Cloud Music, QQ Music, Kugou, Musixmatch. |

## Struktur Direktori Utama
```
sub-stellar/
├── .agent/              # Direktif modular untuk AI Agent
├── docs/                # PRD & Master Plan
├── src-tauri/           # Rust Desktop Backend (Tauri v2)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/             # IPC commands (ffmpeg, ytdl, fs, lyrics)
├── src/                 # React 19 Frontend
│   ├── components/      # Common, Layout, Studio, Timeline, Lyrics, YouTube, Furigana, Inspector
│   ├── engine/          # PixiJS v8, Particles, Text/Ruby, Furigana, Parsers, Audio
│   ├── stores/          # Zustand stores (Studio, Theme, Lyrics, Download, Perf)
│   ├── services/        # IPC bridges & scrapers
│   ├── workers/         # Web Workers (Waveform peaks)
│   ├── styles/          # Gatefold OKLCH theme CSS & Tailwind
│   └── types/           # Strict TypeScript interfaces
└── public/dict/         # Kamus Kuromoji offline
```

