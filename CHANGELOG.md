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

## [1.0.0-alpha.5] - 2026-11-10 (Fase 5 Selesai: Overhaul UI Menyeluruh, Audio Waveform Worker & Timeline Scrubber)

### Ditambahkan (Added)
- Master Playback Master Clock (`src/engine/audio/PlaybackEngine.ts`):
  - Sinkronisasi master clock 60 FPS presisi tinggi terikat langsung ke elemen native `<video>` atau `<audio>` browser.
  - Memajukan `currentTime` secara kontinu dan otomatis saat Play (atau Spacebar) ditekan, menggerakkan playhead dan partikel.
  - Dukungan loop otomatis, sinkronisasi play/pause, seek instan, dan volume/mute state.
- Subtitle Exporter Generator (`src/engine/text/SubtitleExporter.ts`):
  - Generator format Advanced SubStation Alpha (`.ass` v4.00+) standar industri dengan definisi style warna OKLCH, outline multi-stroke, dan tag karaoke `\k` per-kata.
  - Generator SubRip (`.srt`) murni untuk kompatibilitas universal.
  - Trigger unduhan file langsung ke browser tanpa mock placeholder.
- Dual-Layer Video & Canvas Viewport (`src/components/studio/PixiViewport.tsx`):
  - Layer 0 (Underlying Media): Elemen video native `<video>` untuk file video lokal (drag & drop) atau backdrop visualizer studio atmosferik dinamis dengan pendaran ambient saat memutar lagu/audio.
  - Layer 1 (Overlay Canvas): Kanvas transparan PixiJS v8 menampilkan subtitle multi-stroke, furigana ruby text, broadcast safe guides (93% Action / 90% Title Safe), dan semburan partikel GPU pada transisi suku kata.
- Perbaikan Layout Menyeluruh & Anti-Overflow (`MainStage.tsx`, `Shell.tsx`, `Header.tsx`, `TransportBar.tsx`):
  - Eliminasi batasan kaku `max-h-[65vh]` menjadi wadah proporsional `aspect-video max-h-full max-w-full`.
  - Penambahan batas `min-h-0`, `min-w-0`, dan `shrink-0` di seluruh struktur flexbox untuk mencegah pemotongan timeline dan squishing toolbar.
- Pengkaitan Presets Library ke Aksi Nyata (`src/components/presets/PresetsDrawer.tsx`):
  - Mengaplikasikan langsung parameter tipografi, outline stroke ganda, partikel, dan palet warna dinamis OKLCH ke `useStudioStore` dan `useThemeStore`.
- Drag-and-Drop Media Dropzone (`src/components/studio/EmptyStudioState.tsx`):
  - Mendukung input file video/audio lokal (.mp4, .webm, .mp3, .wav) langsung ke panggung studio.
- Off-Thread Waveform Web Worker (`src/workers/waveform.worker.ts`):
  - Ekstraksi dan downsampling peak audio non-blocking ke tepat ~2.000 titik (1.000 bin pasangan min/max).
  - Algoritma envelope sintetis harmonik untuk visualisasi preview instan tanpa pembebanan memori mentah.
  - Transfer data memori Zero-Copy memanfaatkan native `transferable ArrayBuffer` pada `postMessage`.
- Waveform & Audio Cache Manager (`src/engine/audio/WaveformManager.ts`):
  - Orkestrasi thread worker terisolasi dengan fallback in-thread komputasi otomatis jika Web Worker tidak didukung lingkungan runtime.
  - Caching berbasis track ID dan durasi untuk eliminasi redundant re-computations.
- Timeline Scrubber Profesional & Trimming Interaktif (`src/components/studio/TimelineDrawer.tsx`):
  - Render bentuk gelombang audio berbasis HTML5 Canvas yang adaptif terhadap palet dinamis tema Gatefold OKLCH.
  - Kontrol zoom horizontal multi-tingkat (1x, 2x, 4x) dengan ruler timecode dinamis sub-detik.
  - Playhead scrubber interaktif dengan pointer capture presisi snapping 0.05s.
  - Blok subtitle interaktif: geser posisi timecode (*body move*), trimming awal (*start trim handle*), dan trimming akhir (*end trim handle*).
  - Indikator segmentasi kata/suku kata di dalam setiap blok subtitle.
- Interactive Furigana & Ruby Editor Modal (`src/components/furigana/RubyEditorModal.tsx`):
  - Modal pengeditan bacaan kanji interaktif per-kata dengan live preview furigana di atas kanji.
  - Editor segmen kata: tambah kata, hapus kata, ubah kanji, dan ubah bacaan ruby secara visual.
  - Serialisasi otomatis kembali ke format Markdown Ruby `{Kanji|Ruby}` yang langsung tersinkronisasi ke kanvas studio.
- Quality Gates & Tests:
  - 55 dari 55 unit test Vitest lulus 100% (penambahan `playbackEngine.test.ts`, `subtitleExporter.test.ts`, `waveform.test.ts`, dan `rubyEditor.test.ts`).
  - Bundle `waveform.worker.js` terisolasi berhasil dibangun dalam produksi Vite.
  - Semua pengujian Rust backend tetap lulus tanpa peringatan.

---

## [1.0.0-alpha.4] - 2026-11-10 (Fase 4 Selesai: Integrasi YouTube & Multi-Source Lyrics Fetcher)

### Ditambahkan (Added)
- Native YouTube & Media Ingestion Command (`src-tauri/src/commands/ytdl.rs`):
  - Validasi regex URL YouTube yang aman terhadap manipulasi skema (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`).
  - Deteksi ketersediaan binary `yt-dlp` (`ytdl_check_binary`) dengan probing versi otomatis.
  - Resolusi metadata cepat via `yt-dlp --dump-json` dan fallback resilien ke official YouTube oEmbed API jika `yt-dlp` belum terpasang.
  - Proteksi penuh terhadap command injection menggunakan pemanggilan vector argument array di Rust.
- Native Anti-CORS Lyrics Proxy (`src-tauri/src/commands/lyrics_proxy.rs`):
  - IPC bridge `lyrics_http_get` untuk querying endpoint NetEase dan LRCLIB tanpa hambatan browser CORS.
  - Domain allowlist ketat (`lrclib.net`, `music.163.com`, `qq.com`, `kugou.com`).
- Multi-Source Lyrics Engine (`src/services/lyrics/`):
  - `lrclib.ts`: Pencarian terbuka LRCLIB untuk lirik tersinkronisasi baris dan kata.
  - `netease.ts`: Pencarian katalog J-Pop/Anime/K-Pop NetEase dengan dukungan lirik terjemahan dan word-timed format `.yrc`.
  - `similarity.ts`: Algoritma normalisasi pembersih judul (`cleanTitle`), kalkulasi bigram Dice coefficient, dan toleransi durasi ($\le 4\text{s}$) untuk pemeringkatan skor kecocokan kandidat.
  - `lrcParser.ts`: Parser serbaguna untuk standard LRC, enhanced word-synced LRC (`<mm:ss.xx>`), dan NetEase YRC (`[start,dur](start,dur,0)`) ke struktur `SubtitleLine[]` dengan `RubyToken[]`.
  - `lyricsAggregator.ts`: Penggabungan concurrent via `Promise.allSettled`, deduplikasi cerdas, dan pengurutan kandidat terbaik.
- Integrasi UI Drawers & Theme Adaptation:
  - `LyricsDrawer.tsx`: Antarmuka pencarian multi-source dengan badge skor kecocokan persentase, indikator word-sync, preview lirik langsung, dan tab manual paste dengan deteksi jumlah baris.
  - `YouTubeDrawer.tsx`: Card metadata video YouTube resolusi tinggi dengan thumbnail, channel, durasi, status yt-dlp, dan 1-klik "Load into Studio" yang otomatis merekayasa palet variabel dinamis CSS Gatefold OKLCH (`extractFromCover`).
- Quality Gates & Tests:
  - 43 dari 43 unit test Vitest lulus 100% (penambahan `similarity.test.ts`, `lrcParser.test.ts`, `lyricsAggregator.test.ts`).
  - 7 dari 7 unit test Rust backend lulus 100% (`ytdl` tests, `lyrics_proxy` tests, `system_info`, `hardware_caps`).
  - `npm run build` dan `cargo check` berhasil tanpa error.

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
