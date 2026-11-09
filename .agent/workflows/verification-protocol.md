# Verification Protocol & Quality Gates

Setiap perubahan kode atau penambahan fitur di SubStellar wajib mematuhi protokol verifikasi berikut sebelum task dinyatakan selesai:

## 1. Automated Build & Typechecks
* [ ] TypeScript check lolos tanpa error: `npm run typecheck` atau `npx tsc --noEmit`.
* [ ] Unit & Integration tests lolos dengan cakupan $\ge 70\%-80\%$ core modules: `npm run test:coverage`.
* [ ] Vite build frontend lolos: `npm run build`.
* [ ] Rust backend lolos kompilasi & clippy: `cargo check` dan `cargo clippy -- -D warnings` di `src-tauri`.
* [ ] Rust unit tests lolos: `cargo test` di `src-tauri`.

## 2. Low-End Hardware & Memory Gate
* [ ] Konsumsi memori idle $< 120\text{ MB RAM}$.
* [ ] Konsumsi memori aktif (playback + 500 partikel) $< 250\text{ MB RAM}$.
* [ ] Memory leak test lolos: $\Delta\text{Retained Heap} \le 5\text{ MB}$ setelah 3 menit playback (Zero-GC object pool aktif).
* [ ] Frame rate stabil pada $\ge 58\text{ FPS}$ pada mode *Low*.

## 3. Visual & Functional Gates
* [ ] Furigana ter-render presisi di atas kanji tanpa overlapping pada berbagai resolusi viewport.
* [ ] Pencarian lirik & YouTube menangani skenario offline / timeout dengan aman (no uncaught error / crash).
* [ ] Ekspor video FFmpeg berhasil menghasilkan output video MP4 / WebM transparan yang valid.

