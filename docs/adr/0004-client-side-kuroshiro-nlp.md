# ADR-0004: Engine NLP Furigana Client-Side Menggunakan Kuroshiro dan Kuromoji On-Demand

* **Status:** Diterima (Accepted)
* **Tanggal:** 2026-11-09

---

## Konteks & Masalah
Untuk mendukung fitur Furigana otomatis (Kanji $\rightarrow$ Hiragana), terdapat dua opsi:
1. Menggunakan Cloud API eksternal (misal: Goo Labs / Google Translate API).
2. Menjalankan engine NLP lokal di sisi pengguna.

Pendekatan Cloud API ditolak karena melanggar prinsip **100% Offline-First**, memerlukan koneksi internet, rentan terhadap pembatasan kuota (*rate limit*), dan memiliki latency jaringan.

---

## Keputusan
Menggunakan library **Kuroshiro** dengan tokenizer **Kuromoji.js** yang dijalankan secara lokal di client:
1. File kamus statis diletakkan di `public/dict/` untuk akses offline penuh.
2. Kamus dimuat ke memori secara **On-Demand**: hanya saat pengguna pertama kali menekan tombol "Auto Furigana".
3. Memori kamus (~25 MB) dapat dibebaskan jika aplikasi dalam keadaan idle selama 10 menit.

---

## Konsekuensi & Dampak
* **Positif:**
  - Bekerja 100% offline tanpa perlu server atau kuota API.
  - Privasi data pengguna terjamin penuh.
* **Tantangan:**
  - Beban inisialisasi awal saat kamus dimuat pertama kali (~400ms). Diatasi dengan menampilkan indikator loading halus di UI.

