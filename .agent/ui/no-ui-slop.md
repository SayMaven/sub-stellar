# No-UI-Slop & UI-States Studio Directives

Dokumen ini mengatur standar baku antarmuka **SubStellar** agar bebas dari tampilan "generic AI slop" dan mematuhi prinsip desain software multimedia profesional (NLE / DAW / Subtitle Studio seperti DaVinci Resolve, Aegisub, dan Gatefold).

---

## 1. Prinsip No-UI-Slop (Anti-Slop Standard)

### A. Larangan Keras (What to Avoid)
1. **Dilarang Gradients & Glow Dekoratif Berlebihan:** Hindari gradien ungu-biru mengambang atau efek neon acak yang tidak memiliki fungsi interaktif.
2. **Dilarang Grid Kartu Kembar Generik:** Jangan membuat 3 kartu seragam dengan ikon-judul-satu kalimat filler (pola umum AI default).
3. **Dilarang Teks Hampa (Filler Copy):** Dilarang menggunakan teks promosi, "Get Started", "Submit", atau "Lorem ipsum". Gunakan terminologi teknis audio/video presisi (Timecode, Milliseconds, Syllable, Ruby Tag, Grapheme, Aspect Ratio, Frame Rate, Title Safe).
4. **Kebijakan Tanpa Emoji (Strict Zero-Emoji Policy):** Antarmuka wajib 100% menggunakan ikon SVG garis minimalis (Lucide Icons) dan tipografi terstruktur.

### B. Pola Antarmuka Studio Profesional
1. **Workspace Terpadu (High-Density & Functional):**
   - **Kiri:** Viewport stage dengan canvas framing aspek rasio dinamis (16:9, 9:16, 1:1, 4:3), safe margins broadcast overlay (93% Action Safe, 90% Title Safe), dan kontrol zoom.
   - **Kanan:** Subtitle & Style Inspector (`320px`) untuk mengedit parameter baris lirik aktif, timecode in/out, sintaks `{Kanji|Ruby}`, ketebalan multi-layer stroke, dan skala furigana.
   - **Bawah:** Multi-track timeline (peak waveform audio, baris subtitle interaktif, dan penanda suku kata).
2. **Hirarki Visual Jelas:** Aksi utama (Play/Pause, Apply Preset, Render) memiliki penegasan visual tegas; aksi sekunder (nudge +/-0.1s, aspect switch, zoom) tampil lebih tenang.

---

## 2. Matriks 10 UI States Mandatori (`ui-states`)

Setiap modul atau komponen yang menampilkan data di SubStellar wajib menangani state-state berikut:

| State | Kondisi | Implementasi di SubStellar |
| :--- | :--- | :--- |
| **First Use / Empty** | Belum ada media atau lirik yang dimuat | Tampilkan `EmptyStudioState`: Dropzone berkas bergaris putus-putus (`.mp4`, `.webm`, `.mp3`, `.wav`, `.lrc`), tombol 1-klik *"Load J-Pop Showcase"*, dan opsi unduh YouTube/Lirik. |
| **Loading / Skeleton** | Sedang membaca media atau mendownsample audio | Placeholder skeleton bergelombang tenang; tombol dinonaktifkan dengan animasi putar halus tanpa memblokir seluruh aplikasi. |
| **Busy Action** | Sedang mengunduh YouTube atau merender video | Tampilkan progress langkah demi langkah (*"Probing stream metadata..."* $\rightarrow$ *"Extracting audio..."*), disable tombol submit agar tidak dikirim ganda. |
| **Error & Recovery** | Jaringan gagal, file corrupt, atau encoder sibuk | Tampilkan banner error non-intrusif dengan penjelasan ramah manusia dan tombol recovery langsung (*"Restore Sample"*, *"Retry"*, *"Dismiss"*). Dilarang menampilkan raw stack trace. |
| **Validation** | Format URL salah atau durasi timecode negatif | Validasi saat submit/leave field; beri highlight garis batas merah dan pesan solusi tepat di bawah input (contoh: *"URL must be a valid YouTube address"*). |
| **Offline Mode** | Tidak ada koneksi internet | Fitur pencarian YouTube/Lirik otomatis memberi alternatif tombol *"Open Local File"* atau *"Paste Lyrics Manually"*. |
| **Edge Content: Long Text** | Judul lagu atau artis sangat panjang | Potong dengan elipsis (`truncate`) dan sediakan tooltip nilai penuh; teks subtitle panjang di-wrap mematuhi Kinsoku Shori agar tidak terpotong tepi layar. |
| **Edge Content: Many Items** | Ratusan baris subtitle dalam 1 lagu | Timeline dan daftar baris mendukung scroll horizontal/vertikal lancar tanpa jank. |
| **Success State** | Aksi pengguna berhasil diterapkan | Umpan balik visual singkat di tempat (badge hijau, pergantian baris aktif, notifikasi toast). |
| **Partial State** | Audio termuat tetapi lirik belum ada | Timeline menampilkan audio waveform, sementara lane subtitle mengarahkan pengguna ke tombol *"Search Lyrics"*. |

