# Changelog: SubStellar

Semua perubahan penting pada proyek SubStellar didokumentasikan di dalam file ini.
Format penulisan mengacu pada Keep a Changelog dan menganut prinsip Semantic Versioning.

---

## [Unreleased] - 2026-11-09

### Ditambahkan (Added)
- Dokumentasi Lengkap Proyek (Pilar 1 s/d 10):
  - docs/PRD.md: Spesifikasi kebutuhan produk komprehensif, analisis kompetitif (vs Aegisub, CapCut, After Effects), personas, dan studi kelayakan.
  - docs/MASTER_PLAN.md: Rencana peta jalan implementasi arsitektur fase 1 hingga 6.
  - docs/ARCHITECTURE.md: Arsitektur Modular Micro-Kernel, diagram data flow sekuensial, dan justifikasi tech stack.
  - docs/ENGINEERING_PRACTICES.md: Standar rekayasa kualitas kode, prinsip SOLID, konvensi commit konvensional, dan quality gates.
  - docs/TESTING.md: Rencana pengujian piramida (Unit Vitest, E2E Playwright, Zero-GC CDP leak check, target coverage 70-80%).
  - docs/SECURITY.md: Model keamanan hak akses Tauri v2 capabilities, sanitasi input, mitigasi command injection, dan proteksi privasi 100% lokal.
  - docs/PERFORMANCE.md: Panduan optimasi perangkat low-end, mitigasi CPU triple-concurrency, streaming video chunk, dan startup sub-1.5s.
  - docs/UI_UX.md: Spesifikasi desain Gatefold, aksesibilitas WCAG 2.1 AA, layout adaptif 3-zona, sistem undo/redo 50 steps, dan lokalisasi 8 bahasa.
  - docs/DEVOPS.md: Pipeline CI/CD GitHub Actions multi-platform, code signing, auto-updater Minisign, dan strategi rilis.
  - docs/LEGAL_COMPLIANCE.md: Lisensi MIT, kepatuhan FFmpeg LGPL sidecar, kebijakan privasi lokal, dan model keberlanjutan.
  - docs/API.md: Spesifikasi antarmuka IPC Rust-to-Frontend dan service bridge.
  - docs/USER_MANUAL.md: Panduan lengkap alur kerja pengguna (1-klik YouTube hingga ekspor video).
  - docs/adr/: Catatan keputusan arsitektural (ADR 001 s/d 005).
- Arsitektur Direktif AI Agent Modular (.agent/):
  - Mengorganisasi direktif instruksi ke dalam sub-folder modular: core/, performance/, engines/, ui/, dan workflows/.
- Standar Tipografi & Unicode Anti-Pecah:
  - Penerapan Intl.Segmenter (grapheme cluster boundaries), algoritma BiDi (UAX #9) untuk teks campuran RTL+LTR, dan aturan pemenggalan baris CJK (Kinsoku Shori).
  - Tiga jalur kustom font: Drag & Drop (.ttf, .otf, .woff2), deteksi font sistem OS otomatis, dan katalog Google Fonts 1-klik.
- Kebijakan Kualitas Desain Tanpa Emoji:
  - Larangan penggunaan emoji pada antarmuka, notifikasi, teks kode, maupun dokumen teknis demi menjaga kesan profesional kelas industri.

---

## [1.0.0-alpha.1] - 2026-11-09 (Fase 1 Selesai)

### Ditambahkan (Added)
- Scaffolding Fondasi Desktop Tauri v2 + React 19 + TypeScript + Vite:
  - Arsitektur native Rust backend di `src-tauri` (`tauri.conf.json`, `Cargo.toml`, capabilities v2).
  - Rust command modules untuk `get_system_info` dan `probe_hardware_capabilities` dengan error handling `Result<T, String>` aman tanpa `.unwrap()`.
- Gatefold CSS Engine & Sistem Palet Dinamis OKLCH (`src/styles/gatefold-theme.css`):
  - Definisi variabel CSS `@property` OKLCH (`--bg`, `--surface`, `--accent`, `--glow`, `--blob-1`, dll).
  - Background pendaran gradien dinamis (*ambient aurora mesh backlight*).
  - Preset tema bawaan: Gatefold Obsidian, Sakura Petal, Cyberpunk Neon, Nordic Aurora, dan Monochrome.
- Gatefold 3-Zone Shell Layout (`src/components/layout/`):
  - Header Toolbar (46px) dengan pencarian cepat URL YouTube (`Ctrl+F`), indikator profil performa (`Ctrl+Q`), dan toggle telemetri diagnostics (`Ctrl+Shift+D`).
  - Sidebar Collapsible (236px -> 68px) dengan ikon Lucide monokrom (bebas emoji).
  - Bottom Transport Bar (92px) dengan scrubbing slider interaktif, timecode presisi, preview cover, dan kontrol audio.
- State Management Tingkat Tinggi (Zustand):
  - `usePerfStore`: Manajemen tri-tier hardware profile (Low, Balanced, Ultra) dengan batasan partikel dan downsampling canvas.
  - `useThemeStore`: Pengatur tema OKLCH dan ekstraksi warna cover art otomatis.
  - `useStudioStore`: Kontrol playback audio, navigasi timeline, aspect ratio switcher, dan data showcase furigana.
- Viewport PixiJS v8 (`src/components/studio/PixiViewport.tsx`):
  - Inisialisasi modern `Application` PixiJS v8 (`await app.init()`).
  - Rendering teks J-Pop MV dengan Furigana Ruby Text (`もう何もいらない` dengan `なに` di atas `何`) dan pendaran partikel stardust adaptif.
  - Dukungan multi-aspek rasio: 16:9 (Landscape), 9:16 (Shorts/TikTok), 1:1 (Square), dan 4:3 (Classic).
- Quality Gates & Unit Tests:
  - 14 pengujian unit Vitest (`perfStore`, `themeStore`, `studioStore`) seluruhnya lolos 100%.
  - Unit tests Rust backend `cargo test` lolos 100%.
  - `cargo clippy -- -D warnings` dan `npm run typecheck` lolos tanpa peringatan/error.
