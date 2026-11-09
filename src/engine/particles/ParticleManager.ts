import { ParticleContainer, Particle, Texture, Rectangle, Container } from 'pixi.js';
import { ObjectPool, type Poolable } from '../pixi/ObjectPool';

export type ParticleType = 'stardust' | 'sparkle' | 'cosmic';

export interface ParticlePresetConfig {
  speedMin: number;
  speedMax: number;
  decayMin: number;
  decayMax: number;
  scaleMin: number;
  scaleMax: number;
  gravityY: number;
}

export const PRESET_CONFIGS: Record<ParticleType, ParticlePresetConfig> = {
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
};

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
  public type: ParticleType = 'stardust';
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
 * Creates procedural glowing circular texture in memory without external asset loading.
 */
function createProceduralParticleTexture(): Texture {
  if (typeof document === 'undefined') {
    return Texture.EMPTY;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(180, 215, 255, 0.9)');
    gradient.addColorStop(0.7, 'rgba(120, 170, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(50, 100, 220, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();

    // 4-pointed cross star glint in center
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(15, 6, 2, 20);
    ctx.fillRect(6, 15, 20, 2);
  }

  return Texture.from(canvas);
}

export class ParticleManager {
  private pool: ObjectPool<ParticleState>;
  public readonly container: ParticleContainer;
  private particleTexture: Texture;
  public readonly stageContainer: Container;

  constructor(maxParticles: number = 750) {
    this.particleTexture = createProceduralParticleTexture();

    this.container = new ParticleContainer({
      dynamicProperties: {
        position: true,
        rotation: true,
        color: true,
        vertex: true,
      },
      boundsArea: new Rectangle(0, 0, 1280, 720),
    });

    this.stageContainer = new Container();
    this.stageContainer.addChild(this.container);

    // Initialize static object pool
    this.pool = new ObjectPool<ParticleState>(() => {
      const state = new ParticleState();
      const p = new Particle({
        texture: this.particleTexture,
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
   * Emits a burst of particles using the zero-GC object pool.
   */
  public emit(
    type: ParticleType,
    originX: number,
    originY: number,
    count: number,
    tint: number = 0x8fb4ff
  ): void {
    const config = PRESET_CONFIGS[type];

    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      if (!p) break; // Reached hardware capacity limit

      p.type = type;
      p.x = originX + (Math.random() - 0.5) * 16;
      p.y = originY + (Math.random() - 0.5) * 12;
      p.tint = tint;

      const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
      const angle =
        type === 'stardust'
          ? Math.random() * Math.PI * 2
          : type === 'sparkle'
          ? Math.random() * Math.PI * 2
          : -Math.PI / 2 + (Math.random() - 0.5) * 1.2; // Upward cone

      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.ay = config.gravityY;

      p.scale = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
      p.scaleSpeed = (Math.random() - 0.5) * 0.2;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 4;

      p.decay = config.decayMin + Math.random() * (config.decayMax - config.decayMin);
      p.alpha = 1;
      p.life = 0;
      p.maxLife = 1 / p.decay;

      if (p.pixiParticle) {
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

      p.scale = Math.max(0.1, p.scale + p.scaleSpeed * deltaSeconds);
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
    if (this.particleTexture !== Texture.EMPTY) {
      this.particleTexture.destroy(true);
    }
  }
}

