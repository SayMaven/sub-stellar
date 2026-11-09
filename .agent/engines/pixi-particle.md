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

## 2. Particle System (`ParticleContainer`)
* Gunakan `ParticleContainer` untuk partikel bintang (*stardust*), kilau (*sparkles*), dan debu kosmik.
* Properti dinamis yang diaktifkan: `position: true`, `rotation: true`, `uvs: false`, `color: true`.
* Terapkan `blendMode: 'add'` untuk efek pendaran cahaya yang menyatu dengan background.
* Wajib terhubung ke `ObjectPool` untuk mencegah alokasi memori di setiap frame.

## 3. Subtitle Typography & Shaders
* **Multi-Layer Stroke:**
  - Layer 1: Fill teks (warna solid atau gradien).
  - Layer 2: Inner outline tipis kontras (stroke 2–4px).
  - Layer 3: Outer outline tebal gelap (stroke 6–10px) untuk memisahkan teks dari latar belakang video yang ramai.
* **Outer Glow Filter:**
  - Gunakan `BlurFilter` pada render-layer terpisah di mode Balanced/Ultra.
  - Di mode Low, gantikan blur filter dengan drop-shadow ber-radius lembut untuk menghemat daya GPU.

