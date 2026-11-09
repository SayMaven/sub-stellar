# SubStellar — Agent Directives Index (`.agent/`)

Folder ini berisi direktif instruksi, panduan arsitektur, dan standar baku modular untuk AI Agent yang mengembangkan repositori **SubStellar**.

## Peta Direktif Modular:

### 1. Core Identity & Architecture
* [identity.md](file:///f:/CODE/software/sub-stellar/.agent/core/identity.md) — Visi produk, fungsi inti, dan inspirasi Gatefold.
* [architecture.md](file:///f:/CODE/software/sub-stellar/.agent/core/architecture.md) — Matriks tech stack baku dan struktur direktori proyek.

### 2. Performance & Low-End Optimization (Mandatori)
* [low-end-guidelines.md](file:///f:/CODE/software/sub-stellar/.agent/performance/low-end-guidelines.md) — Tri-tier quality scaling (Low/Balanced/Ultra), zero-GC object pooling, dan RAM budget.
* [audio-workers.md](file:///f:/CODE/software/sub-stellar/.agent/performance/audio-workers.md) — Web Worker untuk kalkulasi waveform downsampling tanpa UI freeze.

### 3. Engine Guides
* [pixi-particle.md](file:///f:/CODE/software/sub-stellar/.agent/engines/pixi-particle.md) — Standar PixiJS v8, `ParticleContainer`, multi-stroke text, dan glow shaders.
* [furigana-ruby.md](file:///f:/CODE/software/sub-stellar/.agent/engines/furigana-ruby.md) — Mesin Kuroshiro, RubyLayout Engine (`parseMarkdownRuby`, `computeRubyPosition`, Kinsoku Shori).
* [typography-unicode.md](file:///f:/CODE/software/sub-stellar/.agent/engines/typography-unicode.md) — Intl.Segmenter, UAX #9 BiDi, dan rantai font fallback.
* [ffmpeg-pipeline.md](file:///f:/CODE/software/sub-stellar/.agent/engines/ffmpeg-pipeline.md) — Hardware encoder auto-probing, burn-in MP4, dan transparent alpha video.

### 4. UI & Gatefold Theme
* [gatefold-theme.md](file:///f:/CODE/software/sub-stellar/.agent/ui/gatefold-theme.md) — Variabel CSS `@property` OKLCH dan ambient background backlight.
* [shell-layout.md](file:///f:/CODE/software/sub-stellar/.agent/ui/shell-layout.md) — Layout 3-zona (Header 46px, Sidebar 236px/68px, Subtitle Inspector 320px, BottomBar 92px).
* [no-ui-slop.md](file:///f:/CODE/software/sub-stellar/.agent/ui/no-ui-slop.md) — Standar anti-slop profesional, hirarki studio NLE/DAW, dan matriks 10 UI states mandatori.

### 5. Workflows & Verification
* [lyrics-youtube.md](file:///f:/CODE/software/sub-stellar/.agent/workflows/lyrics-youtube.md) — Multi-provider lirik (LRCLIB, NetEase, QQ) dan YouTube scraper/downloader.
* [engineering-standards.md](file:///f:/CODE/software/sub-stellar/.agent/workflows/engineering-standards.md) — Standar TypeScript strict, zero emoji, dan konvensi commit.
* [security-guidelines.md](file:///f:/CODE/software/sub-stellar/.agent/workflows/security-guidelines.md) — Proteksi sistem lokal, perizinan Tauri capabilities, dan sanitasi input.
* [verification-protocol.md](file:///f:/CODE/software/sub-stellar/.agent/workflows/verification-protocol.md) — Protokol checklist wajib sebelum task dinyatakan selesai.
