# ADR-0005: Desain Shell 3-Zona dan Ekstraksi Warna Dinamis OKLCH Terinspirasi Gatefold

* **Status:** Diterima (Accepted)
* **Tanggal:** 2026-11-09

---

## Konteks & Masalah
Software editing video konvensional seringkali memiliki antarmuka yang membosankan, kaku, serba abu-abu gelap mati, atau terlalu padat seperti kokpit pesawat. Pengguna menginginkan antarmuka yang **modern, bersih, estetik, dan adaptif** layaknya pemutar musik audiophile modern **Gatefold** (`gatefold-foobar2000`).

---

## Keputusan
1. Mengadopsi struktur tata letak **Gatefold 3-Zone Shell**:
   - Header Toolbar tetap (46px).
   - Sidebar navigasi kiri collapsible (236px $\leftrightarrow$ 68px).
   - Bottom Transport Bar (92px) dengan tombol putar melingkar berpendar (*glowing circular button*).
2. Menerapkan sistem warna adaptif berbasis CSS variabel `@property` dengan ruang warna **OKLCH/OKLAB**.
3. Mengekstrak palet warna dari thumbnail video YouTube / cover album lokal untuk menerangi background (*ambient aurora glow*) secara otomatis.

---

## Konsekuensi & Dampak
* **Positif:**
  - Estetika kelas atas yang unik dan memanjakan mata kreator konten.
  - Perubahan warna palet berlangsung sangat halus tanpa sentakan visual (*flicker-free transitions*).
* **Tantangan:**
  - Membutuhkan browser engine yang mendukung CSS `@property` dan OKLCH (sudah didukung penuh oleh Chromium/WebView2 di Tauri v2).

