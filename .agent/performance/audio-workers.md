# Audio Parsing & Web Worker Guidelines

## Off-Thread Audio Processing
1. **Dilarang Decode Audio di UI Thread:**
   - Memproses file audio besar (4–5 menit) di main thread akan menyebabkan UI freeze.
   - Semua operasi kalkulasi peak amplitude wajib dijalankan di `waveform.worker.ts`.
2. **Peak Downsampling Strategy:**
   - Ekstraksi peak audio wajib di-downsample menjadi **~2.000 titik saja per lagu**, bukan jutaan sample mentah.
   - Format data yang dikirim kembali ke UI thread: `Float32Array` berisi pasangan nilai `[min, max]` per segmen waktu.
3. **Audio Playback Synchronization:**
   - Gunakan `AudioContext.currentTime` atau `HTMLAudioElement.currentTime` sebagai master clock.
   - Hindari re-render pohon React pada setiap perubahan timecode (gunakan direct canvas ticker / Zustand transient selector).

