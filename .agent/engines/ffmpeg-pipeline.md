# FFmpeg Export Pipeline Guidelines

## 1. Hardware Encoder Auto-Probing (Mandatori)
Jangan pernah melakukan hardcode parameter `-c:v h264_nvenc`. Di backend Rust (`hw_probe.rs`), sistem wajib menjalankan probing bertingkat:
1. `h264_nvenc` (NVIDIA)
2. `h264_qsv` (Intel QuickSync)
3. `h264_amf` (AMD)
4. `libx264 -preset veryfast -crf 22` (Fallback CPU hemat daya)

## 2. Output Export Modes
* **Mode 1: Burn-in Video MP4**
  - Menerima raw frame RGBA dari PixiJS melalui stdin pipe.
  - Melakukan overlay ke video sumber dengan kompresi audio AAC 192kbps.
* **Mode 2: Transparent Alpha Video Overlay**
  - **WebM VP9 Alpha:** `-c:v libvpx-vp9 -pix_fmt yuva420p` (untuk DaVinci Resolve, Premiere Pro, CapCut PC).
  - **Apple ProRes 4444:** `-c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le` (standar industri editing profesional).

## 3. Zero Temporary Disk I/O
* Frame dari canvas dikirim via memory pipe (stdin) langsung ke proses FFmpeg, menghindari pembuatan ribuan file PNG sementara di harddisk pengguna.

