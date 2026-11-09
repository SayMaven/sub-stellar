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

## [1.0.0-alpha.3] - 2026-11-10 (Fase 3 Selesai: Particle Engine dengan Zero-GC Object Pooling)

### Ditambahkan (Added)
- Generic Zero-GC Static Object Pool (`src/engine/pixi/ObjectPool.ts`):
  - Alokasi memori statis pra-alokasi (`capacity` tetap) dengan struktur stack terindeks LIFO.
  - Alokasi nol (0 GC garbage) saat `acquire()` dan `release()` di dalam game loop / render loop 60 FPS.
  - Implementasi aman dengan interface generic `Poolable` dan penanganan overflow protektif.
- Stellar Particle Engine (`src/engine/particles/ParticleManager.ts`):
  - Integrasi native dengan PixiJS v8 `ParticleContainer` untuk rendering GPU berkecepatan tinggi.
  - Tekstur pendaran bintang prosedural (*procedural radial glow + 4-point cross star glint*) dibuat di memori via Canvas 2D murni tanpa ketergantungan file aset eksternal.
  - Tiga preset fisika partikel (*stardust*, *sparkle*, *cosmic*) dengan simulasi fisika (gravitasi, kecepatan radial, skala, rotasi, dan pembusukan alfa/fade).
  - Emisi dinamis (*burst*) yang sinkron dengan sapuan karaoke (*karaoke sweep*) saat kata atau suku kata aktif berganti.
- Particle Tab pada Subtitle Inspector (`src/components/studio/SubtitleInspector.tsx`):
  - Master toggle pengaktifan engine partikel dengan telemetry partikel aktif.
  - Pemilih preset visual 1-klik (*Stardust*, *Sparkle*, *Cosmic*).
  - Slider intensitas burst suku kata (5 hingga 40 partikel).
  - Tombol uji coba burst instan (*Test Particle Burst*) di tengah kanvas via event `substellar:trigger-burst`.
- Quality Gates & Telemetry:
  - 31 dari 31 unit test Vitest lolos 100% (`objectPool.test.ts`, `particleManager.test.ts`, `rubyLayout.test.ts`, `perfStore.test.ts`, `themeStore.test.ts`, `studioStore.test.ts`).
  - Lolos `cargo test` Rust backend dan `npm run build` Vite production bundle tanpa kesalahan.

---

### Ditambahkan (Added)
- Subtitle & RubyLayout Engine (`src/engine/text/RubyLayout.ts`):
  - Parser tag Markdown Ruby `{漢字|かんじ}` ke struktur token `ParsedRubyToken` dan serializer balikan.
  - Perhitungan presisi centering horizontal dan offset vertikal Furigana di atas Kanji:
    $$\text{rubyX} = \text{baseX} + \frac{\text{baseWidth} - \text{rubyWidth}}{2}$$
  - Pemenggalan baris teks CJK mematuhi aturan *Kinsoku Shori* (larangan tanda baca di awal/akhir baris).
  - Segmentasi karakter berbasis grapheme cluster anti-pecah menggunakan native `Intl.Segmenter`.
- Viewport PixiJS v8 Multi-Layer Outline & Safe Guides (`src/components/studio/PixiViewport.tsx`):
  - Multi-layer outline stroke (outer dark outline tebal + inner glow accent outline) untuk keterbacaan tinggi di atas video apa pun.
  - Broadcast safe guides overlay: 93% Action Safe dan 90% Title Safe.
  - Reaktivitas instan terhadap modifikasi teks, timecode, font size, dan skala furigana dari Inspector.
- Subtitle & Style Inspector Panel (`src/components/studio/SubtitleInspector.tsx`):
  - Inspector dockable di sisi kanan kanvas: Editor timing presisi sub-detik, syntax editor `{Kanji|Ruby}`, token badge per suku kata.
  - Kontrol tipografi: Font size slider (24–96px), skala furigana (30–70%), outer stroke width, inner glow, Y-offset, dan toggle safe guides.
  - Preset visual 1-klik: J-Pop Starlight (Cyan), Neon Shinjuku (Magenta), Sakura Petal (Pink), dan Clean Minimalist.
- Rombak Desain UI Bebas Slop (Standar `no-ui-slop`, `ui-states`, & `uxkin-research`):
  - Mengeliminasi kartu generik dekoratif; antarmuka kini berfokus pada ruang kerja NLE/DAW profesional.
  - State kosong & penggunaan pertama (`EmptyStudioState.tsx`): Dropzone media drag-and-drop interaktif bergaris putus-putus dengan tombol showcase demo 1-klik.
  - State loading & busy action: Indikator proses step-by-step pada YouTube Downloader dan skeleton placeholder pada pencarian lirik.
  - State error & validasi: Banner error interaktif dengan aksi recovery pemulihan (*Restore Sample* / *Dismiss*), validasi format URL YouTube, dan umpan balik kesalahan timing.
  - Tab manual input lirik alternatif jika pencarian database tidak menghasilkan kandidat.
- Quality Gates & Unit Tests:
  - 22 dari 22 pengujian unit Vitest lolos 100% (`rubyLayout.test.ts`, `studioStore.test.ts`, `perfStore.test.ts`, `themeStore.test.ts`).
  - `npm run typecheck` dan `npm run build` berhasil tanpa error.

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
