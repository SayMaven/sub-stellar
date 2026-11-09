# Lyrics & YouTube Workflow Guidelines

Mengacu pada implementasi `theme/js/lyrics-sources.js` dan `theme/js/yt-search.js` Gatefold.

## 1. Multi-Source Lyrics Providers
* **LRCLIB (`lrclib.net`):** Database terbuka tanpa API key. Mengambil lirik tersinkronisasi baris dan kata.
* **NetEase Cloud Music:** Database utama untuk J-Pop, Anime, Vocaloid, dan K-Pop. Mendukung format `.yrc` (word-synced timing).
* **QQ Music & Kugou:** Sumber alternatif untuk katalog Asia dan internasional.
* **Scoring & Matching:** Gunakan fungsi `similarity(cleanTitle(a), cleanTitle(b))` dan toleransi durasi lagu $\le 4\text{ detik}$ untuk mengurutkan kandidat terbaik.

## 2. YouTube Ingestion via yt-dlp & Innertube
* **Search:** Lakukan pencarian langsung ke endpoint web Innertube tanpa membutuhkan Google API Key.
* **Download:** Panggil binary `yt-dlp` via Tauri sidecar command untuk mengunduh video MP4 atau audio saja.
* **Metadata & Thumbnail:** Ekstrak thumbnail resolusi tinggi (`hqdefault.jpg`) dan kirim ke `useThemeStore` untuk adaptasi warna background.

