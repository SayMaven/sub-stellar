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
import {
  PRESET_CONFIGS,
  RAINBOW_TINTS,
  drawParticleShape,
  type ParticlePresetConfig,
} from './particleShapes';

export type ParticleType = ParticlePresetType;
export { PRESET_CONFIGS, type ParticlePresetConfig };

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

  // Draw all 7 procedural shapes using shared routines
  for (const [key, pos] of Object.entries(shapeMap) as [ParticlePresetType, { col: number; row: number }][]) {
    drawCell(pos.col, pos.row, (c) => {
      drawParticleShape(c, key);
    });
  }

  // Create single atlas texture from canvas
  const atlasTexture = Texture.from(canvas);

  for (const [key, pos] of Object.entries(shapeMap)) {
    result[key as ParticlePresetType] = new Texture({
      source: atlasTexture.source,
      frame: new Rectangle(pos.col * 128, pos.row * 128, 128, 128),
    });
  }

  return result;
}

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
      } else if (colorMode === 'glow' && options?.glowColorHex) {
        const cleaned = options.glowColorHex.trim().replace(/^#/, '');
        if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
          p.tint = parseInt(cleaned, 16);
        } else if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
          p.tint = parseInt(
            `${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`,
            16
          );
        } else {
          p.tint = tint;
        }
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

  private deactivateParticle(p: ParticleState): void {
    p.alive = false;
    p.alpha = 0;
    if (p.pixiParticle) {
      p.pixiParticle.alpha = 0;
      p.pixiParticle.x = -100; // Move offscreen
    }
    this.pool.release(p);
  }

  /**
   * Immediately hides and releases all currently active particles back to the pool.
   */
  public clearAll(): void {
    this.pool.forEachAllocated((p) => {
      if (!p.alive) return;
      this.deactivateParticle(p);
    });
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
        this.deactivateParticle(p);
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
