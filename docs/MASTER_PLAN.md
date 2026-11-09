# Master Plan Komprehensif: SubStellar — Next-Gen Animated & Particle Subtitle Studio

> **Dokumen Spesifikasi Arsitektur, Desain Sistem, dan Rencana Eksekusi**  
> Repositori: `https://github.com/SayMaven/sub-stellar`  
> Panduan Agen: `.agent/` & `docs/`

---

## 1. Ringkasan Eksekutif & Visi Produk

**SubStellar** adalah aplikasi desktop modern untuk pembuatan subtitle video tingkat lanjut (*advanced particle subtitle & lyrics studio*). Aplikasi ini menyelesaikan keterbatasan software konvensional:
* **Bukan sekadar subtitle standar (SRT/VTT biasa)**: Mendukung efek karaoke dinamis, *multi-layer outline stroke*, gradien, *inner/outer glow*, teks Furigana/Ruby untuk bahasa beraksara (Jepang/Kanji, Mandarin, Korea), dan emisi partikel (*stardust / sparkles*) yang sinkron dengan ketukan atau vokal lagu.
* **Dual-Workflow (1-Klik Otomatis + Precision Manual Override)**: Pengguna bisa langsung menempel link YouTube atau memilih lagu $\rightarrow$ lirik tersinkronisasi otomatis diambil dari database online $\rightarrow$ furigana ter-generate $\rightarrow$ preset efek visual diterapkan secara instan, namun pengguna tetap memiliki timeline audio presisi untuk menggeser timestamp per kata atau suku kata.
* **Estetika Kelas Atas (Gatefold UI System)**: Mengadopsi bahasa desain dari **Gatefold** (`F:\CODE\forking\gatefold-foobar2000`): skema warna gelap obsidian yang tenang, background *ambient aurora glow* adaptif yang warnanya diekstrak dari poster/cover media, kartu translusen dengan rounded corners, dan kontrol transport bar modern.
* **High Performance on Low-End Hardware**: Didesain sejak hari pertama untuk tetap berjalan mulus (60 FPS) pada laptop dengan GPU terintegrasi (Intel HD/UHD Graphics), RAM 4–8 GB, dan prosesor hemat daya.

---

## 2. Arsitektur Khusus Hardware Low-End & Optimasi Performa (Mandatori)

| Area Optimasi | Kendala Umum pada Software Lain | Solusi Desain SubStellar |
| :--- | :--- | :--- |
| **Konsumsi RAM Desktop** | Electron memakan 400–700 MB hanya untuk idle. | **Tauri v2 + Rust**: Memakai native WebView2, hanya memakan **~30–60 MB RAM** saat startup. |
| **Rendering Partikel GPU** | Ribuan partikel membuat GPU terintegrasi overheating dan drop FPS. | **Tri-Tier Graphics Profile (Low / Balanced / Ultra)**:<br/>• *Low:* 150–250 partikel, soft-shadow text (tanpa blur pass berat), 720p internal preview.<br/>• *Balanced:* 500–800 partikel, standard bloom.<br/>• *Ultra:* 2.000+ partikel, multi-pass bloom & WebGPU. |
| **Garbage Collection (GC)** | `new Particle()` berulang membuat UI sering *micro-stutter*. | **Static Object Pooling**: Semua partikel dialokasikan sekali di awal dan didaur ulang (*zero allocation in render loop*). |
| **Audio Waveform Parsing** | File audio 5 menit bisa membengkak 100MB+ jika didecode penuh di UI thread. | **Web Worker Peak Downsampling**: Decoding dan kalkulasi puncak amplitudo (hanya ~2.000 titik per lagu) dijalankan di background worker; UI thread tidak pernah freeze. |
| **Kamus Furigana (NLP)** | Kamus Kuromoji memakan 20–30 MB memori jika standby terus. | **On-Demand Memory Loading**: Kamus hanya dimuat saat user mengklik "Generate Furigana", lalu dapat dilepas dari memori. |
| **Ekspor Video FFmpeg** | Sering crash jika GPU encoder tidak ada. | **Dynamic Encoder Cascade**: Auto-probe urutan: `h264_nvenc` $\rightarrow$ `h264_qsv` $\rightarrow$ `h264_amf` $\rightarrow$ fallback hemat daya CPU `libx264 -preset veryfast -crf 22`. |

---

## 3. Tech Stack Matrix Lengkap & Rasionalisasi

| Layer | Teknologi | Versi Target | Alasan & Peran Teknis |
| :--- | :--- | :--- | :--- |
| **Desktop Runtime** | **Tauri v2** | `^2.2.0` (Rust `1.94+`) | Konsumsi RAM sangat rendah (<70MB), cold-start instan, native IPC kencang, bundling sidecar resmi. |
| **Frontend Framework** | **React 19 + TypeScript** | React `19.x`, TS `5.7+` | React 19 Actions/Compiler, strict type-safety, ekosistem visual editor terbaik. |
| **Build Tool** | **Vite** | `^6.x` | Dev-server HMR sub-detik, build rollup teroptimasi. |
| **Styling & Theming** | **Tailwind CSS + Gatefold CSS Engine** | Tailwind `^3.4` / `v4` | Native CSS `@property` interpolasi OKLCH untuk palet ambient warna hidup yang transisi halus saat cover berubah. |
| **UI Components** | **Radix UI Primitives + Lucide Icons** | Latest | Aksesibilitas keyboard lengkap, micro-interactions halus, ikon visual presisi. |
| **State Management** | **Zustand** | `^5.0` | Transient state subscription untuk audio playback timecode 60 FPS tanpa re-render pohon React. |
| **Particle & Subtitle Canvas** | **PixiJS v8** | `^8.6+` | WebGPU & WebGL batching render engine. `ParticleContainer` dengan Object Pool untuk stabilitas 60 FPS di Low-End GPU. |
| **Furigana / Morphology**| **Kuroshiro + Kuromoji Analyzer** | `^1.2` | Engine NLP Jepang di client/worker untuk memecah kalimat Kanji $\rightarrow$ token kata $\rightarrow$ Hiragana ruby text secara otomatis. |
| **Typography & Unicode** | **Intl.Segmenter + FontFace API** | Native Browser | Pemotongan karakter berbasis grapheme cluster anti-pecah, BiDi (UAX #9) teks campuran RTL+LTR, dan import font kustom. |
| **Font Discovery** | **font-kit / native Windows query** | Rust Backend | Membaca seluruh font sistem yang terinstall di komputer pengguna tanpa perlu import manual. |
| **Audio Processing & Sync** | **Web Audio API + AudioContext** | Native Browser | Waveform peak extraction via Web Worker, stereo analyzer, timecode presisi mikrodetik. |

### Standar Baku Tipografi, Aksara Global & Unicode (Anti-Pecah)

| Aspek | Spesifikasi Standar SubStellar |
| :--- | :--- |
| **Encoding** | 100% Full UTF-8 Native |
| **Segmentation** | `Intl.Segmenter` (Grapheme & Word boundaries) — mencegah terbelahnya emoji & aksen |
| **Arah Baca (Direction)** | LTR, RTL, dan BiDi (Unicode Bidirectional Algorithm UAX #9 untuk teks campuran) |
| **Complex Scripts** | Ligatur Arab utuh (tidak terputus saat karaoke), Vokal tumpuk Thai & Devanagari presisi |
| **CJK Line Wrap** | Mematuhi aturan *Kinsoku Shori* (larangan tanda baca di awal/akhir baris) |
| **Font Fallback** | Multi-tier CJK + Middle-East + South-East Asia + Emoji |
| **Custom Fonts** | Drag & Drop (`.ttf`, `.otf`, `.woff`, `.woff2`) + System Font Discovery + Google Fonts |
| **WYSIWYG Fidelity** | Render langsung dari PixiJS Canvas ke FFmpeg Pipe tanpa font mismatch |
| **Media Engine & Export** | **FFmpeg (Tauri Sidecar)** | `7.x / 6.1+` | Demuxing audio/video, hardware auto-probing (`nvenc`, `qsv`, `amf`, `libx264`), burn-in subtitle MP4, dan export transparan WebM (VP9 + Alpha) / Apple ProRes 4444. |
| **YouTube Scraper & Downloader** | **yt-dlp (Sidecar) + Innertube Client** | Latest | Ekstraksi video resolusi tinggi (1080p/4K) dan audio murni; fallback search via Innertube internal API tanpa butuh Google API Key. |
| **Lyrics Providers** | **Custom Multi-Provider Fetcher** | Built-in | LRCLIB, NetEase Cloud Music (YRC format), QQ Music, Kugou, Musixmatch. |

---

## 4. Analisis & Standar UI Gatefold (`gatefold-foobar2000`)

Mengacu langsung pada analisa kode sumber `theme/css/app.css` dan `theme/js/theme.js` Gatefold:

### A. Palet Token CSS Dinamis (`gatefold-theme.css`)
```css
@property --bg        { syntax: '<color>'; inherits: true; initial-value: #14161b; }
@property --surface   { syntax: '<color>'; inherits: true; initial-value: #1b1e24; }
@property --surface-2 { syntax: '<color>'; inherits: true; initial-value: #23272e; }
@property --text      { syntax: '<color>'; inherits: true; initial-value: #f3f4f6; }
@property --text-2    { syntax: '<color>'; inherits: true; initial-value: #bfc3ca; }
@property --text-3    { syntax: '<color>'; inherits: true; initial-value: #8b9099; }
@property --accent    { syntax: '<color>'; inherits: true; initial-value: #8fb4ff; }
@property --glow      { syntax: '<color>'; inherits: true; initial-value: #5770b0; }
@property --blob-1    { syntax: '<color>'; inherits: true; initial-value: #26324f; }
@property --blob-2    { syntax: '<color>'; inherits: true; initial-value: #3a2d55; }
@property --blob-3    { syntax: '<color>'; inherits: true; initial-value: #1f3d48; }

:root {
  --tx: 1100ms;
  --ease: cubic-bezier(.22, .7, .18, 1);
  --line: color-mix(in oklab, var(--text) 9%, transparent);
  --line-2: color-mix(in oklab, var(--text) 15%, transparent);
  --hover: color-mix(in oklab, var(--text) 6.5%, transparent);
  --panel: color-mix(in oklab, var(--bg) 58%, transparent);
  --panel-strong: color-mix(in oklab, var(--bg) 80%, transparent);
  --shadow-pop: 0 18px 50px -12px rgb(0 0 0 / .55), 0 2px 8px rgb(0 0 0 / .25);
  --r-sm: 6px; --r: 10px; --r-lg: 16px;
}
```

### B. Shell 3-Zona Gatefold
```
+-------------------------------------------------------------------------------+
| HEADER TOOLBAR (46px) — Window Title, Search [Ctrl+F], Quality Pill, Win Controls|
+---------------------+---------------------------------------------------------+
| SIDEBAR (236px)     | MAIN STAGE (1fr)                                        |
| - Studio (Canvas)   | [ Top Aspect: 16:9 | 9:16 | 1:1  —  Quality: Low/Bal/Ultra]|
| - YouTube Search    | +-----------------------------------------------------+ |
| - Lyrics Database   | |                                                     | |
| - Presets Library   | |              PIXI.JS V8 VIEWPORT STAGE              | |
| - Export Center     | |       (Interactive Text, Furigana & Particles)      | |
| - Appearance/Config | |                                                     | |
|                     | +-----------------------------------------------------+ |
| [Sidebar Toggle]    | [ TIMELINE EDITOR (Waveform Canvas, Words Blocks, Sync)]|
+---------------------+---------------------------------------------------------+
| BOTTOM TRANSPORT BAR (92px)                                                  |
| [Thumb + Title/Artist]  |  [⏮ ◀ ⏸ ▶ ⏭] [==== Scrubber ==== 02:14/03:45]  | [🔊 ⛶ ⚙]   |
+-------------------------------------------------------------------------------+
```

---

## 5. Struktur Direktori Proyek Lengkap

```
sub-stellar/
├── .agent/                        # Direktif modular untuk AI Agent
├── docs/                          # Dokumentasi arsitektur & PRD
│   ├── PRD.md
│   └── MASTER_PLAN.md
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── ffmpeg.rs          # Probing & Render pipe export
│       │   ├── ytdl.rs            # YouTube stream download
│       │   ├── fs_ops.rs          # Project save/load
│       │   └── lyrics_proxy.rs    # HTTP bridge without CORS
│       └── utils/
│           ├── hw_probe.rs        # GPU encoder capability detector
│           └── paths.rs
├── src/
│   ├── assets/
│   │   ├── fonts/                 # Inter Var, Noto Sans JP
│   │   └── particles/             # Particle sprite atlas
│   ├── components/
│   │   ├── common/
│   │   ├── layout/
│   │   │   ├── Shell.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── TransportBar.tsx
│   │   ├── studio/
│   │   ├── timeline/
│   │   ├── lyrics/
│   │   ├── youtube/
│   │   ├── furigana/
│   │   └── inspector/
│   ├── engine/
│   │   ├── pixi/
│   │   │   ├── PixiEngine.ts
│   │   │   └── ObjectPool.ts      # Zero-GC particle recycle
│   │   ├── text/
│   │   │   ├── RubyLayout.ts
│   │   │   └── SubtitleRenderer.ts
│   │   ├── particles/
│   │   │   ├── ParticleManager.ts
│   │   │   └── presets/
│   │   ├── furigana/
│   │   │   └── KuroshiroEngine.ts # On-demand dictionary load
│   │   ├── parsers/
│   │   └── audio/
│   ├── stores/
│   │   ├── useStudioStore.ts
│   │   ├── useThemeStore.ts
│   │   ├── useLyricsStore.ts
│   │   ├── useDownloadStore.ts
│   │   └── usePerfStore.ts        # Quality mode: Low, Balanced, Ultra
│   ├── workers/
│   │   └── waveform.worker.ts     # Off-thread audio downsampling
│   ├── styles/
│   │   ├── gatefold-theme.css
│   │   └── index.css
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── dict/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

---

## 6. Rencana Tahapan Eksekusi (Implementation Milestones)

### Fase 1: Inisialisasi Fondasi, Performance Stores & Shell Gatefold UI
* Inisialisasi proyek Tauri v2 + React 19 + TypeScript + Vite di `f:\CODE\software\sub-stellar`.
* Setup Tailwind CSS & integrasikan sistem palet variabel CSS `@property` OKLCH dari Gatefold.
* Bangun shell 3-zona: Header bar, Sidebar (collapsible), Main Stage viewport, dan Bottom Transport Bar.
* Pasang `usePerfStore` (Quality setting switcher: Low / Balanced / Ultra) dengan indikator performa.
* Setup remote git `https://github.com/SayMaven/sub-stellar` dan commit fondasi awal.

### Fase 2: Viewport PixiJS v8 & Subtitle Layout Engine
* Pasang `pixi.js` v8 dan hubungkan ke kanvas React (`PixiCanvas.tsx`).
* Implementasikan kalkulasi multi-stroke (inner + outer outline) dan filter glow yang adaptif terhadap quality mode.
* Bangun **RubyLayout Engine** untuk meletakkan teks Furigana di atas Kanji secara presisi.
* Buat preset preview teks (J-Pop MV style sesuai referensi gambar).

### Fase 3: Particle Engine dengan Zero-GC Object Pooling
* Bangun `ParticleManager` menggunakan `ParticleContainer` PixiJS v8 yang terhubung ke `ObjectPool`.
* Implementasikan preset partikel: *Stardust*, *Sparkle Burst*, dan *Cosmic Glow*.
* Buat logika perpindahan highlight lirik per kata (*karaoke sweep*) yang memicu emisi partikel secara dinamis tanpa garbage collection stutter.

### Fase 4: Integrasi YouTube & Multi-Source Lyrics Fetcher
* Porting engine `lyrics-sources.js` dari Gatefold (LRCLIB, NetEase, QQ, Kugou).
* Implementasikan pencarian YouTube scraper & queue manager downloader (sidecar yt-dlp).
* Bangun dialog pencarian lirik yang menampilkan skor kemiripan kandidat lirik.

### Fase 5: Audio Waveform Worker & Timeline Scrubber
* Bangun Web Worker untuk kalkulasi downsampled waveform peaks (~2.000 titik).
* Buat kontrol interaktif timeline untuk menggeser timestamp per baris dan per kata secara visual.
* On-demand Kuroshiro Furigana loader & editor modal (klik kata untuk mengubah/menambah bacaan ruby).

### Fase 6: FFmpeg Hardware Auto-Probing & Export Pipeline
* Setup FFmpeg sidecar di `src-tauri` dengan Rust command hardware capability probe (`nvenc` / `qsv` / `amf` / `libx264`).
* Implementasikan pipeline render frame PixiJS $\rightarrow$ FFmpeg pipe untuk ekspor MP4 burn-in dan WebM transparan (Alpha).
* Polish animasi transisi tema, hotkey keyboard, dan validasi performa di mode Low.

---

## 7. Rencana Verifikasi & Acceptance Criteria

| Area Uji | Kriteria Keberhasilan Low-End | Metode Pengujian |
| :--- | :--- | :--- |
| **Konsumsi Memori** | RAM total saat idle < 120 MB; saat memutar audio + partikel < 250 MB. | Windows Task Manager & Process Profiler. |
| **FPS Stabilitas** | Tetap stabil pada $\ge 58\text{ FPS}$ pada mode *Low* saat partikel aktif. | PixiJS Ticker monitor di UI. |
| **Zero-GC Test** | Tidak ada lonjakan Garbage Collection saat partikel memancar terus-menerus selama 2 menit. | Chrome DevTools Memory Heap Snapshot comparison. |
| **Furigana Rendering** | Teks seperti `もう何もいらない` dan `あぁ待ち遠しいな` memiliki Furigana tepat di atas kanji dengan proporsi estetis. | Snapshot visual canvas pada resolusi 1080p & 720p. |
| **Lyrics Fetching** | Pencarian lagu menghasilkan kandidat yang dapat diparse menjadi struktur lirik tersinkronisasi. | Unit test parser LRC/YRC dengan sampel lirik NetEase & LRCLIB. |
| **Hardware Fallback** | Saat GPU encoder tidak terdeteksi, FFmpeg otomatis fallback ke CPU `libx264 veryfast` tanpa error/crash. | Simulasi export dengan driver GPU dinonaktifkan. |

