# Low-End Hardware Optimization & Performance Guidelines

## Prinsip Kinerja
SubStellar wajib berjalan mulus (60 FPS) pada spesifikasi minimum:
* **CPU:** Intel Core i3 (Dual-core 2.0 GHz) / AMD sekelas.
* **GPU:** Integrated Intel HD 4400 / UHD 620.
* **RAM:** 4 GB.

## Aturan Optimasi Mandatori

### 1. Tri-Tier Quality Scaling (`usePerfStore`)
* **Low Mode (Default untuk GPU terintegrasi / RAM 4GB):**
  - Batas partikel aktif: 150–250 partikel.
  - Nonaktifkan filter blur berat / multi-pass bloom; gunakan double-stroke text dengan soft shadow.
  - Preview canvas internal di-render pada resolusi 720p (CSS scaled ke viewport).
* **Balanced Mode:**
  - 500–800 partikel aktif, standard bloom, 1080p preview.
* **Ultra Mode:**
  - 2.000+ partikel, multi-pass bloom, WebGPU antialiasing.

### 2. Zero-Garbage-Collection (Object Pooling)
* Dilarang instansiasi objek partikel baru terus-menerus (`new Particle()`) di dalam render ticker PixiJS.
* Wajib menggunakan **Static Object Pool** (`particlePool`) yang mendaur ulang partikel yang sudah mati/alpha 0.

### 3. On-Demand Kuromoji Dictionary
* Kamus morfologi Jepang (20–30 MB) **hanya dimuat ke memori saat pengguna melakukan aksi "Auto Furigana"**.
* Sediakan mekanisme unload/garbage collect saat tidak dipakai.

### 4. Target Batasan Memori (RAM Budget)
* **Idle:** < 120 MB RAM.
* **Active (Playback audio + 500 partikel):** < 250 MB RAM.

