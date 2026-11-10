# UI/UX Design Specification & User Experience Architecture: SubStellar

**Document Version:** 1.0.0  
**Status:** Approved Standard  
**Target Repository:** `https://github.com/SayMaven/sub-stellar`  
**Reference Design:** Gatefold Foobar2000 (`F:\CODE\forking\gatefold-foobar2000`)

---

## 1. Filosofi Desain: Modern, Bersih & Adaptif (Gatefold Aesthetic)

SubStellar mengusung estetika visual **Gatefold**:
* **Obsidian Dark Canvas:** Warna dasar gelap yang tenang (`#14161b`), bebas dari silau layar, cocok untuk sesi editing berjam-jam.
* **Permukaan Datar (Flat Surfaces):** Tanpa blob aurora, glow dekoratif, maupun `backdrop-filter` (hemat GPU low-end). Satu warna aksen hanya untuk aksi utama.
* **Kartu Rounded Datar:** Sudut `10px-16px` dengan permukaan solid/semi-transparan tanpa blur.
* **Micro-Interactions Fungsional:** Perubahan warna hover/active singkat dan focus ring yang jelas; tanpa efek glow.
* **Kebijakan Tanpa Emoji (Strict No-Emoji Standard):** Seluruh antarmuka, dialog, status badge, dan notifikasi dilarang menggunakan karakter emoji. Representasi visual murni menggunakan ikon SVG garis monokrom halus (*Lucide Icons*) dan tipografi presisi.

---

## 2. Tata Letak Responsif & Adaptif (3-Zone Shell)

```
+-----------------------------------------------------------------------------------------+
| HEADER (40px) - Brand, Track Title, Quick Search [Ctrl+K], Quality Pill, Telemetry      |
+------+------------------------------------------------------------+---------------------+
| RAIL | STAGE TOOLBAR: Aspect 16:9 / 9:16 / 1:1 / 4:3 - Zoom - Reset | SUBTITLE INSPECTOR |
| 56px +------------------------------------------------------------+ (320px, always     |
| icon |                                                            | mounted; empty     |
| only |              PIXI.JS V8 VIEWPORT (fit + zoom + scroll)     | state when no line)|
|      +------------------------------------------------------------+---------------------+
|      | ===== resize handle (drag / Arrow Up / Arrow Down) =====                         |
|      | TRANSPORT (48px): Prev, Play, Next, Loop, 00:00.00 [scrubber] 03:05.00, Volume   |
|      | TIMELINE (resizable, default 200px): waveform peaks, subtitle blocks, playhead   |
+------+----------------------------------------------------------------------------------+
```

### 2.1 Fleksibilitas Layout
* **Sidebar Collapsible:** Lebar sidebar dapat diciutkan dari `236px` (teks + ikon) menjadi `68px` (ikon saja) untuk memberikan ruang kerja maksimal bagi viewport video.
* **Aspect Ratio Switcher:** Viewport preview dapat diganti instan antara:
  - **16:9 (Landscape):** Standar YouTube / PC.
  - **9:16 (Vertical):** Format video pendek TikTok, YouTube Shorts, dan Instagram Reels.
  - **1:1 (Square) & 4:3 (Retro):** Format cover musik dan aesthetic video.
* **Timeline Drawer Resizable:** Ketinggian timeline audio dapat digeser naik/turun sesuai kebutuhan fokus pengguna.

---

## 3. Aksesibilitas (Accessibility - a11y)

1. **Kontras Warna Standar WCAG 2.1 AA:**
   - Seluruh teks UI (`--text` dan `--text-2`) dihitung secara otomatis untuk menjamin rasio kontras minimal **$> 4.5:1** terhadap background kartu, bahkan saat tema warna dinamis berubah mengikuti gambar cover.
2. **Keyboard Navigation Penuh:**
   - Seluruh elemen tombol, slider, dan dropdown dapat dijelajahi menggunakan tombol `Tab` dan tombol panah.
   - Indikator fokus yang jelas dan tegas: `outline: 2px solid var(--accent); outline-offset: 2px;`.
3. **Screen Reader & ARIA Labels:**
   - Elemen interaktif dilengkapi atribut ARIA yang deskriptif (`aria-label="Putar audio"`, `aria-valuenow="45"`, `role="slider"`).

---

## 4. Onboarding & Desain State Kosong (Empty States)

SubStellar memandu pengguna secara natural tanpa tutorial yang mengganggu:

### 4.1 Empty Studio View (Saat Baru Dibuka)
* Tampilan tengah tidak menampilkan layar hitam kosong, melainkan zona interaktif ramah pemula:
  - Kotak *drag-and-drop* bergaris putus-putus dengan pendaran neon halus: *"Tarik & lepas file Video / Audio ke sini"*.
  - Input cepat di tengah: *"Atau tempel link YouTube untuk mulai dalam 1-klik"*.
  - Tombol sample demo: *"Coba Lagu Demo (J-Pop Furigana Showcase)"* untuk langsung melihat kehebatan efek partikel tanpa perlu mencari file sendiri.

### 4.2 Empty Lyrics State
* Jika lagu lokal belum memiliki lirik: Tampilkan pesan bersahabat dengan tombol aksi langsung:
  - *"Lirik belum tersedia. [Cari Otomatis di 5 Database] atau [Tempel Teks Manual]"*.

---

## 5. Penanganan Error yang Ramah Pengguna (Human-Centric Error Handling)

* **Prinsip:** Dilarang menampilkan pesan error teknis mentah (seperti *“FFmpeg pipe exited with code 1”* atau *“Uncaught TypeError”*).
* **Format Notifikasi:**
  - **Pesan Jelas:** Menjelaskan apa yang terjadi dalam bahasa manusia.
  - **Solusi Tindakan:** Memberikan tombol pemulihan langsung (*actionable recovery*).
  - *Contoh Kasus:* Jika encoder GPU sibuk saat ekspor video:
    > **Notifikasi:** *"Encoder GPU sedang sibuk. SubStellar otomatis beralih ke rendering CPU agar ekspor tetap selesai."* $\rightarrow$ `[Lanjutkan]` `[Buka Log]`.

---

## 6. Sistem Undo / Redo yang Kuat (Command History Stack)

Untuk menjamin rasa aman pengguna saat mengedit timing lirik yang rumit:

* **Pola Desain:** **Command Pattern + Immutable State (Zustand + Immer)**.
* **Kapasitas Riwayat:** Menyimpan hingga **50 aksi terakhir**.
* **Aksi yang Dicatat:**
  - Menggeser posisi/durasi baris lirik pada timeline.
  - Memotong/menggabungkan kata (*split/merge syllable*).
  - Mengubah bacaan Furigana kanji.
  - Mengubah warna, stroke, atau preset partikel.
* **Shortcut:** `Ctrl + Z` (Undo) dan `Ctrl + Y` / `Ctrl + Shift + Z` (Redo).

---

## 7. Shortcut Keyboard Lengkap (Standar NLE Video Editing)

| Shortcut | Aksi | Konteks |
| :--- | :--- | :--- |
| **`Space`** | Play / Pause Playback | Global |
| **`Left Arrow` / `Right Arrow`** | Mundur / Maju 1 frame (sub-detik) | Timeline / Player |
| **`Shift + Left / Right`** | Mundur / Maju 1 detik | Timeline / Player |
| **`Up Arrow` / `Down Arrow`** | Lompat ke Baris Lirik Sebelumnya / Berikutnya | Studio |
| **`C`** atau **`Ctrl + K`** | Potong kata / suku kata pada posisi kursor playhead | Timeline |
| **`L`** | Aktifkan / Nonaktifkan Loop Pemutaran pada baris aktif | Player |
| **`Ctrl + F`** | Buka Quick Search / Drawer YouTube & Lirik | Global |
| **`Ctrl + S`** | Simpan Proyek SubStellar (`.substellar`) | Global |
| **`Ctrl + E`** | Buka Dialog Ekspor Video | Global |
| **`Ctrl + Z`** | Undo (Batalkan perubahan terakhir) | Global |
| **`Ctrl + Shift + Z` / `Ctrl + Y`** | Redo (Ulangi perubahan) | Global |
| **`Ctrl + Scroll Wheel`** | Zoom In / Zoom Out Timeline Waveform | Timeline |
| **`Ctrl + Q`** | Ganti Mode Performa Cepat (Low $\leftrightarrow$ Balanced $\leftrightarrow$ Ultra)| Header |
| **`Ctrl + Shift + D`** | Buka Panel Telemetri Debug (FPS, RAM, Draw Calls) | Global |

---

## 8. Lokalisasi Global (Multilingual & i18n Architecture)

SubStellar dirancang untuk kreator di seluruh penjuru dunia. Arsitektur lokalisasi menggunakan kamus JSON berbasis namespace:

### 8.1 Bahasa yang Didukung Sejak Hari Pertama:
1. **Bahasa Indonesia (`id-ID`):** Terjemahan lokal yang alami, lugas, dan bersahabat.
2. **English (`en-US`):** Standar internasional industri software video.
3. **Japanese (`ja-JP` / 日本語):** Pasar inti untuk kreator J-Pop, Vocaloid, Anime, dan VTuber.
4. **Simplified Chinese (`zh-CN` / 简体中文) & Traditional Chinese (`zh-TW` / 繁體中文).**
5. **Korean (`ko-KR` / 한국어):** Pasar musik K-Pop.
6. **Arabic (`ar-SA` / العربية):** Dilengkapi penyesuaian tata letak otomatis ke **RTL (Right-to-Left)** (`dir="rtl"`).
7. **Spanish (`es-ES` / Español) & Russian (`ru-RU` / Русский).**

### 8.2 Logika Pemilihan Bahasa
* **Deteksi Otomatis:** Saat pertama kali dijalankan, aplikasi mendeteksi bahasa sistem operasi (`navigator.language`).
* **Manual Override:** Pengguna dapat mengganti bahasa kapan saja di menu `Settings > Language` tanpa perlu merestart aplikasi.

