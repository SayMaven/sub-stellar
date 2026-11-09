# ADR-0003: Pipeline Ekspor Video via Direct Memory Stdin Pipe ke FFmpeg

* **Status:** Diterima (Accepted)
* **Tanggal:** 2026-11-09

---

## Konteks & Masalah
Merender video berdurasi 3 menit pada 60 FPS berarti memproduksi $3 \times 60 \times 60 = 10.800$ frame gambar.
Jika setiap frame disimpan sebagai file gambar sementara (`.png`) di harddisk sebelum digabung oleh FFmpeg:
1. Membutuhkan ruang disk sementara sebesar $10.800 \times 4\text{ MB} \approx 43\text{ GB}$.
2. Menyebabkan keausan (*wear-and-tear*) pada SSD pengguna.
3. Menjadi sangat lambat akibat bottleneck Disk I/O.

---

## Keputusan
Menggunakan **Direct Memory Stdin Pipe**:
1. Frame di-render oleh PixiJS pada kanvas offscreen.
2. Data byte RGBA mentah (`Uint8Array`) dikirimkan langsung ke proses backend Rust via Tauri IPC.
3. Backend Rust menulis byte stream langsung ke `stdin` proses FFmpeg (`ffmpeg -f rawvideo -pix_fmt rgba -s 1920x1080 -r 60 -i - ...`).

---

## Konsekuensi & Dampak
* **Positif:**
  - **Zero Temporary Disk I/O:** Tidak ada satu pun file gambar sementara yang ditulis ke harddisk.
  - Kecepatan render meningkat $3\times–5\times$ lebih cepat karena data dialirkan langsung di dalam memori RAM.
  - Aman dari risiko disk penuh (*disk out-of-space*).

