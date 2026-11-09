# Lyrics & YouTube Workflow Guidelines

Mengacu pada implementasi `src/services/lyrics/` dan `src-tauri/src/commands/` pada SubStellar.

## 1. Multi-Source Lyrics Providers (`src/services/lyrics/`)
* **LRCLIB (`lrclib.net`):** Database lirik terbuka tanpa API key (`lrclib.ts`). Mendukung lirik standar dan word-synced enhanced LRC.
* **NetEase Cloud Music:** Database utama untuk J-Pop, Anime, Vocaloid, dan K-Pop (`netease.ts`). Mengambil lirik terjemahan (`tlyric`), romaji/furigana (`klyric`), serta format `.yrc` (word-level timing).
* **Proxy Anti-CORS Native:** Permintaan API diproteksi melalui native Tauri IPC bridge `lyrics_http_get` (`src-tauri/src/commands/lyrics_proxy.rs`) dengan domain allowlist ketat (`lrclib.net`, `music.163.com`, `qq.com`, `kugou.com`).
* **Scoring & Fuzzy Ranking (`similarity.ts`):**
  - Pembersihan judul (`cleanTitle`): Menghapus noise seperti `[Official MV]`, `(feat. ...)`, `[Cover]`, dll.
  - Perhitungan bigram Dice coefficient pada teks judul dan artis.
  - Toleransi durasi lagu: Selisih $\le 4\text{ detik}$ memberikan bonus kecocokan tinggi (hingga +15%).
* **Subtitle Parser (`lrcParser.ts`):** Mengubah lirik standar LRC, Enhanced LRC, maupun NetEase YRC menjadi struktur terpadu `SubtitleLine[]` dengan array `RubyToken[]` yang langsung kompatibel dengan `useStudioStore`.

## 2. YouTube Ingestion via yt-dlp & oEmbed (`src-tauri/src/commands/ytdl.rs`)
* **Probing Metadata Resilien:**
  - Validasi regex ketat: `^https?://(www\.)?(youtube\.com/(watch\?v=|shorts/)|youtu\.be/)[a-zA-Z0-9_-]{11}`.
  - Jika binary `yt-dlp` terdeteksi di sistem: Eksekusi `yt-dlp --dump-json` dengan vector arguments aman (bebas command injection).
  - Jika binary `yt-dlp` tidak terpasang: Otomatis beralih ke YouTube official oEmbed endpoint via `reqwest` untuk resolusi instan metadata judul, channel, dan thumbnail.
* **Thumbnail Palette Adaptation:**
  - Thumbnail resolusi tinggi (`hqdefault.jpg`) diekstraksi ke `useThemeStore.extractFromCover()` untuk secara otomatis merekayasa palet variabel dinamis CSS Gatefold OKLCH (`--accent`, `--glow`, `--blob-1`, `--blob-2`, `--blob-3`).


