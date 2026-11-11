/**
 * SubStellar - High-Performance Particle Engine (Zero-GC Object Pooling)
 *
 * Supports 7 distinct procedural particle shapes:
 * - Stardust (soft celestial micro-orbs)
 * - Sparkle (4-point anime twinkle diamond cross)
 * - Cosmic (concentric orbital rings with bright core)
 * - Sakura (delicate falling cherry blossom petals)
 * - Notes (melodic musical notes ♪ ♫)
 * - Firefly (warm glowing floating embers)
 * - Heart (pop idol heart pops ♥)
 *
 * Advanced physics: velocity, gravity direction, particle scale, lifetime, and color modes.
 */

import { ParticleContainer, Particle, Texture, Rectangle, Container } from 'pixi.js';
import { ObjectPool, type Poolable } from '../pixi/ObjectPool';
import type { ParticlePresetType } from '../../types';

export type ParticleType = ParticlePresetType;

export interface ParticlePresetConfig {
  speedMin: number;
  speedMax: number;
  decayMin: number;
  decayMax: number;
  scaleMin: number;
  scaleMax: number;
  gravityY: number;
}

export const PRESET_CONFIGS: Record<ParticlePresetType, ParticlePresetConfig> = {
  stardust: {
    speedMin: 20,
    speedMax: 80,
    decayMin: 0.4,
    decayMax: 0.8,
    scaleMin: 0.16,
    scaleMax: 0.32,
    gravityY: -15, // Soft upward drift
  },
  sparkle: {
    speedMin: 80,
    speedMax: 260,
    decayMin: 0.8,
    decayMax: 1.6,
    scaleMin: 0.18,
    scaleMax: 0.38,
    gravityY: 40, // Radial burst falling under slight gravity
  },
  cosmic: {
    speedMin: 30,
    speedMax: 120,
    decayMin: 0.3,
    decayMax: 0.6,
    scaleMin: 0.2,
    scaleMax: 0.42,
    gravityY: -30, // Shimmering cosmic rise
  },
  sakura: {
    speedMin: 25,
    speedMax: 70,
    decayMin: 0.35,
    decayMax: 0.75,
    scaleMin: 0.18,
    scaleMax: 0.36,
    gravityY: 35, // Falling petals
  },
  notes: {
    speedMin: 35,
    speedMax: 90,
    decayMin: 0.4,
    decayMax: 0.85,
    scaleMin: 0.18,
    scaleMax: 0.34,
    gravityY: -25, // Rising melodic notes
  },
  firefly: {
    speedMin: 15,
    speedMax: 50,
    decayMin: 0.25,
    decayMax: 0.6,
    scaleMin: 0.16,
    scaleMax: 0.32,
    gravityY: -15, // Gentle floating embers
  },
  heart: {
    speedMin: 40,
    speedMax: 110,
    decayMin: 0.45,
    decayMax: 0.9,
    scaleMin: 0.18,
    scaleMax: 0.36,
    gravityY: -30, // Pop heart floating up
  },
};

export interface ParticleEmitOptions {
  speedMultiplier?: number;
  gravity?: 'up' | 'none' | 'down';
  sizeMultiplier?: number;
  lifetimeMultiplier?: number;
  colorMode?: 'lyric' | 'glow' | 'rainbow';
  glowColorHex?: string;
}

export class ParticleState implements Poolable {
  public x = 0;
  public y = 0;
  public vx = 0;
  public vy = 0;
  public ax = 0;
  public ay = 0;
  public scale = 1;
  public scaleSpeed = 0;
  public rotation = 0;
  public rotationSpeed = 0;
  public alpha = 0;
  public decay = 1;
  public tint = 0xffffff;
  public life = 0;
  public maxLife = 1;
  public alive = false;
  public type: ParticlePresetType = 'stardust';
  public pixiParticle: Particle | null = null;

  public reset(): void {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.scale = 1;
    this.scaleSpeed = 0;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.alpha = 1;
    this.decay = 1;
    this.tint = 0xffffff;
    this.life = 0;
    this.maxLife = 1;
    this.alive = true;
    this.type = 'stardust';

    if (this.pixiParticle) {
      this.pixiParticle.alpha = 1;
      this.pixiParticle.scaleX = 1;
      this.pixiParticle.scaleY = 1;
    }
  }

  public isAlive(): boolean {
    return this.alive && this.alpha > 0.01;
  }
}

/**
 * Procedural texture generators for 7 distinct particle types
 */
/**
 * Procedural texture atlas generator for 7 distinct particle types.
 *
 * NOTE FOR PIXIJS v8 ParticleContainer:
 * In PixiJS v8, all particles within a ParticleContainer batch MUST share the same
 * underlying TextureSource (Texture.source). Generating independent canvas textures
 * causes PixiJS to reuse the first particle's TextureSource for all subsequent textures.
 * By rendering all 7 shapes into a single 512x256 high-resolution texture atlas
 * (128x128 per tile) and slicing them into sub-textures, all particles share the same
 * GPU texture source, ensuring sharp, distinct shapes with zero UV bleeding.
 */
function createShapeTextures(): Record<ParticlePresetType, Texture> {
  const result: Record<ParticlePresetType, Texture> = {
    stardust: Texture.EMPTY,
    sparkle: Texture.EMPTY,
    cosmic: Texture.EMPTY,
    sakura: Texture.EMPTY,
    notes: Texture.EMPTY,
    firefly: Texture.EMPTY,
    heart: Texture.EMPTY,
  };

  if (typeof document === 'undefined') {
    return result;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return result;
  }

  // Clear transparent canvas
  ctx.clearRect(0, 0, 512, 256);

  // Helper to draw inside a 128x128 cell with center at (64, 64)
  const drawCell = (col: number, row: number, drawFn: (c: CanvasRenderingContext2D) => void) => {
    ctx.save();
    ctx.translate(col * 128 + 64, row * 128 + 64);
    drawFn(ctx);
    ctx.restore();
  };

  // 1. Stardust (Cell 0, 0): Sharp celestial orb with luminous glow aura
  drawCell(0, 0, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 54);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.25, 'rgba(230, 245, 255, 0.95)');
    g.addColorStop(0.55, 'rgba(160, 210, 255, 0.5)');
    g.addColorStop(1, 'rgba(60, 130, 255, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, 54, 0, Math.PI * 2);
    c.fill();

    // Solid bright core for crisp definition
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(0, 0, 16, 0, Math.PI * 2);
    c.fill();
  });

  // 2. Sparkle (Cell 1, 0): Sharp 4-point anime diamond flare
  drawCell(1, 0, (c) => {
    // Subtle central glow
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 36);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    g.addColorStop(0.4, 'rgba(255, 255, 255, 0.3)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, 36, 0, Math.PI * 2);
    c.fill();

    // Primary 4-pointed diamond star (crisp solid vector path)
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -56);
    c.quadraticCurveTo(0, 0, 56, 0);
    c.quadraticCurveTo(0, 0, 0, 56);
    c.quadraticCurveTo(0, 0, -56, 0);
    c.quadraticCurveTo(0, 0, 0, -56);
    c.closePath();
    c.fill();

    // Secondary diagonal micro-spikes for extra anime sparkle
    c.fillStyle = 'rgba(255, 255, 255, 0.85)';
    c.beginPath();
    c.moveTo(0, -26);
    c.quadraticCurveTo(0, 0, 26, 0);
    c.quadraticCurveTo(0, 0, 0, 26);
    c.quadraticCurveTo(0, 0, -26, 0);
    c.quadraticCurveTo(0, 0, 0, -26);
    c.closePath();
    c.save();
    c.rotate(Math.PI / 4);
    c.fill();
    c.restore();

    // Solid core highlight
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(0, 0, 6, 0, Math.PI * 2);
    c.fill();
  });

  // 3. Cosmic (Cell 2, 0): Concentric orbital rings with bright core
  drawCell(2, 0, (c) => {
    // Outer orbit ring
    c.strokeStyle = 'rgba(190, 225, 255, 0.85)';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(0, 0, 50, 0, Math.PI * 2);
    c.stroke();

    // Tilted elliptical orbit ring
    c.strokeStyle = '#ffffff';
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(0, 0, 48, 20, Math.PI / 3, 0, Math.PI * 2);
    c.stroke();

    // Second counter-tilted ring
    c.strokeStyle = 'rgba(140, 200, 255, 0.7)';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(0, 0, 48, 20, -Math.PI / 3, 0, Math.PI * 2);
    c.stroke();

    // Core star
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(0, 0, 16, 0, Math.PI * 2);
    c.fill();

    // Orbiting mini satellites
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(36, -34, 5, 0, Math.PI * 2);
    c.arc(-36, 34, 5, 0, Math.PI * 2);
    c.fill();
  });

  // 4. Sakura (Cell 3, 0): Crisp notched cherry blossom petal
  drawCell(3, 0, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    // Heart-notched elongated petal shape
    c.moveTo(0, 48);
    c.bezierCurveTo(-38, 16, -34, -34, -14, -50);
    c.lineTo(0, -36); // Center notch
    c.lineTo(14, -50);
    c.bezierCurveTo(34, -34, 38, 16, 0, 48);
    c.closePath();
    c.fill();

    // Delicate inner central vein line
    c.strokeStyle = 'rgba(255, 182, 193, 0.6)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 36);
    c.lineTo(0, -20);
    c.stroke();
  });

  // 5. Notes (Cell 0, 1): Musical eighth note (♪)
  drawCell(0, 1, (c) => {
    c.fillStyle = '#ffffff';
    // Note head (tilted oval)
    c.beginPath();
    c.ellipse(-16, 26, 20, 14, -Math.PI / 6, 0, Math.PI * 2);
    c.fill();

    // Vertical Stem
    c.fillRect(-2, -38, 10, 66);

    // Dynamic musical flag
    c.beginPath();
    c.moveTo(8, -38);
    c.bezierCurveTo(34, -28, 38, -6, 32, 6);
    c.bezierCurveTo(26, -6, 18, -18, 8, -18);
    c.closePath();
    c.fill();
  });

  // 6. Firefly (Cell 1, 1): Warm glowing floating ember
  drawCell(1, 1, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 56);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.2, 'rgba(255, 240, 150, 0.95)');
    g.addColorStop(0.5, 'rgba(255, 175, 40, 0.5)');
    g.addColorStop(1, 'rgba(255, 100, 20, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, 56, 0, Math.PI * 2);
    c.fill();

    // Solid warm core
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(0, 0, 15, 0, Math.PI * 2);
    c.fill();
  });

  // 7. Heart (Cell 2, 1): Pop idol heart (♥)
  drawCell(2, 1, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, 42);
    c.bezierCurveTo(-46, 10, -46, -38, 0, -18);
    c.bezierCurveTo(46, -38, 46, 10, 0, 42);
    c.closePath();
    c.fill();

    // Inner highlight gleam
    c.fillStyle = 'rgba(255, 255, 255, 0.5)';
    c.beginPath();
    c.arc(-16, -14, 6, 0, Math.PI * 2);
    c.fill();
  });

  // Create single atlas texture from canvas
  const atlasTexture = Texture.from(canvas);

  // Slice individual shape textures with shared TextureSource
  const shapeMap: Record<ParticlePresetType, { col: number; row: number }> = {
    stardust: { col: 0, row: 0 },
    sparkle: { col: 1, row: 0 },
    cosmic: { col: 2, row: 0 },
    sakura: { col: 3, row: 0 },
    notes: { col: 0, row: 1 },
    firefly: { col: 1, row: 1 },
    heart: { col: 2, row: 1 },
  };

  for (const [key, pos] of Object.entries(shapeMap)) {
    result[key as ParticlePresetType] = new Texture({
      source: atlasTexture.source,
      frame: new Rectangle(pos.col * 128, pos.row * 128, 128, 128),
    });
  }

  return result;
}

const RAINBOW_TINTS = [
  0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x00c7be, 0x32ade6, 0x5856d6, 0xaf52de,
];

export class ParticleManager {
  private pool: ObjectPool<ParticleState>;
  public readonly container: ParticleContainer;
  private textures: Record<ParticlePresetType, Texture>;
  public readonly stageContainer: Container;

  constructor(maxParticles: number = 750) {
    this.textures = createShapeTextures();

    this.container = new ParticleContainer({
      dynamicProperties: {
        position: true,
        rotation: true,
        color: true,
        vertex: true,
        uvs: true,
      },
      boundsArea: new Rectangle(0, 0, 1920, 1080),
    });

    this.stageContainer = new Container();
    this.stageContainer.addChild(this.container);

    // Initialize static object pool
    this.pool = new ObjectPool<ParticleState>(() => {
      const state = new ParticleState();
      const p = new Particle({
        texture: this.textures.stardust,
        x: -100,
        y: -100,
        anchorX: 0.5,
        anchorY: 0.5,
        alpha: 0,
      });
      state.pixiParticle = p;
      this.container.addParticle(p);
      return state;
    }, maxParticles);
  }

  /**
   * Emits a burst of particles using the zero-GC object pool with custom physics & shapes.
   */
  public emit(
    type: ParticlePresetType,
    originX: number,
    originY: number,
    count: number,
    tint: number = 0x8fb4ff,
    options?: ParticleEmitOptions
  ): void {
    const config = PRESET_CONFIGS[type] || PRESET_CONFIGS.stardust;
    const speedMult = options?.speedMultiplier ?? 1.0;
    const sizeMult = options?.sizeMultiplier ?? 1.0;
    const lifetimeMult = options?.lifetimeMultiplier ?? 1.0;
    const gravityDir = options?.gravity ?? 'none';
    const colorMode = options?.colorMode ?? 'lyric';

    const chosenTexture = this.textures[type] || this.textures.stardust;

    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      if (!p) break; // Reached hardware capacity limit

      p.type = type;
      p.x = originX + (Math.random() - 0.5) * 20;
      p.y = originY + (Math.random() - 0.5) * 16;

      // Color strategy
      if (colorMode === 'rainbow') {
        p.tint = RAINBOW_TINTS[Math.floor(Math.random() * RAINBOW_TINTS.length)];
      } else {
        p.tint = tint;
      }

      const baseSpeed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
      const speed = baseSpeed * speedMult;

      const angle =
        type === 'sakura'
          ? Math.PI / 4 + (Math.random() - 0.5) * 0.8 // Downward angle
          : type === 'notes' || type === 'firefly' || type === 'heart'
          ? -Math.PI / 2 + (Math.random() - 0.5) * 1.4 // Upward cone
          : Math.random() * Math.PI * 2; // 360 burst

      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;

      // Gravity determination
      if (gravityDir === 'up') {
        p.ay = -Math.abs(config.gravityY || 20);
      } else if (gravityDir === 'down') {
        p.ay = Math.abs(config.gravityY || 20);
      } else {
        p.ay = 0;
      }

      const baseScale = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
      p.scale = baseScale * sizeMult;
      p.scaleSpeed = (Math.random() - 0.5) * 0.2;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 4;

      const baseDecay = config.decayMin + Math.random() * (config.decayMax - config.decayMin);
      p.decay = baseDecay / Math.max(0.1, lifetimeMult);
      p.alpha = 1;
      p.life = 0;
      p.maxLife = 1 / p.decay;

      if (p.pixiParticle) {
        p.pixiParticle.texture = chosenTexture;
        p.pixiParticle.x = p.x;
        p.pixiParticle.y = p.y;
        p.pixiParticle.alpha = p.alpha;
        p.pixiParticle.tint = p.tint;
        p.pixiParticle.scaleX = p.scale;
        p.pixiParticle.scaleY = p.scale;
        p.pixiParticle.rotation = p.rotation;
      }
    }
  }

  /**
   * Updates all active particles in 60 FPS render ticker without allocating any new objects.
   */
  public update(deltaSeconds: number): void {
    this.pool.forEachAllocated((p) => {
      if (!p.alive) return;

      p.life += deltaSeconds;
      p.alpha -= p.decay * deltaSeconds;

      if (p.alpha <= 0.01 || p.life >= p.maxLife) {
        p.alive = false;
        p.alpha = 0;
        if (p.pixiParticle) {
          p.pixiParticle.alpha = 0;
          p.pixiParticle.x = -100; // Move offscreen
        }
        this.pool.release(p);
        return;
      }

      // Physics integration
      p.vx += p.ax * deltaSeconds;
      p.vy += p.ay * deltaSeconds;
      p.x += p.vx * deltaSeconds;
      p.y += p.vy * deltaSeconds;

      p.scale = Math.max(0.05, p.scale + p.scaleSpeed * deltaSeconds);
      p.rotation += p.rotationSpeed * deltaSeconds;

      // Sync to PixiJS GPU particle
      if (p.pixiParticle) {
        p.pixiParticle.x = p.x;
        p.pixiParticle.y = p.y;
        p.pixiParticle.alpha = p.alpha;
        p.pixiParticle.scaleX = p.scale;
        p.pixiParticle.scaleY = p.scale;
        p.pixiParticle.rotation = p.rotation;
      }
    });
  }

  public get activeCount(): number {
    return this.pool.activeCount;
  }

  public get capacity(): number {
    return this.pool.capacity;
  }

  public destroy(): void {
    this.stageContainer.destroy({ children: true });
    for (const key of Object.keys(this.textures) as ParticlePresetType[]) {
      if (this.textures[key] !== Texture.EMPTY) {
        this.textures[key].destroy(true);
      }
    }
  }
}
