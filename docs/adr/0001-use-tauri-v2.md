# ADR-0001: Pemilihan Tauri v2 Dibandingkan Electron

* **Status:** Diterima (Accepted)
* **Tanggal:** 2026-11-09
* **Pengambil Keputusan:** SayMaven & Engineering Team

---

## Konteks & Masalah
SubStellar adalah aplikasi desktop multimedia yang menggabungkan rendering kanvas grafis 60 FPS, pemrosesan audio, dan ekspor video FFmpeg. Salah satu persyaratan utama (NFR-01 & NFR-02) adalah aplikasi **wajib ramah terhadap komputer berspesifikasi rendah (*low-end hardware*)**, seperti laptop ber-RAM 4 GB dengan prosesor dual-core dan integrated GPU.

Electron membundel binary Chromium dan Node.js utuh (~150 MB ukuran installer) dan biasanya mengonsumsi 400–600 MB RAM saat pertama kali jendela dibuka, menyisakan ruang RAM yang sangat sempit di komputer 4 GB.

---

## Keputusan
Memilih **Tauri v2** dengan backend **Rust** dan frontend **Microsoft Edge WebView2** (di Windows) / **WebKit** (di macOS/Linux).

---

## Konsekuensi & Dampak
* **Positif:**
  - Konsumsi RAM saat startup turun drastis menjadi **~30–60 MB** (penghematan 80%+ dibanding Electron).
  - Ukuran file installer berkurang dari ~150 MB menjadi **~15–25 MB**.
  - Keamanan native yang jauh lebih kokoh melalui sistem *Capabilities & ACLs* bawaan Tauri v2.
  - Rust memberikan performa native tanpa garbage collector untuk streaming buffer frame ke proses FFmpeg.
* **Tantangan:**
  - Penulisan command native memerlukan pemahaman bahasa Rust (sudah diatasi dengan modul terisolasi di `src-tauri/src/commands/`).

