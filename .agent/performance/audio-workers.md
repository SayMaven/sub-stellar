# Audio Parsing & Web Worker Guidelines

Mengacu pada arsitektur `src/workers/waveform.worker.ts` dan `src/engine/audio/WaveformManager.ts`.

## Off-Thread Audio Processing
1. **Dilarang Decode Audio di UI Thread:**
   - Memproses file audio besar (4–5 menit) di main thread akan menyebabkan UI freeze.
   - Semua operasi kalkulasi peak amplitude wajib dijalankan di `waveform.worker.ts`.
2. **Peak Downsampling Strategy:**
   - Ekstraksi peak audio wajib di-downsample menjadi **~2.000 titik saja per lagu** (1.000 bin min/max), bukan jutaan sample mentah.
   - Format data yang dikirim kembali ke UI thread: `Float32Array` berisi pasangan nilai `[min, max]` per segmen waktu.
   - Transfer data memanfaatkan `transferable ArrayBuffer` pada `postMessage` untuk zero-copy memory transfer.
3. **Waveform Manager & Fallback:**
   - `WaveformManager` mengelola siklus hidup Web Worker dan menyimpan cache data gelombang berdasarkan track ID dan durasi.
   - Menyediakan fallback kalkulasi in-thread otomatis jika berjalan di lingkungan tanpa worker (misalnya runner unit test jsdom).
4. **Audio Playback Synchronization:**
   - Gunakan `AudioContext.currentTime` atau `HTMLAudioElement.currentTime` sebagai master clock.
   - Hindari re-render pohon React pada setiap perubahan timecode (gunakan direct canvas ticker / Zustand transient selector).
   - Timeline scrubber mendukung interaksi pointer capture, trimming handle (start/end), dan snapping ke grid 0.05s.

