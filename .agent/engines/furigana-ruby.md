# Furigana & Japanese Morphology Engine Guidelines

## 1. Arsitektur NLP & Layout Engine
* **Engine Morfologi:** `Kuroshiro` didukung oleh `kuromoji.js` tokenizer.
* **Layout Engine Canvas:** Terimplementasi pada [src/engine/text/RubyLayout.ts](file:///f:/CODE/software/sub-stellar/src/engine/text/RubyLayout.ts) dan diuji pada [src/__tests__/rubyLayout.test.ts](file:///f:/CODE/software/sub-stellar/src/__tests__/rubyLayout.test.ts).
* **Offline Dictionary:** File kamus diletakkan di `public/dict/` (`base.dat.gz`, `check.dat.gz`, `tid.dat.gz`, `pos.dat.gz`).
* **On-Demand Loading:** Kamus hanya diinisialisasi saat proses "Auto Furigana" dipanggil pertama kali, dan dapat dibebaskan jika memori kritis.

## 2. Format Serialisasi Tag
* Format standar SubStellar menggunakan tag Markdown Ruby:
  ```
  もう{何|なに}もいらない
  あぁ{待|ま}ち{遠|とお}しいな
  {星|ほし}{空|ぞら}の{下|した}で{歌|うた}おう
  ```
* Fungsi parser & serializer:
  - `parseMarkdownRuby(text: string): ParsedRubyToken[]`
  - `serializeToMarkdownRuby(tokens: ParsedRubyToken[]): string`

## 3. Kalkulasi Layout Ruby di Canvas (PixiJS v8)
* **Skala Font Furigana:** Standar adalah **40%–50%** (default: `45%` / `0.45`) dari font Kanji utama.
* **Centering Horizontal Presisi:**
  $$\text{rubyX} = \text{baseX} + \frac{\text{baseWidth} - \text{rubyWidth}}{2}$$
* **Jarak Vertikal:**
  $$\text{rubyY} = \text{baseY} - \text{rubyHeight} - \text{gap} \quad (\text{default gap: } 2\text{px})$$
  Hal ini mencegah tumpang-tindih teks ruby dengan stroke tebal kanji.

## 4. Segmentasi Grapheme & Aturan Kinsoku Shori (CJK Line-Wrap)
* **Segmentasi Karakter:** Menggunakan `Intl.Segmenter` via fungsi `getGraphemeClusters(text, locale)` untuk mencegah terbelahnya glyph gabungan dan emoji.
* **Aturan Kinsoku Shori (`wrapCJKText`):**
  - **Dilarang di awal baris:** Tanda baca `、`, `。`, `，`, `．`, `！`, `？`, `）`, `」`, `』`, dll.
  - **Dilarang di akhir baris:** Tanda kurung buka `（`, `「`, `『`, dll.

## 5. Multi-Layer Stroke Rendering
Pada kanvas PixiJS ([PixiViewport.tsx](file:///f:/CODE/software/sub-stellar/src/components/studio/PixiViewport.tsx)), teks subtitle dan furigana dirender menggunakan multi-layer outline:
1. **Outer Dark Stroke:** Ketebalan 8–12px (`#14161b`) untuk memastikan kontras keterbacaan di latar video terang.
2. **Inner Neon/Accent Stroke & Glow:** Ketebalan 2–4px (`#8fb4ff`) dengan dropShadow blur adaptif untuk estetika starlight J-Pop MV.
