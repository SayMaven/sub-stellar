# Gatefold 3-Zone Shell Layout

Layout antarmuka SubStellar mengadopsi struktur Gatefold 3-zona profesional dengan integrasi Subtitle & Typography Inspector dockable:

```
+---------------------------------------------------------------------------------------------------+
| HEADER TOOLBAR (46px) — Brand Logo, Quick Search [Ctrl+F], Quality Mode Pill, Telemetry, Controls  |
+---------------------+-------------------------------------------------------+---------------------+
| SIDEBAR (236px/68px)| MAIN VIEWPORT STAGE (Flex 1)                          | SUBTITLE INSPECTOR  |
| - Studio (Canvas)   | [ Format: 16:9 | 9:16 | 1:1 | 4:3  —  Zoom: 100% ]   | (320px dockable)    |
| - YouTube Search    | +---------------------------------------------------+ | [ Line & Ruby Tab ] |
| - Lyrics Database   | |                                                   | | - In/Out/Duration   |
| - Presets Library   | |              PIXI.JS V8 VIEWPORT STAGE            | | - {Kanji|Ruby} text |
| - Export Center     | |       (Multi-Stroke Text, Furigana & Particles)   | | - Syllable Badges   |
| - Appearance/Config | |         [Broadcast Safe Guides: 93% / 90%]        | | [ Typography Tab ]|
|                     | |      (atau EmptyStudioState Media Dropzone)       | | - Font size & Ruby% |
|                     | +---------------------------------------------------+ | - Outer / Inner glow|
| [Sidebar Toggle]    | [ TIMELINE TRACKS (Audio Waveform, Word Blocks, Sync)]| [ Quick Presets Tab]|
+---------------------+-------------------------------------------------------+---------------------+
| BOTTOM TRANSPORT BAR (92px)                                                                       |
| [Thumb + Title/Artist]  |  [⏮ ◀ ⏸ ▶ ⏭] [==== Scrubber ==== 00:13.20/03:05.00]  | [🔊 Volume ⛶ ⚙]    |
+---------------------------------------------------------------------------------------------------+
```

## Spesifikasi Ukuran & Komponen:
* **Header Bar:** Tinggi tetap `46px` ([Header.tsx](file:///f:/CODE/software/sub-stellar/src/components/layout/Header.tsx)).
* **Sidebar Kiri:** Lebar `236px` pada mode expanded, dan `68px` pada mode collapsed ([Sidebar.tsx](file:///f:/CODE/software/sub-stellar/src/components/layout/Sidebar.tsx)).
* **Main Viewport Stage:** Menampung canvas PixiJS v8 dengan framing aspect ratio dinamis dan garis panduan Title Safe/Action Safe ([MainStage.tsx](file:///f:/CODE/software/sub-stellar/src/components/studio/MainStage.tsx), [PixiViewport.tsx](file:///f:/CODE/software/sub-stellar/src/components/studio/PixiViewport.tsx)).
* **Empty Studio State:** Dropzone interaktif jika belum ada media/lirik aktif ([EmptyStudioState.tsx](file:///f:/CODE/software/sub-stellar/src/components/studio/EmptyStudioState.tsx)).
* **Subtitle Inspector (Kanan):** Lebar `320px` dengan 3 sub-tab: *Line & Ruby*, *Typography & Outlines*, dan *Presets* ([SubtitleInspector.tsx](file:///f:/CODE/software/sub-stellar/src/components/studio/SubtitleInspector.tsx)).
* **Timeline Drawer (Bawah):** Ketinggian `176px` (`h-44`) dengan multi-track audio waveform peaks, blocks baris subtitle, dan scrubber playhead dinamis ([TimelineDrawer.tsx](file:///f:/CODE/software/sub-stellar/src/components/studio/TimelineDrawer.tsx)).
* **Bottom Transport Bar:** Tinggi `92px`, dengan tombol play/pause melingkar bercahaya di tengah dan slider scrubber yang halus ([TransportBar.tsx](file:///f:/CODE/software/sub-stellar/src/components/layout/TransportBar.tsx)).
* **Tipografi:** Gunakan `Inter Var` atau `Segoe UI Variable Text` untuk UI kontrol; font subtitle mendukung CJK (`Noto Sans JP`).
