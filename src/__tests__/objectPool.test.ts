import { describe, it, expect } from 'vitest';
import { ObjectPool, type Poolable } from '../engine/pixi/ObjectPool';

class TestParticle implements Poolable {
  public x = 0;
  public y = 0;
  public alive = false;

  public reset(): void {
    this.x = 0;
    this.y = 0;
    this.alive = true;
  }

  public isAlive(): boolean {
    return this.alive;
  }
}

describe('ObjectPool (Zero-GC)', () => {
  it('pre-allocates the exact capacity on initialization', () => {
    const pool = new ObjectPool(() => new TestParticle(), 50);
    expect(pool.capacity).toBe(50);
    expect(pool.availableCount).toBe(50);
    expect(pool.activeCount).toBe(0);
  });

  it('acquires and resets objects correctly', () => {
    const pool = new ObjectPool(() => new TestParticle(), 10);
    const p1 = pool.acquire();

    expect(p1).not.toBeNull();
    expect(p1?.alive).toBe(true);
    expect(pool.activeCount).toBe(1);
    expect(pool.availableCount).toBe(9);
  });

  it('releases objects back to pool without allocating new ones', () => {
    const pool = new ObjectPool(() => new TestParticle(), 10);
    const p1 = pool.acquire();
    expect(p1).not.toBeNull();

    p1!.alive = false;
    pool.release(p1!);

    expect(pool.activeCount).toBe(0);
    expect(pool.availableCount).toBe(10);

    const p2 = pool.acquire();
    expect(p2).toBe(p1); // Reused identical instance from static pool
  });

  it('returns null safely when capacity is exhausted without throwing', () => {
    const pool = new ObjectPool(() => new TestParticle(), 3);
    const p1 = pool.acquire();
    const p2 = pool.acquire();
    const p3 = pool.acquire();
    const p4 = pool.acquire();

    expect(p1).not.toBeNull();
    expect(p2).not.toBeNull();
    expect(p3).not.toBeNull();
    expect(p4).toBeNull();
    expect(pool.activeCount).toBe(3);
  });
});

