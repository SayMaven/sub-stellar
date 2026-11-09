# Panduan Pengguna (User Manual): SubStellar

Selamat datang di SubStellar — Software Desktop Pembuat Subtitle Beranimasi & Efek Partikel.

---

## Daftar Isi
1. [Alur Kerja Cepat 1-Klik](#1-alur-kerja-cepat-1-klik)
2. [Bekerja dengan File Lokal](#2-bekerja-dengan-file-lokal)
3. [Panduan Furigana (Bacaan Kanji)](#3-panduan-furigana-bacaan-kanji)
4. [Mengatur Efek Partikel & Tipografi](#4-mengatur-efek-partikel--tipografi)
5. [Navigasi Timeline Waveform](#5-navigasi-timeline-waveform)
6. [Panduan Ekspor Video](#6-panduan-ekspor-video)
7. [Tanya Jawab & Troubleshooting (FAQ)](#7-tanya-jawab--troubleshooting-faq)

---

## 1. Alur Kerja Cepat 1-Klik (YouTube -> Subtitle)

Jika Anda ingin membuat video lirik dari lagu di YouTube:
1. Salin tautan (URL) video musik dari YouTube.
2. Di SubStellar, tekan tombol **`Ctrl + F`** atau klik ikon YouTube di sidebar kiri.
3. Tempel tautan pada kolom pencarian dan tekan **Enter**.
4. SubStellar akan:
   - Mengunduh audio/video resolusi tinggi.
   - Mengambil warna dominan cover video untuk mewarnai tema aplikasi.
   - Mencari lirik tersinkronisasi (*word-synced*) di 5 database online secara otomatis.
   - Men-generate Furigana jika lirik berbahasa Jepang.
   - Menerapkan efek kilau bintang (*stardust*).
5. Tekan tombol **`Space`** untuk memutar dan menikmati pratinjau langsung!

---

## 2. Bekerja dengan File Lokal (Video / Musik Pribadi)

1. Buka tab **Studio** di sidebar kiri.
2. Tarik dan lepas (*drag-and-drop*) file video (`.mp4`, `.mkv`, `.webm`) atau file audio (`.mp3`, `.flac`, `.wav`) langsung ke area kanvas tengah.
3. Untuk menambahkan lirik:
   - Jika Anda memiliki file `.lrc`, `.srt`, atau `.ass`, cukup tarik file tersebut ke atas kanvas.
   - Atau klik tombol **"Cari Lirik Online"** di toolbar atas untuk mencari berdasarkan judul lagu & nama artis.

---

## 3. Panduan Furigana (Bacaan Kanji)

SubStellar memiliki mesin morfologi bahasa Jepang bawaan untuk membaca kanji:

### A. Format Teks Markdown Ruby
SubStellar menggunakan format penulisan tag yang mudah dibaca:
`もう{何|なに}もいらない` $\rightarrow$ Kata dasar: **何**, Furigana di atas: **なに**.

### B. Mengoreksi Bacaan Kanji (Manual Override)
Jika ada kanji khusus (*ateji* atau nama orang) yang bacaannya tidak sesuai:
1. Klik kanan pada kata kanji di timeline atau di kanvas.
2. Pilih **"Edit Furigana"**.
3. Ketik bacaan Hiragana yang benar pada kotak teks yang muncul, lalu tekan **Enter**.
4. Bacaan di atas kanji akan langsung diperbarui secara instan.

---

## 4. Mengatur Efek Partikel & Tipografi

Pada panel **Inspector** di sebelah kanan:
* **Gaya Huruf (Font):** Pilih font utama (misal: *Dela Gothic One*) dan font Furigana terpisah (misal: *Noto Sans JP*). Anda juga bisa men-drag file font `.ttf` atau `.otf` Anda sendiri ke aplikasi!
* **Multi-Stroke:** Atur ketebalan garis tepi dalam (*inner stroke*) dan garis tepi luar (*outer stroke*) agar lirik kontras di atas video apapun.
* **Preset Partikel:**
  - **Stardust:** Taburan debu bintang melayang lembut di sekitar lirik.
  - **Sparkle Burst:** Letupan kilau bintang saat setiap kata baru dinyanyikan.
  - **Cosmic Glow:** Pendaran cahaya aura kosmik neon.
* **Jumlah Partikel & Kecepatan:** Geser slider *Emission Rate* dan *Speed* sesuai selera.

---

## 5. Navigasi Timeline Waveform

* **Memutar / Menjeda:** Tekan tombol **`Space`**.
* **Menggeser Waktu Baris Lirik:** Klik dan geser kotak baris lirik pada timeline ke kiri atau kanan.
* **Menyesuaikan Durasi Suku Kata:** Tarik ujung garis pemisah kata pada blok lirik.
* **Memotong Kata:** Arahkan garis merah kursor (*playhead*) ke titik vokal yang diinginkan, lalu tekan tombol **`C`** atau **`Ctrl + K`**.
* **Zoom Timeline:** Gunakan **`Ctrl + Scroll Mouse`** untuk memperbesar/memperkecil visual gelombang suara.

---

## 6. Panduan Ekspor Video

Tekan tombol **`Ctrl + E`** untuk membuka jendela ekspor:

| Pilihan Format | Kegunaan Terbaik |
| :--- | :--- |
| **Burn-in Video (MP4)** | Menghasilkan video final siap tonton atau langsung diunggah ke YouTube/TikTok dengan subtitle dan efek partikel menyatu di video. |
| **Transparent Video (WebM VP9 + Alpha)** | Sangat ideal untuk video editor! Menghasilkan video dengan **latar belakang transparan**. Anda cukup men-drag file `.webm` ini sebagai layer track di atas timeline **Adobe Premiere Pro**, **DaVinci Resolve**, atau **CapCut PC**. |
| **Apple ProRes 4444 (.mov)** | Format video transparan kelas industri tanpa kompresi visual (lossless quality). |
| **Subtitle Script (.ass / .lrc)** | Menyimpan file subtitle teks standar untuk pemutar media VLC/MPV. |

---

## 7. Tanya Jawab & Troubleshooting (FAQ)

### T: Laptop saya terasa hangat atau baterai cepat habis saat preview, apa yang harus dilakukan?
> **Jawab:** Tekan shortcut **`Ctrl + Q`** untuk mengganti mode performa ke **"Low Mode"**. Di mode ini, resolusi preview diturunkan ke 720p dan partikel dibatasi pada 200 butir hemat daya.

### T: Apakah SubStellar bisa dijalankan tanpa koneksi internet?
> **Jawab:** Ya, 100%! Seluruh fitur editing, pembacaan Furigana lokal, efek partikel, dan render video FFmpeg dapat berjalan tanpa internet sama sekali. Koneksi internet hanya dibutuhkan saat mengunduh dari YouTube atau mencari lirik online.

