# Code Quality & Engineering Practices: SubStellar

**Document Version:** 1.0.0  
**Status:** Approved Standard  
**Target Repository:** `https://github.com/SayMaven/sub-stellar`  
**Scope:** Frontend (React 19/TS), Backend (Rust/Tauri v2), Engine Rendering (PixiJS v8), & Workflow CI/CD

---

## 1. Coding Standards & Style Guide

### 1.1 TypeScript & React 19 Standards
* **Strict Compiler Configuration (`tsconfig.json`):**
  - `"strict": true` wajib aktif tanpa kompromi.
  - `"noImplicitAny": true`, `"strictNullChecks": true`, `"noUncheckedIndexedAccess": true`.
  - Dilarang keras menggunakan tipe `any`. Gunakan `unknown` dengan type-guarding atau buat interface eksplisit.
* **Konvensi Penamaan (Naming Conventions):**
  - **Komponen React:** `PascalCase.tsx` (contoh: `WaveformCanvas.tsx`, `LyricsDialog.tsx`).
  - **Hooks Kustom:** `camelCase.ts` berawalan `use` (contoh: `useWaveform.ts`, `useAudioClock.ts`).
  - **Stores Zustand:** `camelCase.ts` berawalan `use` dan berakhiran `Store` (contoh: `useStudioStore.ts`).
  - **Service & Utility:** `camelCase.ts` (contoh: `lyricsSources.ts`, `timeUtils.ts`).
  - **Types & Interfaces:** `PascalCase.ts` (contoh: `SubtitleLine`, `RubyPair`).
* **Komponen & Arsitektur React:**
  - Utamakan Functional Components murni dengan Hooks.
  - Hindari fungsi raksasa (>150 baris per file). Pecah sub-view kompleks menjadi sub-komponen terpisah.
  - Gunakan `useCallback` dan `useMemo` secara selektif pada kalkulasi berat atau props yang diteruskan ke komponen kanvas.

### 1.2 Rust (Tauri v2 Backend) Standards
* **Formatting & Linting:**
  - Wajib mematuhi `rustfmt` dan `clippy` tanpa peringatan (`cargo clippy -- -D warnings`).
* **Error Handling Idiomatis:**
  - Dilarang menggunakan `.unwrap()` atau `.expect()` pada kode produksi!
  - Wajib menggunakan enum error tersentralisasi (`enum AppError`) yang mengimplementasikan `std::error::Error` atau `thiserror`, dengan pengembalian `Result<T, AppError>`.
  - Error yang dikirim ke frontend wajib diserialisasi menjadi pesan JSON yang ramah pengguna.
* **Memory Safety & Concurrency:**
  - Hindari `unsafe` block kecuali pada binding native eksternal yang terisolasi dan terdokumentasi ketat.
  - Gunakan `Arc<Mutex<T>>` atau `tokio::sync::RwLock` untuk state yang diakses multi-thread.

### 1.3 CSS & Theming Standards
* Utamakan utility classes Tailwind CSS.
* Nilai warna dinamis wajib merujuk ke token CSS variabel `@property` Gatefold (`var(--bg)`, `var(--text)`, `var(--accent)`, `var(--glow)`). Dilarang menulis *hardcoded hex color* pada komponen UI standar.

### 1.4 Kebijakan Desain & Kode Tanpa Emoji (Strict No-Emoji Policy)
* **Larangan Penggunaan Emoji:** Dilarang menggunakan karakter emoji pada seluruh aspek proyek:
  - Antarmuka pengguna (UI buttons, tabs, labels, toast notifications, badges, empty states).
  - Pesan log, error message, dan komentar kode sumber.
  - Seluruh dokumen teknis, PRD, arsitektur, panduan, dan commit message.
* **Alasan:** Menjaga estetika antarmuka tetap profesional, minimalis, elegan, dan bersih layaknya software workstation kelas industri, serta mencegah masalah font rendering / glyph tofu pada sistem operasi tanpa font emoji yang lengkap.
* **Alternatif Visual:** Gunakan ikon SVG garis minimalis seragam (Lucide Icons) atau teks deskriptif yang lugas.

---

## 2. Clean Code & Penerapan Prinsip SOLID

Arsitektur SubStellar dirancang secara disiplin mengikuti prinsip **SOLID**:

```
[ S ] Single Responsibility: Satu modul, satu tugas fokus.
[ O ] Open / Closed        : Terbuka untuk ekstensi, tertutup untuk modifikasi liar.
[ L ] Liskov Substitution  : Semua parser/emitter saling menggantikan melalui kontrak interface.
[ I ] Interface Segregation: Interface ramping, spesifik, dan tidak memaksa implementasi mubazir.
[ D ] Dependency Inversion : High-level engine bergantung pada abstraksi, bukan konkrit scraper.
```

### 2.1 Single Responsibility Principle (SRP)
* `WaveformCanvas.tsx` hanya bertugas menggambar visual gelombang audio; kalkulasi downsample peaks dilakukan oleh `waveform.worker.ts`.
* `SubtitleRenderer.ts` hanya bertugas menghitung metrik dan menggambar teks; data status pemutaran dikelola oleh `useStudioStore.ts`.
* `ParticleManager.ts` hanya bertugas mengatur siklus hidup partikel; fisika gerak diisolasi di `Emitter.ts`.

### 2.2 Open/Closed Principle (OCP)
* Menambahkan provider lirik baru (misal: Genius atau Bandcamp) tidak boleh mengubah kode internal `useLyricsStore`. Cukup membuat kelas baru yang mengimplementasikan interface `LyricsProvider` dan mendaftarkannya ke array providers.

### 2.3 Liskov Substitution Principle (LSP)
* Semua parser subtitle (`LrcParser`, `YrcParser`, `AssParser`, `SrtParser`) mengimplementasikan interface tunggal:
  ```typescript
  export interface SubtitleParser {
    parse(content: string): ParsedSubtitleResult;
    serialize(data: SubtitleLine[]): string;
  }
  ```
  Setiap parser dapat saling menggantikan tanpa merusak consumer logic.

### 2.4 Interface Segregation Principle (ISP)
* Alih-alih membuat satu interface raksasa `TrackMedia` dengan 50 properti, pisahkan menjadi antarmuka modular:
  - `PlayableAudio` (durasi, sampleRate, audioBuffer).
  - `VisualDisplayable` (aspectRatio, resolution, thumbnail).
  - `LyricsSyncable` (lines, currentLineIndex).

### 2.5 Dependency Inversion Principle (DIP)
* Modul rendering tidak mengimpor objek Webview atau file IO secara langsung, melainkan mengandalkan abstraksi bridge (`TauriBridgeService`) sehingga engine grafis dapat dijalankan di lingkungan pengujian tanpa runtime Tauri.

---

## 3. Arsitektur Modular & Pemeliharaan (Maintainability)

### 3.1 Path Aliasing Bebas Impor Relatif
Menggunakan path alias bersih pada `tsconfig.json` dan `vite.config.ts`:
```typescript
{
  "@/components/*": ["src/components/*"],
  "@/engine/*":     ["src/engine/*"],
  "@/stores/*":     ["src/stores/*"],
  "@/services/*":   ["src/services/*"],
  "@/types/*":      ["src/types/*"],
  "@/styles/*":     ["src/styles/*"]
}
```
*Dilarang menggunakan impor bertingkat liar seperti `../../../../components/Button`.*

### 3.2 Aturan Zero Circular Dependencies
* Modul `engine/` tidak boleh mengimpor dari `components/`.
* Modul `types/` berdiri sendiri murni dan tidak boleh mengimpor runtime logic dari manapun.

---

## 4. Version Control & Strategi Percabangan Git

### 4.1 Branching Strategy: Trunk-Based Development (Recommended)
Untuk pengembangan yang cepat, adaptif, dan minim konflik merge:
* **`main`**: Cabang utama yang selalu stabil, siap dirilis (*always shippable*).
* **Feature Branches (`feat/*`, `fix/*`, `perf/*`)**: Cabang jangka pendek (*short-lived* < 2-3 hari) yang langsung di-merge kembali ke `main` melalui Pull Request setelah lolos verifikasi.

### 4.2 Standar Konvensi Commit (Conventional Commits)
Format commit wajib menggunakan standar: `<tipe>(<lingkup opsional>): <deskripsi singkat>`

| Tipe | Penggunaan | Contoh |
| :--- | :--- | :--- |
| **`feat`** | Penambahan fitur baru | `feat(furigana): add automatic kanji to hiragana generator` |
| **`fix`** | Perbaikan bug | `fix(waveform): prevent canvas overflow on zero-duration audio` |
| **`perf`** | Peningkatan performa | `perf(particles): implement zero-gc object pool for sparkles` |
| **`refactor`**| Restrukturisasi kode tanpa mengubah fungsionalitas | `refactor(theme): modularize oklch color token calculation` |
| **`docs`** | Pembaruan dokumentasi | `docs(prd): add international unicode and typography standard` |
| **`test`** | Penambahan atau perbaikan unit test | `test(parser): add test suite for NetEase YRC word timing` |
| **`chore`** | Pembaruan dependensi, build script, konfigurasi | `chore(deps): update pixi.js to v8.6.6` |

---

## 5. Alur Code Review & Quality Gates

Setiap Pull Request atau penambahan modul wajib melalui checklist otomatis sebelum digabungkan (*merged*):

```
+-------------------------------------------------------------------------------+
|                             PR QUALITY GATES                                  |
|                                                                               |
|  [Gate 1: Static Analysis]  npm run lint && tsc --noEmit (0 Error)            |
|  [Gate 2: Rust Verification] cargo check && cargo clippy -- -D warnings (Lolos)|
|  [Gate 3: Automated Tests]  npm run test (Unit test parser & math bounds)     |
|  [Gate 4: Build Integrity]  npm run build && cargo build --release (Sukses)   |
|  [Gate 5: Low-End Hardware] RAM < 120MB idle, zero-GC check pada partikel     |
+-------------------------------------------------------------------------------+
```

---

## 6. Manajemen Technical Debt (Hutang Teknis)

1. **Aturan Pramuka (*The Boy Scout Rule*):**
   > *"Selalu tinggalkan kode dalam keadaan lebih bersih dan rapi daripada saat Anda pertama kali membukanya."*
2. **Dokumentasi Terbuka `TODO` & `FIXME`:**
   Setiap kompromi sementara wajib disertai komentar terstruktur:
   `// TODO(perf): migrate to WebGPU compute shader once Tauri v2.3 stabilizes`
3. **Audit Siklus Refactoring:**
   Setiap akhir fase implementasi, dialokasikan sesi refactoring khusus untuk merapikan modul yang mulai kompleks (*cyclomatic complexity* > 10).

---

## 7. Manajemen Dependensi & Pemindaian Keamanan

### 7.1 Aturan Pemilihan Library Pihak Ketiga
1. **Prinsip Minimalis:** Jangan menambah dependensi npm untuk hal sepele yang dapat diselesaikan dengan 10–20 baris kode native TypeScript.
2. **Kesesuaian Lisensi:** Hanya izinkan library dengan lisensi permisif ramah open-source / komersial: **MIT, Apache 2.0, BSD-3-Clause, ISC**. Dilarang menggunakan library berlisensi viral GPL tanpa izin arsitektur khusus.
3. **Pengecekan Rutin Keamanan:**
   - Frontend: `npm audit` wajib bersih dari kerentanan kategori *High* atau *Critical*.
   - Backend Rust: `cargo audit` untuk memindai basis data kerentanan RustSec.
4. **Strict Version Pinning:**
   Library inti penentu stabilitas (`pixi.js`, `@tauri-apps/api`, `kuroshiro`) dipin versinya secara presisi untuk menghindari *breaking changes* akibat update otomatis patch version.

