# Testing & Quality Assurance Plan: SubStellar

**Document Version:** 1.0.0  
**Status:** Approved Standard  
**Target Repository:** `https://github.com/SayMaven/sub-stellar`  
**Coverage Target:** Minimal 70%–80% pada Core Modules (`src/engine/`, `src/stores/`, `src-tauri/`)

---

## 1. Piramida & Strategi Pengujian (Test Pyramid)

SubStellar menerapkan strategi pengujian bertingkat untuk menjamin keandalan aplikasi desktop multimedia:

```
                  / \
                 /   \
                / E2E \       <-- Playwright / WebDriver (Alur UI Penuh)
               /-------\
              / Integr. \     <-- Store + Engine + Web Worker + IPC Mock
             /-----------\
            / Unit Testing\   <-- Vitest (TS) & Cargo Test (Rust) [Cepat & Mandiri]
           /---------------\
```

---

## 2. Rincian Lapisan Pengujian

### 2.1 Unit Testing
* **Tooling:** **Vitest** (Frontend TypeScript) & **Cargo Test** (Backend Rust).
* **Fokus Pengujian:**
  - **Subtitle Parsers (`src/engine/parsers/`):**
    - Parsing format standar LRC, Enhanced LRC (`<mm:ss.xx>`), NetEase YRC, dan ASS dialog.
    - Validasi penanganan string kosong, tag rusak, dan durasi negatif.
  - **Morphological & Furigana Engine (`src/engine/furigana/`):**
    - Konversi token kanji $\rightarrow$ hiragana.
    - Parsing dan serialisasi sintaks tag Markdown Ruby `{漢字|かんじ}`.
    - Perhitungan offset $X$ dan $Y$ teks ruby terhadap kanji dasar.
  - **Typography & Unicode Math (`src/engine/text/`):**
    - Pemotongan karakter majemuk (grapheme clusters via `Intl.Segmenter`).
    - Aturan pemenggalan baris CJK (*Kinsoku Shori*).
  - **Rust Command Logic (`src-tauri/src/commands/`):**
    - Sanitasi path dan nama file.
    - Parsing output metadata dari FFmpeg dan yt-dlp.

### 2.2 Integration Testing
* **Tooling:** Vitest + `@testing-library/react`.
* **Fokus Pengujian:**
  - **Audio Clock $\leftrightarrow$ Subtitle Synchronization:** Memastikan `useStudioStore` memancarkan event pembaruan baris aktif dan kata aktif secara sinkron terhadap loncatan timecode.
  - **Web Worker Off-Thread Bridge:** Menguji pengiriman buffer biner audio ke `waveform.worker.ts` dan penerimaan array peak data downsampled tanpa memblokir thread pengujian.
  - **Tauri IPC Mocking:** Menguji service API (`tauriBridge.ts`) dengan mock backend Rust untuk memverifikasi alur error (misal: YouTube download gagal atau file tidak ditemukan).

### 2.3 End-to-End (E2E) Testing
* **Tooling:** **Playwright** (menargetkan WebView2 / browser dev build).
* **Skenario Kritis E2E:**
  1. **Alur 1-Klik Unduh & Sync:** User menempel URL YouTube $\rightarrow$ thumbnail dan judul termuat $\rightarrow$ lirik online terambil $\rightarrow$ Furigana ter-generate $\rightarrow$ tombol play ditekan $\rightarrow$ canvas menampilkan teks beranimasi.
  2. **Alur Manual Timing Editor:** User men-drag block lirik pada timeline $\rightarrow$ timestamp tersimpan di store $\rightarrow$ seekbar melompat ke posisi baru.
  3. **Alur Ekspor Video:** User memilih preset ekspor $\rightarrow$ proses render berjalan $\rightarrow$ file MP4/WebM tersimpan di direktori tujuan.

---

## 3. Performance & Memory Leak Testing (Khusus Desktop & Partikel)

Aplikasi desktop berbasis kanvas partikel sangat rentan terhadap kebocoran memori (*memory leaks*) dan *stuttering*. SubStellar menerapkan pengujian performa ketat:

### 3.1 Memory Leak Testing (Zero-GC Verification)
* **Metode Pengujian:** Otomatisasi via Chrome DevTools Protocol (CDP) di Playwright:
  1. Rekam ukuran memori heap awal (*Baseline Snapshot*).
  2. Jalankan pemutaran lagu dengan 500+ partikel aktif selama 3 menit terus-menerus.
  3. Paksa Garbage Collection via CDP (`HeapProfiler.collectGarbage`).
  4. Ambil snapshot akhir dan bandingkan:
     $$\Delta\text{Retained Heap} \le 5\text{ MB}$$
  5. **Kriteria Kelulusan:** Tidak boleh ada objek `Particle`, `Text`, atau `Texture` yang tertinggal di memori setelah pemutaran dihentikan.

### 3.2 Frame Rate & Stress Testing (Low-End Benchmark)
* **Alat:** PixiJS internal ticker monitor & Vitest benchmark.
* **Metrik:**
  - Jalankan 250 partikel aktif pada simulasi CPU throttling $4\times$ slowdown (meniru prosesor laptop dual-core lama).
  - **Kriteria:** Rata-rata frame rate tidak boleh drop di bawah **58 FPS**; 99th percentile frame time $< 17.5\text{ ms}$.

---

## 4. Cross-Platform Testing

Meskipun rilis awal menargetkan Windows 10/11, arsitektur diuji lintas platform melalui runner CI:

| Platform | Lingkungan Uji | Fokus Pengujian |
| :--- | :--- | :--- |
| **Windows 10/11** | Physical Device & GitHub Windows Runner | WebView2 lifecycle, Direct3D WebGPU, hardware encoder probing (NVENC/QSV/AMF), path backslash `\`. |
| **macOS (Sonoma/Sequoia)** | GitHub macOS Runner (M1/M2 VM) | WKWebView, Metal graphics context, path forward slash `/`. |
| **Linux (Ubuntu 22.04+)** | GitHub Linux Container | WebKitGTK, Mesa OpenGL, sistem audio PulseAudio/PipeWire. |

---

## 5. Otomasi CI/CD (GitHub Actions Pipeline)

Setiap Pull Request atau commit ke `main` akan secara otomatis memicu alur kerja pengujian:

```yaml
# .github/workflows/ci.yml (Konsep Pipeline)
name: SubStellar CI Quality Gates

on: [push, pull_request]

jobs:
  static-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:coverage

  rust-verification:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo check --manifest-path src-tauri/Cargo.toml
      - run: cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
      - run: cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 6. User Acceptance Testing (UAT)

Pengujian penerimaan pengguna dilakukan dengan skenario nyata:

| ID Skenario | Langkah Pengujian | Hasil yang Diharapkan |
| :--- | :--- | :--- |
| **UAT-01** | Buka lagu J-Pop berbahasa Jepang yang memiliki kanji kompleks (contoh: *Chata - Hoshizora no Memoria*). | Furigana muncul tepat di atas kanji secara otomatis tanpa teks bertumpukan. |
| **UAT-02** | Ubah tema antarmuka ke mode "From the cover". | Seluruh aksen warna UI berubah mengikuti palet cover album dengan transisi halus. |
| **UAT-03** | Ekspor video transparan WebM (VP9 + Alpha), lalu import ke Premiere / DaVinci Resolve. | Video berlatar belakang transparan sempurna; teks dan partikel terlihat tajam di atas video lain. |
| **UAT-04** | Putar lagu pada laptop dengan Intel UHD Graphics di mode kualitas "Low". | UI tetap responsif, kipas laptop tidak meraung, CPU usage stabil di bawah 20%. |

---

## 7. Target Cakupan Uji (Test Coverage Targets)

| Modul Direktori | Target Minimal Coverage | Prioritas |
| :--- | :---: | :---: |
| `src/engine/parsers/` (LRC, YRC, ASS) | **$\ge 85\%$** | Kritis (P0) |
| `src/engine/furigana/` (Morphology & Ruby math) | **$\ge 80\%$** | Kritis (P0) |
| `src/engine/particles/` (Object Pool & Emitter) | **$\ge 75\%$** | Tinggi (P1) |
| `src/stores/` (Zustand State Orchestrator) | **$\ge 80\%$** | Tinggi (P1) |
| `src-tauri/src/commands/` (FFmpeg & Ytdl wrappers) | **$\ge 70\%$** | Tinggi (P1) |
| `src/components/` (Presentational UI) | $\ge 50\%$ | Menengah (P2) |

