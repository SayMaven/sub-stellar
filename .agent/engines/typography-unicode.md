# Subtitle Typography, Unicode & Custom Font Guidelines

Mengatur standar internasional penanganan teks, bahasa global, dan font kustom pada **SubStellar**.

---

## Ringkasan Standar Internasional Tipografi SubStellar

| Aspek | Spesifikasi Standar SubStellar |
| :--- | :--- |
| **Encoding** | 100% Full UTF-8 Native |
| **Segmentation** | `Intl.Segmenter` (Grapheme & Word boundaries) — mencegah terbelahnya emoji & aksen |
| **Arah Baca (Direction)** | LTR, RTL, dan BiDi (Unicode Bidirectional Algorithm UAX #9 untuk teks campuran) |
| **Complex Scripts** | Ligatur Arab utuh (tidak terputus saat karaoke), Vokal tumpuk Thai & Devanagari presisi |
| **CJK Line Wrap** | Mematuhi aturan *Kinsoku Shori* (larangan tanda baca di awal/akhir baris) |
| **Font Fallback** | Multi-tier CJK + Middle-East + South-East Asia + Emoji |
| **Custom Fonts** | Drag & Drop (`.ttf`, `.otf`, `.woff`, `.woff2`) + System Font Discovery + Google Fonts |
| **WYSIWYG Fidelity** | Render langsung dari PixiJS Canvas ke FFmpeg Pipe tanpa font mismatch |

---

## 1. Standar Unicode & Bahasa Global (Anti-Pecah)

### A. Grapheme Cluster Segmentation (`Intl.Segmenter`)
* **Dilarang keras** menggunakan `str.split('')` atau manipulasi string berbasis `str.length` untuk pemotongan kata/karakter subtitle.
* **Wajib** menggunakan API native `Intl.Segmenter`:
  ```typescript
  const segmenter = new Intl.Segmenter(lang || undefined, { granularity: 'grapheme' });
  export const getGraphemes = (text: string): string[] =>
    [...segmenter.segment(text)].map(s => s.segment);
  ```
  Ini mencegah terbelahnya emoji gabungan (ZWJ / modifier) dan karakter aksen (*combining marks*).

### B. Complex Text Shaping & Ligatures
* **Aksara Arab & Ibrani (Cursive RTL):**
  - Huruf Arab wajib mempertahankan bentuk sambung (*Initial, Medial, Final, Isolated*).
  - Pada efek karaoke highlight per-kata/suku-kata, sambungan kaligrafi kursif tidak boleh terputus.
* **Aksara Thai & Devanagari (Hindi):**
  - Tanda vokal (*matras*) dan tanda nada (*tonemarks*) harus menempel secara presisi di atas atau di bawah konsonan dasar (*vertical stacking*).
  - Rendering engine PixiJS mengandalkan Canvas 2D / HarfBuzz shaping context agar glyph tidak melayang atau menjadi *tofu* (`□`).

### C. Unicode Bidirectional Algorithm (BiDi - UAX #9)
* Mendukung teks campuran (misal: kalimat bahasa Arab yang menyisipkan kata bahasa Inggris, merek, atau angka).
* Arah aliran pembacaan dan kursor karaoke menyesuaikan secara otomatis (RTL untuk Arab/Ibrani, LTR untuk sisipan Latin).

### D. Aturan Pemenggalan Baris CJK (*Kinsoku Shori* / 禁則処理)
* Bahasa Jepang dan Mandarin tidak mengenal spasi antar kata.
* Aturan *word-wrap*:
  - **Dilarang di awal baris:** Tanda baca `。`, `、`, `！`, `？`, `）`, `」`, `』`.
  - **Dilarang di akhir baris:** Tanda kurung buka `（`, `「`, `『`.

---

## 2. Rantai Font Fallback Sistematis

Untuk menjamin tidak ada karakter yang hilang di seluruh bahasa di dunia:
```css
--font-subtitle-fallback: 
  /* Primary Latin / Cyrillic */
  'Inter Var', 'Segoe UI Variable Text', 'Segoe UI',
  /* Japanese (Kanji & Kana) */
  'Noto Sans JP', 'Yu Gothic UI', 'Meiryo',
  /* Simplified Chinese */
  'Noto Sans SC', 'Microsoft YaHei UI',
  /* Traditional Chinese */
  'Noto Sans TC', 'Microsoft JhengHei UI',
  /* Korean (Hangul) */
  'Noto Sans KR', 'Malgun Gothic',
  /* Arabic & Persian */
  'Noto Sans Arabic', 'Segoe UI Historic',
  /* Hebrew */
  'Noto Sans Hebrew',
  /* Thai */
  'Noto Sans Thai', 'Leelawadee UI',
  /* Devanagari (Hindi, Marathi, Sanskrit) */
  'Noto Sans Devanagari', 'Nirmala UI',
  /* Emoji Fallback */
  'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
```

---

## 3. Sistem Kustom Font (Custom Fonts)

### A. Tiga Jalur Akses Font:
1. **Drag & Drop / Import File Font:**
   - Format didukung: `.ttf`, `.otf`, `.woff`, `.woff2`.
   - Dimuat secara dinamis via native Web `FontFace` API dan didaftarkan ke `document.fonts`.
2. **System Installed Fonts:**
   - Backend Rust membaca font yang terinstall di OS pengguna (`C:\Windows\Fonts` / registry) dan menyediakannya di dropdown menu font picker.
3. **Google Fonts Catalog (1-Klik):**
   - Kurasi font lirik populer (misal: *Zen Maru Gothic, Dela Gothic One, Orbitron, Caveat*) yang dapat diunduh langsung dari aplikasi.

### B. Konfigurasi Font Independen:
* **Base Text Font:** Font untuk lirik kanji/kata utama.
* **Furigana Ruby Font:** Font terpisah untuk teks bacaan kecil di atas kanji (disarankan font sans-serif bulat agar tetap tajam dan mudah dibaca pada ukuran kecil).

### C. Jaminan WYSIWYG pada Ekspor Video:
* Karena video dirender langsung dari kanvas PixiJS frame-by-frame ke FFmpeg pipe, **kustom font dijamin 100% identik** antara tampilan preview di aplikasi dan hasil video MP4/WebM final (tidak akan pernah terjadi *fallback font mismatch* seperti pada subtitle biasa).

### D. Project Portability (Font Bundling):
* File `.substellar` menyimpan atau mereferensikan file font kustom sehingga proyek tetap utuh saat dibuka di komputer lain.

