# Product Requirements Document (PRD) & Feasibility Study: SubStellar

**Document Version:** 1.0.0  
**Status:** Approved for Architectural Design  
**Target Repository:** `https://github.com/SayMaven/sub-stellar`  
**Reference Design:** Gatefold Foobar2000 (`F:\CODE\forking\gatefold-foobar2000`)

---

## 1. Visi Produk & Problem Statement

### 1.1 Problem Statement
1. **Kurva Pembelajaran Terlalu Tinggi untuk Efek Mewah:** Software subtitle legendaris seperti **Aegisub** mengandalkan format `.ass` dan scripting Lua tingkat lanjut (`kara-templater` / `PyonFX`) yang terlalu sulit bagi 95% pembuat konten video musik, AMV (*Anime Music Video*), dan klip lirik.
2. **Keterbatasan Tipografi Asia di Software Populer:** Editor video mainstream seperti **CapCut** atau **Premiere Pro** memiliki auto-caption dasar, namun **tidak memiliki dukungan bawaan untuk Furigana / Ruby text** (bacaan hiragana di atas kanji), efek partikel kosmik dinamis yang sinkron dengan vokal, atau ekspor video transparan tanpa proses render yang berat.
3. **Software Berat & Rakus Memori:** After Effects membutuhkan spesifikasi komputer kelas berat (RAM 16–32 GB, GPU diskrit) hanya untuk merender efek lirik partikel sederhana. Tidak ada tool ringan yang bisa berjalan lancar di **laptop low-end (Intel HD Graphics, RAM 4 GB)**.
4. **Alur Kerja Terpecah-pecah:** Kreator harus mengunduh audio di situs A, mencari lirik tersinkronisasi di situs B, menyalin ke editor teks di software C, lalu merender di software D.

### 1.2 Visi Produk: SubStellar
**SubStellar** hadir sebagai *all-in-one desktop studio* yang menggabungkan:
* Kecepatan alur kerja **1-klik otomatis** (Unduh audio/video $\rightarrow$ auto-fetch lirik tersinkron $\rightarrow$ auto-generate Furigana $\rightarrow$ terapkan preset partikel bintang).
* **Fleksibilitas kontrol presisi manual** (timeline waveform per suku kata, penyesuaian font, multi-stroke, glow, dan emitter partikel).
* **Desain UI Elegan ala Gatefold** yang estetik dan adaptif.
* **Performa Ekstrem Ringan**: Berjalan mulus di perangkat low-end berbasis **Tauri v2 + PixiJS v8**.

---

## 2. Functional Requirements (FR) vs Non-Functional Requirements (NFR)

### 2.1 Functional Requirements (FR)

| ID | Modul / Fitur | Deskripsi Kebutuhan Fungsional |
| :--- | :--- | :--- |
| **FR-01** | **YouTube Media Ingest** | Pengguna dapat menempel link YouTube atau mencari video langsung dari aplikasi. Sistem dapat mengunduh video (1080p/720p) atau mengekstrak audio (M4A/Opus) secara otomatis. |
| **FR-02** | **Multi-Source Lyrics Fetcher** | Pencarian lirik otomatis dan manual ke 5 provider: LRCLIB, NetEase Cloud Music, QQ Music, Kugou, dan Musixmatch. Mendukung lirik biasa dan tersinkronisasi (*word-synced* format LRC & YRC). |
| **FR-03** | **Furigana / Ruby Engine** | Mendeteksi aksara Kanji Jepang secara otomatis dan meng-generate Hiragana/Katakana Furigana di atasnya. Mendukung format tag `{漢字|かんじ}` serta antarmuka klik-untuk-edit manual. |
| **FR-04** | **PixiJS v8 Particle Engine** | Merender partikel bintang (*stardust*), kilau (*sparkles*), dan aura kosmik di sekitar teks yang sedang aktif dinyanyikan dengan *additive blend mode* 60 FPS. |
| **FR-05** | **Advanced Text Typography** | Mendukung *multi-layer outline* (stroke ganda: inner kontras + outer gelap), gradien warna teks, dan shader *outer glow/bloom*. |
| **FR-06** | **Audio Waveform & Timeline** | Menampilkan visualisasi waveform audio. Pengguna dapat menggeser batas awal/akhir baris lirik serta memotong/menyesuaikan durasi kata per kata (*word timing*). |
| **FR-07** | **Interactive Transport Bar** | Kontrol playback: Play/Pause, Seekbar, Step forward/backward per baris lirik, Volume, Speed (0.5x - 2.0x), dan Loop playback. |
| **FR-08** | **Gatefold Dynamic Theming** | UI mengekstrak warna dominan & aksen dari thumbnail video/cover lagu secara otomatis (*ambient aurora backlight*). Opsi tema manual: Dark, Light, Grey, Custom Accent. |
| **FR-09** | **Export Pipeline (FFmpeg)** | • **Burn-in Video:** Render video MP4 dengan subtitle menyatu.<br/>• **Transparent Video:** Render video transparan (WebM VP9 + Alpha atau Apple ProRes 4444) untuk drag-and-drop ke Premiere/DaVinci.<br/>• **Subtitle Script:** Export ke format file `.ass` dan `.lrc`. |
| **FR-10** | **Preset System** | Simpan dan terapkan preset gaya visual (J-Pop MV, Cyberpunk Neon, Minimalist Lyric, Retro Glow) dengan 1 klik. |
| **FR-11** | **Universal Unicode & Multilingual** | Mendukung seluruh sistem aksara dunia (Latin, CJK, Arab, Ibrani, Thai, Devanagari Hindi, Kiril). Menggunakan `Intl.Segmenter` (grapheme clusters anti-pecah), algoritma BiDi (UAX #9) untuk teks campuran RTL+LTR, dan aturan *Kinsoku Shori* untuk CJK word-wrap. |
| **FR-12** | **Custom Fonts & System Discovery** | Mendukung import file font (`.ttf`, `.otf`, `.woff`, `.woff2`) via drag & drop, deteksi otomatis seluruh font yang terinstall di OS pengguna, serta katalog Google Fonts terintegrasi. Pengaturan font independen untuk Base text vs Furigana ruby text. |

### 2.2 Non-Functional Requirements (NFR)

| ID | Parameter | Standar Target Kinerja |
| :--- | :--- | :--- |
| **NFR-01** | **RAM Footprint** | • Idle: **< 120 MB RAM**<br/>• Playback + 500 partikel: **< 250 MB RAM** (Ramah RAM 4 GB). |
| **NFR-02** | **Frame Rate (FPS)** | Stabil pada **$\ge 58\text{ FPS}$** pada mode grafis *Low* di laptop dengan Integrated GPU (Intel HD 4400 / UHD 620). |
| **NFR-03** | **Cold Startup Time** | Aplikasi siap digunakan dalam waktu **< 1.5 detik** pada media penyimpanan SSD (< 3.5 detik pada HDD). |
| **NFR-04** | **Zero UI Freezing** | Proses berat (audio waveform peak calculation, Kuromoji NLP parsing, pencarian lirik online) wajib berjalan di Web Worker / background thread tanpa memblokir UI thread. |
| **NFR-05** | **Zero-GC Object Pooling** | Tidak ada lonjakan Garbage Collection (GC) saat partikel memancar terus-menerus selama pemutaran lagu. |
| **NFR-06** | **Hardware Fault Tolerance**| Ekspor FFmpeg otomatis melakukan deteksi bertingkat (`NVENC` $\rightarrow$ `QSV` $\rightarrow$ `AMF` $\rightarrow$ CPU `libx264 veryfast`) tanpa pernah crash jika GPU encoder tidak tersedia. |
| **NFR-07** | **Keamanan & Privasi** | 100% pemrosesan media lokal di komputer pengguna. Tidak ada data audio/video yang dikirim ke server pihak ketiga. |
| **NFR-08** | **WYSIWYG Font Fidelity** | Hasil render ekspor video 100% identik dengan tampilan preview canvas, tanpa resiko font fallback mismatch saat diekspor. |

### 2.3 Standar Baku Tipografi, Aksara Global & Unicode (Anti-Pecah)

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

---

## 3. User Personas & User Stories

### Persona 1: Rei (19) — AMV & VTuber Clip Editor
* **Latar Belakang:** Sering membuat video klip lirik lagu J-Pop / Vocaloid / VTuber untuk YouTube dan TikTok.
* **Pain Point:** Ingin subtitle bergaya Jepang dengan Furigana di atas Kanji dan efek kilau bintang, tapi pusing belajar script Lua di Aegisub dan laptopnya sering lag saat memakai After Effects.
* **User Story:**
  > *Sebagai seorang pembuat klip AMV, saya ingin memasukkan link lagu YouTube dan langsung mendapatkan lirik berbahasa Jepang lengkap dengan Furigana dan efek partikel bintang dalam 1 klik, sehingga saya bisa memproduksi video berkualitas tinggi tanpa harus menulis script manual.*

### Persona 2: Budi (24) — Video Editor & Musisi Indie
* **Latar Belakang:** Mengedit video klip musik di DaVinci Resolve / Adobe Premiere.
* **Pain Point:** Benci mengetik lirik satu per satu dan mengatur timing manual di timeline Premiere yang lambat.
* **User Story:**
  > *Sebagai video editor, saya ingin mengekspor subtitle beranimasi dalam format video transparan (Alpha channel), sehingga saya bisa langsung men-drag-and-drop file tersebut sebagai layer overlay di atas timeline DaVinci Resolve saya.*

### Persona 3: Kenji (21) — Pembelajar Bahasa Jepang & Fansubber
* **Latar Belakang:** Membuat video karaoke lirik lagu anime untuk sarana belajar membaca kanji.
* **Pain Point:** Furigana otomatis sering salah membaca kanji khusus (*ateji* / nama orang).
* **User Story:**
  > *Sebagai fansubber, saya ingin dapat mengklik kata kanji apapun di timeline dan mengganti bacaan hiragana-nya secara instan lewat popup editor, sehingga lirik saya akurat 100%.*

---

## 4. Scope: In-Scope vs Out-of-Scope (Versi 1.0)

### 4.1 In-Scope (Fitur Versi 1.0)
1. Desktop App Windows (Tauri v2 + WebView2).
2. YouTube Video & Audio downloader terintegrasi (`yt-dlp`).
3. Multi-source lyrics search (LRCLIB, NetEase, QQ, Kugou) dengan word-sync YRC/LRC.
4. Auto & Manual Furigana / Ruby text engine.
5. PixiJS v8 real-time preview (Text multi-stroke, glow, dan particle emitters).
6. Tri-tier performance modes (Low, Balanced, Ultra) untuk mendukung hardware low-end.
7. Bottom timeline audio waveform dengan scrubber presisi sub-detik.
8. Export video MP4 (burn-in) dan WebM/ProRes (alpha transparent).
9. Export file subtitle standar `.ass` dan `.lrc`.
10. UI bertema Gatefold dengan ambient dynamic color palette extraction.

### 4.2 Out-of-Scope (Bukan untuk V1.0 — Direncanakan untuk Versi Mendatang)
1. **Full NLE Multi-Track Video Editor:** SubStellar bukan pengganti Premiere Pro (tidak ada fitur cutting video multi-layer, transisi video antar klip, atau color grading video mentah).
2. **AI Stem Separation:** Memisahkan instrumen dan vokal (Vocal Remover) — fitur ini butuh resource GPU berat (akan disediakan via external plugin di masa depan).
3. **Mobile Apps (iOS / Android):** V1.0 fokus penuh pada platform desktop (Windows 10/11) dengan fondasi arsitektur siap lintas platform (macOS/Linux).
4. **Cloud Project Sync:** Proyek disimpan secara lokal di komputer pengguna (file `.substellar`).

---

## 5. Success Metrics (KPI & Acceptance Benchmarks)

| Metrik KPI | Target Keberhasilan | Cara Mengukur |
| :--- | :--- | :--- |
| **Time-to-First-Preview** | **< 30 detik** dari menempel link YouTube hingga preview subtitle berpartikel tampil di layar. | Stopwatch pengujian end-to-end. |
| **FPS Stabilitas (Low-End)**| **$\ge 58\text{ FPS}$** konstan pada pengujian laptop Intel Core i3 / Intel HD 4400. | PixiJS Ticker FPS telemetry. |
| **Kecepatan Render Ekspor**| • GPU: **$\ge 2.5\times$ real-time** (lagu 3 menit selesai < 1.2 menit).<br/>• CPU Low-End: **$\ge 1.0\times$ real-time** (lagu 3 menit selesai < 3 menit). | Benchmark log FFmpeg duration. |
| **Akurasi Auto Furigana** | **$\ge 92\%$ akurasi** tokenisasi morfem kanji ke hiragana pada lirik lagu standar. | Pengujian terhadap 20 lagu J-Pop populer. |
| **Dukungan Alpha Video** | File export WebM VP9 / ProRes 4444 100% transparan saat di-overlay di Premiere & DaVinci. | Verifikasi visual layer komposit. |

---

## 6. Competitive Analysis (Analisis Pesaing)

| Fitur / Parameter | **SubStellar** | **Aegisub** | **CapCut Desktop** | **Subtitle Edit** | **After Effects** |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Tampilan UI & Estetika** | **Modern & Elegan (Gatefold)** | Kuno (Win32 era 2000-an) | Modern tapi padat iklan | Standar utilitas Windows | Kompleks & intimidatif |
| **Efek Partikel Bintang / Sparkles**| **Bawaan (60 FPS WebGPU/GL)** | Butuh script Lua rumit | Terbatas (Stiker video) | Tidak ada | Ada (Plugin berbayar) |
| **Furigana / Ruby Text Asli** | **Auto + Manual UI** | Script manual tag ASS | Tidak didukung rapi | Terbatas | Manual text layer |
| **Performa di PC Low-End (RAM 4GB)**| **Sangat Ringan (~150MB)** | Sangat Ringan | Berat (sering lag) | Sangat Ringan | Tidak kuat / Crash |
| **YouTube & Lirik Terintegrasi** | **Bawaan 1-Klik** | Tidak ada | Auto-transcribe saja | Ada download lirik | Tidak ada |
| **Export Video Transparan (Alpha)** | **WebM VP9 & ProRes** | Hanya file script | Export video biasa | Hanya render hardsub | ProRes 4444 |
| **Kurva Belajar Pengguna** | **Sangat Mudah (Preset)** | Sangat Sulit | Mudah | Sedang | Sangat Sulit |

> **Kesimpulan Kompetitif:** SubStellar mengisi ceruk kosong yang belum pernah dijamah: kemudahan penggunaan layaknya CapCut, namun memiliki kedalaman tipografi Asia (Furigana) dan keindahan efek visual partikel kosmik layaknya Aegisub scripting / After Effects, dengan performa super ringan.

---

## 7. Feasibility Study (Studi Kelayakan)

### 7.1 Kelayakan Teknis (Technical Feasibility) — **SANGAT TINGGI (High)**
1. **Tauri v2 + WebView2:** Sudah matang dan stabil. Mendukung IPC berkecepatan tinggi, sidecar process execution, dan akses sistem file lokal yang aman.
2. **PixiJS v8:** Engine rendering 2D tercepat di ekosistem web saat ini. Fitur `ParticleContainer` mampu mengisolasi partikel ke dalam single batch draw call, memastikan beban CPU dan GPU tetap minimal.
3. **Kuromoji + Kuroshiro:** Library JavaScript murni yang terbukti stabil untuk tokenisasi bahasa Jepang. Dapat dijalankan secara lokal tanpa perlu server eksternal.
4. **FFmpeg Sidecar:** Standar industri dunia untuk video processing. Mendukung input raw frame dari stdin pipe sehingga proses render video tidak membutuhkan file gambar sementara di harddisk (*zero temporary disk I/O*).

### 7.2 Kelayakan Legal & Ekosistem (Legal & Ecosystem Feasibility) — **AMAN (Compliant)**
1. **Lirik Musik:**
   - Provider seperti **LRCLIB** menyediakan API publik terbuka tanpa biaya (lisensi terbuka).
   - Pengambilan lirik berstatus personal fair-use untuk pemutaran lokal.
2. **YouTube Download (`yt-dlp`):**
   - Menggunakan software open-source legal yang bertindak atas nama pengguna lokal (*client-side execution*). Tidak ada hosting konten berhak cipta di server SubStellar.
3. **Open Source Ecosystem:**
   - Seluruh library yang digunakan (React, Tauri, PixiJS, Tailwind, Radix) berlisensi ramah komersial/personal (MIT / Apache 2.0).

