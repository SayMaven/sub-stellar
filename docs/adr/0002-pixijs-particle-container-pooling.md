# ADR-0002: Pemilihan PixiJS v8 ParticleContainer dengan Zero-GC Object Pooling

* **Status:** Diterima (Accepted)
* **Tanggal:** 2026-11-09

---

## Konteks & Masalah
Efek partikel bintang (*stardust/sparkles*) pada subtitle aktif memancarkan hingga ratusan partikel per detik. Jika menggunakan Canvas 2D biasa, FPS akan anjlok di bawah 20 FPS pada GPU terintegrasi. Jika menggunakan Three.js, overhead scene graph 3D terlalu berat. Selain itu, membuat objek partikel baru dengan `new Particle()` secara konstan akan memicu *Garbage Collection (GC) pauses* yang menyebabkan patah-patah (*micro-stuttering*).

---

## Keputusan
1. Menggunakan **PixiJS v8** sebagai engine grafis utama dengan preferensi WebGPU dan fallback otomatis ke WebGL.
2. Memanfaatkan **`ParticleContainer`** untuk merender seluruh partikel dalam **satu draw call tunggal** (*batch rendering*).
3. Mengimplementasikan **Static Object Pooling (`ObjectPool.ts`)**: semua objek partikel dialokasikan sekali saat startup dan didaur ulang saat masa hidupnya habis.

---

## Konsekuensi & Dampak
* **Positif:**
  - Menjamin stabilitas 60 FPS bahkan pada laptop dengan Intel HD Graphics 4400.
  - Zero-GC allocation selama animasi partikel berlangsung.
* **Tantangan:**
  - `ParticleContainer` membatasi fitur transformasi anak (hanya mendukung posisi, rotasi, skala, dan warna). Hal ini diterima karena efek partikel bintang 2D tidak memerlukan hierarki transformasi bersarang.

