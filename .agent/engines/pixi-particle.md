# PixiJS v8 Particle & Typography Engine Guidelines

Mengacu pada skill resmi `pixijs-scene-particle-container`, `pixijs-scene-text`, dan `pixijs-filters`.

## 1. Lifecycle PixiJS v8
* Gunakan inisialisasi asinkron:
  ```typescript
  const app = new Application();
  await app.init({
    width: 1920,
    height: 1080,
    preference: 'webgl', // fallback otomatis ke WebGL jika WebGPU tidak didukung
    backgroundAlpha: 0,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  ```
* Wajib melakukan destroy saat unmount:
  ```typescript
  app.destroy({ removeView: true }, { children: true, texture: true });
  ```

## 2. Particle System (`ParticleContainer` & `ObjectPool`)
* Gunakan `ParticleContainer` untuk partikel bintang (*stardust*), kilau (*sparkles*), dan debu kosmik (`src/engine/particles/ParticleManager.ts`).
* Properti dinamis yang diaktifkan: `position: true`, `rotation: true`, `color: true`, `vertex: true`.
* Terapkan tekstur prosedural in-memory (radial glow + cross star glint via Canvas 2D) untuk eliminasi ketergantungan file aset eksternal.
* Wajib terhubung ke `ObjectPool<ParticleState>` (`src/engine/pixi/ObjectPool.ts`) dengan alokasi statis di awal:
  - Zero GC allocations per frame di dalam `app.ticker`.
  - Mutasi in-place terhadap properti `pixiParticle` (`x, y, scaleX, scaleY, rotation, alpha, tint`).
  - Partikel mati otomatis di-release dan disembunyikan (`alpha = 0`) tanpa alokasi objek baru.
* Tiga Preset Fisika:
  - `stardust`: Gerakan melayang lambat ke atas (soft upward drift, gravitasi -15).
  - `sparkle`: Ledakan radial cepat dengan gravitasi jatuh ringan (radial burst, gravitasi +40).
  - `cosmic`: Pendaran kosmik shimmering naik cepat (gravitasi -30).

## 3. Subtitle Typography & Shaders
* **Multi-Layer Stroke:**
  - Layer 1: Fill teks (warna solid atau gradien).
  - Layer 2: Inner outline tipis kontras (stroke 2–4px).
  - Layer 3: Outer outline tebal gelap (stroke 6–10px) untuk memisahkan teks dari latar belakang video yang ramai.
* **Outer Glow Filter:**
  - Gunakan `BlurFilter` pada render-layer terpisah di mode Balanced/Ultra.
  - Di mode Low, gantikan blur filter dengan drop-shadow ber-radius lembut untuk menghemat daya GPU.

