# Engineering Standards & Code Quality Directives

Mengatur aturan baku penulisan kode, konvensi commit, dan penjaminan kualitas untuk pengembang dan AI Agent pada repositori **SubStellar**.

---

## 1. Standar TypeScript & React 19
* Wajib `"strict": true` tanpa tipe `any`.
* Gunakan Functional Components + Hooks.
* Komponen UI tidak boleh melebihi 150 baris per file; pecah menjadi sub-komponen modular.
* Penamaan file: `PascalCase.tsx` untuk komponen, `camelCase.ts` untuk fungsi/hooks/stores/services.

## 2. Standar Rust (Tauri v2)
* Wajib lolos `cargo clippy -- -D warnings`.
* Dilarang menggunakan `.unwrap()` pada kode produksi. Wajib gunakan `Result<T, AppError>`.

## 3. Penerapan Prinsip SOLID
* **SRP:** Pisahkan UI, kalkulasi worker, dan manipulasi store.
* **OCP & LSP:** Semua parser subtitle wajib mengimplementasikan interface `SubtitleParser`. Emitter partikel baru mengimplementasikan interface `ParticleEmitter`.

## 4. Kebijakan Desain & Kode Tanpa Emoji (Strict No-Emoji Policy)
* Dilarang keras menggunakan emoji di manapun: antarmuka UI, status badge, pesan error, log, komentar kode, dokumen PRD, maupun commit message.
* Gunakan ikon SVG garis minimalis (Lucide Icons) atau teks deskriptif profesional.

## 5. Konvensi Commit (Conventional Commits)
Gunakan format standar:
* `feat(scope): deskripsi fitur baru`
* `fix(scope): perbaikan bug`
* `perf(scope): optimasi performa / zero-gc`
* `refactor(scope): perapian kode tanpa ubah fungsi`
* `docs(scope): update dokumentasi`
* `test(scope): penambahan unit test`

## 6. Keamanan & Dependensi
* Lisensi dependensi npm wajib permisif (MIT, Apache 2.0, BSD).
* Jalankan `npm audit` dan `cargo audit` secara berkala.

