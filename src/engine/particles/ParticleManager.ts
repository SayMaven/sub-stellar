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
    scaleMin: 0.4,
    scaleMax: 0.9,
    gravityY: -15, // Soft upward drift
  },
  sparkle: {
    speedMin: 80,
    speedMax: 260,
    decayMin: 0.8,
    decayMax: 1.6,
    scaleMin: 0.6,
    scaleMax: 1.4,
    gravityY: 40, // Radial burst falling under slight gravity
  },
  cosmic: {
    speedMin: 30,
    speedMax: 120,
    decayMin: 0.3,
    decayMax: 0.6,
    scaleMin: 0.8,
    scaleMax: 1.8,
    gravityY: -30, // Shimmering cosmic rise
  },
  sakura: {
    speedMin: 25,
    speedMax: 70,
    decayMin: 0.35,
    decayMax: 0.75,
    scaleMin: 0.7,
    scaleMax: 1.3,
    gravityY: 35, // Falling petals
  },
  notes: {
    speedMin: 35,
    speedMax: 90,
    decayMin: 0.4,
    decayMax: 0.85,
    scaleMin: 0.6,
    scaleMax: 1.2,
    gravityY: -25, // Rising melodic notes
  },
  firefly: {
    speedMin: 15,
    speedMax: 50,
    decayMin: 0.25,
    decayMax: 0.6,
    scaleMin: 0.5,
    scaleMax: 1.1,
    gravityY: -15, // Gentle floating embers
  },
  heart: {
    speedMin: 40,
    speedMax: 110,
    decayMin: 0.45,
    decayMax: 0.9,
    scaleMin: 0.6,
    scaleMax: 1.3,
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

  const drawToTexture = (drawFn: (ctx: CanvasRenderingContext2D) => void): Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawFn(ctx);
    }
    return Texture.from(canvas);
  };

  // 1. Stardust: Soft radial glowing micro-orb
  result.stardust = drawToTexture((ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.3, 'rgba(210, 235, 255, 0.9)');
    g.addColorStop(0.7, 'rgba(140, 180, 255, 0.4)');
    g.addColorStop(1, 'rgba(50, 100, 220, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();
  });

  // 2. Sparkle: Sharp 4-point anime diamond flare
  result.sparkle = drawToTexture((ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 12);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(16, 16, 12, 0, Math.PI * 2);
    ctx.fill();

    // 4-pointed diamond star
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.moveTo(16, 2);
    ctx.quadraticCurveTo(16, 16, 30, 16);
    ctx.quadraticCurveTo(16, 16, 16, 30);
    ctx.quadraticCurveTo(16, 16, 2, 16);
    ctx.quadraticCurveTo(16, 16, 16, 2);
    ctx.fill();
  });

  // 3. Cosmic: Concentric glowing orbit rings with bright core
  result.cosmic = drawToTexture((ctx) => {
    // Outer halo
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, 16, 13, 0, Math.PI * 2);
    ctx.stroke();

    // Inner orbital ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(16, 16, 11, 5, Math.PI / 4, 0, Math.PI * 2);
    ctx.stroke();

    // Bright core
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.beginPath();
    ctx.arc(16, 16, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // 4. Sakura: Notched anime cherry blossom petal
  result.sakura = drawToTexture((ctx) => {
    ctx.save();
    ctx.translate(16, 16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    // Heart-notched elongated petal shape
    ctx.moveTo(0, 12);
    ctx.bezierCurveTo(-9, 4, -8, -8, -3, -12);
    ctx.lineTo(0, -9); // notch
    ctx.lineTo(3, -12);
    ctx.bezierCurveTo(8, -8, 9, 4, 0, 12);
    ctx.fill();
    ctx.restore();
  });

  // 5. Notes: Musical eighth note (♪)
  result.notes = drawToTexture((ctx) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    // Note head (tilted oval)
    ctx.beginPath();
    ctx.ellipse(11, 22, 5, 3.5, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    // Stem
    ctx.fillRect(14, 6, 2.5, 16);
    // Flag
    ctx.beginPath();
    ctx.moveTo(16.5, 6);
    ctx.bezierCurveTo(23, 9, 24, 15, 23, 17);
    ctx.bezierCurveTo(21, 14, 18, 11, 16.5, 11);
    ctx.closePath();
    ctx.fill();
  });

  // 6. Firefly: Warm glowing floating ember
  result.firefly = drawToTexture((ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 15);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.2, 'rgba(255, 235, 140, 0.9)');
    g.addColorStop(0.5, 'rgba(255, 170, 50, 0.5)');
    g.addColorStop(1, 'rgba(255, 100, 20, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(16, 16, 15, 0, Math.PI * 2);
    ctx.fill();
  });

  // 7. Heart: Stylized pop idol heart (♥)
  result.heart = drawToTexture((ctx) => {
    ctx.save();
    ctx.translate(16, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.bezierCurveTo(-11, 2, -11, -8, 0, -5);
    ctx.bezierCurveTo(11, -8, 11, 2, 0, 10);
    ctx.fill();
    ctx.restore();
  });

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
