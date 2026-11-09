# Performance Engineering & Optimization: SubStellar

**Document Version:** 1.0.0  
**Status:** Approved Standard  
**Target Repository:** `https://github.com/SayMaven/sub-stellar`  
**Core Target:** 60 FPS Konstan, RAM Idle < 120MB, CPU < 15% pada Laptop Low-End (Intel HD Graphics, RAM 4GB)

---

## 1. Optimalisasi Waktu Mulai (Startup Time < 1.5 Detik)

Untuk mencapai cold startup sub-1.5 detik pada SSD (< 3.0 detik pada HDD):

### 1.1 Pencegahan White Flash & Window Readiness
* Konfigurasi jendela Tauri v2 dibuat `"visible": false` di awal pada `tauri.conf.json`.
* Jendela hanya dipanggil tampil (`appWindow.show()`) setelah event `DOMContentLoaded` selesai dan theme OKLCH pertama kali diaplikasikan. Ini menghilangkan kedipan layar putih (*white flash*) saat startup.

### 1.2 Code Splitting & Vendor Chunking (Vite)
* Bundle frontend dipecah secara modular pada `vite.config.ts`:
  ```typescript
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-pixi': ['pixi.js'],
          'vendor-ui': ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-slider'],
          'vendor-state': ['zustand']
        }
      }
    }
  }
  ```
* **Dynamic Import (Lazy Loading):** Komponen berat yang tidak dibutuhkan saat startup (seperti `YouTubeDrawer.tsx`, `ExportModal.tsx`, dan kamus Kuromoji) dimuat menggunakan `React.lazy()` hanya saat pengguna mengklik menu terkait.

---

## 2. Manajemen & Anggaran Memori (Strict Memory Budgets)

### 2.1 Alokasi Batas RAM (RAM Budget)
| Kondisi Operasional | Target Maksimal RAM | Tindakan Jika Melebihi Batas |
| :--- | :---: | :--- |
| **Startup / Idle** | **< 120 MB** | Tunda pemuatan modul sekunder. |
| **Playback + Waveform + 500 Partikel** | **< 250 MB** | Paksa *Object Pool recycling* partikel. |
| **Sesi Kerja Panjang (> 1 Jam)** | **< 300 MB** | Jalankan pembersihan tekstur Pixi yang tidak terpakai (*Texture GC*). |

### 2.2 Siklus Hidup Sumber Daya (Resource Disposal)
* Saat pengguna mengganti lagu atau video:
  1. Hentikan pemutaran audio dan putuskan `AudioNode` Web Audio.
  2. Bebaskan referensi `AudioBuffer` lama dari memori heap.
  3. Bersihkan tekstur canvas Pixi dengan `app.stage.destroy({ children: true, texture: true })`.
  4. Reset array partikel aktif di `particlePool`.

---

## 3. Optimalisasi Penggunaan CPU (Beban Simultan: Partikel + Waveform + Video)

Skenario paling berat adalah saat **Video diputar** + **Audio Waveform bergulir** + **Subtitle & Partikel di-render** secara bersamaan. Berikut strategi penanganannya:

```
+-------------------------------------------------------------------------------+
|                       TRIPLE-CONCURRENCY CPU MITIGATION                       |
|                                                                               |
| 1. Video Preview    ➔ Hardware Decoded via GPU (DXVA di WebView2)             |
| 2. Audio Waveform   ➔ Offscreen Bitmap Cached + CSS Transform (Zero Redraw)   |
| 3. PixiJS Particles ➔ Single Batch Draw Call (ParticleContainer + Object Pool)|
| 4. Time Sync        ➔ AudioContext.currentTime (Decoupled from React Render)  |
+-------------------------------------------------------------------------------+
```

### 3.1 Hardware Video Decoding (DXVA)
* Pemutaran video menggunakan elemen `<video>` native WebView2 yang secara otomatis memanfaatkan akselerasi hardware Direct3D Video Acceleration (DXVA). CPU tidak terbebani oleh decoding frame MP4/H.264.

### 3.2 Waveform Caching (Tanpa Redraw per Frame)
* **Kesalahan Fatal Software Lain:** Menggambar ulang (*clear and redraw*) ribuan garis gelombang audio di Canvas pada setiap frame tick ($60\times$ per detik). Ini memakan 40–60% CPU!
* **Solusi SubStellar:**
  - Waveform seluruh lagu digambar **sekali saja** di background ke sebuah *Offscreen Canvas / Bitmap*.
  - Selama pemutaran, timeline hanya menggeser kontainer (*translate viewport*) menggunakan `transform: translate3d(-x, 0, 0)` akselerasi GPU CSS.
  - **Dampak:** Beban CPU untuk waveform turun menjadi **hampir 0%**.

---

## 4. Performa Rendering 60 FPS Mantap (Rock-Solid 60 FPS)

### 4.1 Tri-Tier Quality Scaling
Sistem otomatis menyesuaikan parameter grafis berdasarkan `usePerfStore`:

| Parameter Grafis | Mode Low (Default iGPU) | Mode Balanced (Laptop Standar) | Mode Ultra (PC Gaming/Workstation) |
| :--- | :---: | :---: | :---: |
| **Batas Partikel Maksimal** | **200 partikel** | **600 partikel** | **2.500+ partikel** |
| **Resolusi Internal Preview**| **720p** (Upscaled CSS) | **1080p** | **1440p / 4K Asli** |
| **Efek Teks Glow** | Double stroke + Soft shadow | Single-pass Blur Filter | Multi-pass Bloom Filter |
| **Antialiasing Canvas** | Off (Cepat) | FXAA | WebGPU MSAA 4x |

### 4.2 Zero-GC Particle Object Pooling
* Diimplementasikan di `src/engine/pixi/ObjectPool.ts`.
* Alokasi array partikel statis (`Array<Particle>`) dibuat saat startup.
* Saat partikel baru dibutuhkan: ambil indeks partikel tidak aktif dari pool, set posisi, dan ubah status ke aktif.
* Saat umur partikel habis (`lifetime <= 0`): kembalikan ke pool tanpa `delete` atau `garbage collection`.

---

## 5. Lazy Loading & Manajemen Sumber Daya Khusus

### 5.1 On-Demand Kuromoji NLP Dictionary
* Kamus tokenisasi kanji (`.dat.gz` file berukuran ~25MB) **tidak dimuat saat aplikasi terbuka**.
* Kamus hanya diunduh/dibaca ke memori saat pengguna pertama kali membuka fitur "Generate Furigana".
* Jika aplikasi berada dalam status idle selama 10 menit tanpa aktivitas Furigana, memori kamus dibebaskan (*deallocated*).

### 5.2 Particle Sprite Atlas (Single Draw Call)
* Seluruh bentuk partikel (*sparkle, star, glow dot, flare*) digabung ke dalam satu gambar *Texture Atlas* berukuran kecil ($256\times256\text{ px}$).
* Memungkinkan `ParticleContainer` merender ribuan partikel campuran dalam **1 draw call tunggal**.

---

## 6. Penanganan File Media Berukuran Besar (Video/Audio Panjang > 10–60 Menit, > 1–4 GB)

### 6.1 Larangan Memuat File Utuh ke Memori RAM
* **Dilarang keras** membaca file video 4GB ke dalam `Uint8Array` JavaScript!
* Video diputar secara *streaming* langsung dari harddisk menggunakan protokol streaming lokal Tauri v2 (`asset://` protocol dengan HTTP Range Requests). Pemutar hanya memuat buffer beberapa detik ke depan (*chunk-based playback*), sehingga file 10 GB sekalipun hanya memakan RAM ~20 MB.

### 6.2 Fast Downsampled Waveform Extraction untuk File Panjang
* Untuk file audio/video berdurasi panjang (> 10 menit):
  - Alih-alih mendekompresi audio penuh di Web Audio API (yang bisa memakan 1.5 GB RAM PCM mentah), backend Rust memanggil FFmpeg sidecar dengan pipeline audio downsample cepat:
    ```bash
    ffmpeg -i input_large.mp4 -ac 1 -filter:a aresample=4000 -f s16le -
    ```
  - Output stream dibaca bertahap (*chunk streaming*) ke Web Worker untuk langsung diekstrak menjadi 2.000 titik puncak amplitudo.
  - Waktu ekstraksi untuk file 1 jam selesai dalam **< 3 detik** dengan penggunaan RAM $< 30\text{ MB}$.

---

## 7. Profiling & Pemantauan Benchmark

1. **Monitor Telemetri Bawaan (Debug Overlay):**
   - Panel kecil di pojok UI yang dapat diaktifkan (`Ctrl+Shift+D`): menampilkan FPS real-time, Frame Time (ms), RAM Process Heap, dan Jumlah Partikel Aktif.
2. **Benchmark Terotomasi (Vitest & Playwright):**
   - Benchmark throughput parsing: Parser LRC/YRC wajib mampu mem-parse 1.000 baris lirik dalam waktu $< 5\text{ ms}$.
   - Benchmark layout teks ruby: Perhitungan bounding box 100 karakter kanji dengan furigana selesai dalam waktu $< 2\text{ ms}$.

