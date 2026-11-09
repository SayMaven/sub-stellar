# Legal, Compliance, Privacy Policy & Business Strategy: SubStellar

**Document Version:** 1.0.0  
**Status:** Approved Standard  
**Target Repository:** `https://github.com/SayMaven/sub-stellar`

---

## 1. Lisensi Perangkat Lunak (Software Licensing)

SubStellar dirilis di bawah **Lisensi MIT** (*The MIT License*):
* **Sifat Lisensi:** Permisif, ramah komunitas pengembang, mengizinkan penggunaan komersial maupun personal, modifikasi, dan redistribusi tanpa kewajiban *copyleft*.
* **Penafian Garansi (*Disclaimer of Warranty*):** Perangkat lunak disediakan *"sebagaimana adanya"* (*AS IS*) tanpa jaminan dalam bentuk apa pun. Pengembang tidak bertanggung jawab atas segala bentuk klaim atau kerugian yang timbul dari penggunaan software ini.

---

## 2. Kepatuhan Lisensi Pihak Ketiga (Third-Party License Compliance)

SubStellar mematuhi secara ketat seluruh kewajiban lisensi pihak ketiga:

### 2.1 Pustaka Kode Terintegrasi (In-App Libraries)
* Seluruh dependensi langsung (React, Tauri, PixiJS, Zustand, Tailwind, Kuroshiro) menggunakan lisensi permisif: **MIT, Apache 2.0, atau ISC**.
* Rincian atribusi dan hak cipta dicantumkan secara transparan di file root [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

### 2.2 Kepatuhan Khusus FFmpeg (LGPL / GPL Sidecar Compliance)
* **Status Isolasi:** Binary `ffmpeg.exe` **tidak di-link secara statis** ke dalam kode program SubStellar.
* FFmpeg dibundel sebagai proses eksternal independen (*standalone sidecar binary*) yang dipanggil melalui IPC child-process pipe standar sistem operasi.
* Hal ini memastikan SubStellar mematuhi klausul LGPL/GPL tanpa memaksa kode inti SubStellar berubah menjadi lisensi GPL viral (*GPL viral contamination prevention*). Pengguna bebas mengganti biner FFmpeg yang dibundel dengan biner kustom mereka sendiri kapan saja.

---

## 3. Kebijakan Privasi (Privacy Policy)

SubStellar dibangun dengan filosofi **Privasi Penuh Sejak Hari Pertama (Privacy by Design)**:

1. **Pemrosesan Data 100% Lokal:**
   - Seluruh pemrosesan file video, audio, teks lirik, tokenisasi kanji, dan rendering partikel dilakukan secara lokal di komputer pengguna.
   - Tidak ada data media pengguna yang diunggah ke server cloud milik pengembang SubStellar.
2. **Nol Pelacakan Identitas (Zero Personal Data Tracking):**
   - Aplikasi tidak mengumpulkan nama pengguna, email, alamat IP, judul lagu, lirik, atau riwayat tontonan YouTube.
3. **Telemetri Bersifat Sukarela (Strictly Opt-In):**
   - Telemetri dimatikan secara default (*Default: OFF*).
   - Jika pengguna memilih mengaktifkannya di menu Settings, data yang dikirim **hanya metrik diagnostik anonim**: versi OS (misal: Windows 11), vendor GPU (misal: Intel UHD 620), dan mode grafis aktif (Low/Balanced/Ultra) untuk membantu evaluasi kinerja di hardware low-end.
4. **Hak Penghapusan Data (Right to Erasure):**
   - Pengguna dapat menghapus seluruh cache thumbnail dan data sementara kapan saja melalui tombol **"Clear All Cache"** di menu Settings.

---

## 4. Ketentuan Penggunaan & Penggunaan Wajar (Terms of Service & Fair Use)

1. **Tanggung Jawab Pengguna:**
   - Fitur pengunduh YouTube dan pencari lirik disediakan semata-mata sebagai utilitas untuk kenyamanan alur kerja pribadi (*personal fair-use study & karaoke subtitle creation*).
   - Pengguna bertanggung jawab penuh untuk mematuhi hukum hak cipta yang berlaku di yurisdiksi masing-masing serta Ketentuan Layanan pihak ketiga (seperti YouTube Terms of Service).
2. **Larangan Pembajakan Massal:**
   - SubStellar bukan alat untuk pembajakan konten berhak cipta secara massal (*bulk pirating*). Aplikasi tidak menyediakan fungsi penyimpanan massal komersial.

---

## 5. Hak Kekayaan Intelektual (Intellectual Property)

1. **Merek Dagang & Kode Asli:**
   - Nama "SubStellar", logo, desain antarmuka, shader partikel orisinal, dan kode sumber dilindungi hak cipta © 2026 SayMaven & Kontributor SubStellar.
2. **Hak Milik Konten Pengguna (User-Generated Content):**
   - **100% Hak Milik Pengguna:** Seluruh file proyek subtitle (`.substellar`), video hasil ekspor (MP4/WebM), dan konfigurasi partikel yang dibuat oleh pengguna adalah sepenuhnya milik pengguna. Pengembang SubStellar tidak mengklaim hak kepemilikan apa pun atas karya yang dihasilkan.

---

## 6. Model Bisnis & Keberlanjutan Proyek (Monetization Strategy)

Untuk menjamin keberlanjutan pengembangan SubStellar dalam jangka panjang tanpa merugikan pengguna gratis:

```
+─────────────────────────────────────────────────────────────────────────────+
|               CORE DESKTOP STUDIO — GRATIS SELAMANYA (FOSS)                 |
|   100% Fitur Inti (YouTube, Furigana, Partikel, Export FFmpeg) Bebas Biaya  |
+─────────────────────────────────────────────────────────────────────────────+
                                       │
                      (Jalur Monetisasi Etis Opsional)
                                       ▼
+───────────────────────+   +────────────────────────+   +────────────────────+
| DUKUNGAN KOMUNITAS    |   | CREATOR MARKETPLACE    |   | CLOUD AI WHISPER   |
| GitHub Sponsors,      |   | Jual-beli preset gaya  |   | Layanan transkripsi|
| Patreon & Ko-fi untuk |   | partikel kustom buatan |   | otomatis berbasis  |
| donasi pengembangan.  |   | sesama kreator video.  |   | GPU cloud (opsi).  |
+───────────────────────+   +────────────────────────+   +────────────────────+
```

1. **Komitmen Free & Open Source Software (FOSS):**
   - Inti aplikasi desktop tidak akan pernah dikunci di balik paywall atau disusupi iklan yang mengganggu (*ad-free, bloat-free*).
2. **Dukungan Komunitas (Sponsorships):**
   - Membuka kanal GitHub Sponsors dan Patreon bagi kreator konten yang terbantu dan ingin mendanai pengembangan fitur baru.
3. **Peluang Ekosistem (Future V2):**
   - **Marketplace Preset Partikel:** Menyediakan platform bagi desainer visual untuk membagikan atau menjual preset partikel eksklusif (*e.g., Cherry Blossom Sakura Wind, Cyber Glitch Stardust*).
   - **Cloud AI Transcribe (Opsional):** Bagi pengguna dengan laptop sangat lemah yang tidak sanggup menjalankan transkripsi lirik AI secara lokal, disediakan opsi transkripsi kilat via server cloud dengan biaya API terjangkau.

---

## 7. Rencana Dukungan & Pemeliharaan (Support & Maintenance Plan)

| Aspek | Standar Layanan (SLA / Target) | Kanal Komunikasi |
| :--- | :--- | :--- |
| **Triage Bug Kritis** | Direspons dalam waktu **< 48–72 jam**. | [GitHub Issues](https://github.com/SayMaven/sub-stellar/issues) |
| **Kerentanan Keamanan** | Patch dependensi / hotfix dirilis dalam waktu **< 7 hari**. | GitHub Security Advisories |
| **Pembaruan Scraper YouTube** | Rilis patch segera saat terjadi perubahan markup Innertube YouTube. | Auto-updater biner |
| **Komunitas & Diskusi** | Tempat tanya jawab, berbagi preset, dan rekomendasi fitur. | GitHub Discussions & Discord |
| **Siklus Rilis Reguler** | Rilis minor fitur baru secara berkala setiap bulan. | GitHub Releases |

