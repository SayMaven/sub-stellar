import { describe, it, expect } from 'vitest';
import { ParticleManager, PRESET_CONFIGS } from '../engine/particles/ParticleManager';

describe('ParticleManager (Zero-GC)', () => {
  it('initializes with capacity based on hardware profile', () => {
    const manager = new ParticleManager(150);
    expect(manager.capacity).toBe(150);
    expect(manager.activeCount).toBe(0);
  });

  it('emits particles and increments active count', () => {
    const manager = new ParticleManager(100);
    manager.emit('stardust', 200, 300, 15, 0x8fb4ff);

    expect(manager.activeCount).toBe(15);
  });

  it('updates particle physics and decays alpha over time', () => {
    const manager = new ParticleManager(100);
    manager.emit('sparkle', 200, 300, 10, 0x00f0ff);

    expect(manager.activeCount).toBe(10);

    // Simulate 0.5s elapsed
    manager.update(0.5);
    expect(manager.activeCount).toBeLessThanOrEqual(10);

    // Simulate 3.0s elapsed (all particles should have expired and returned to pool)
    manager.update(3.0);
    expect(manager.activeCount).toBe(0);
  });

  it('clamps emission to max capacity without overflowing or throwing', () => {
    const manager = new ParticleManager(20);
    manager.emit('cosmic', 100, 100, 50);

    expect(manager.activeCount).toBe(20);
  });

  it('preset configurations define valid physics ranges', () => {
    for (const [, config] of Object.entries(PRESET_CONFIGS)) {
      expect(config.speedMax).toBeGreaterThan(config.speedMin);
      expect(config.decayMax).toBeGreaterThan(config.decayMin);
      expect(config.scaleMax).toBeGreaterThan(config.scaleMin);
    }
  });

  it('clearAll immediately hides and releases all active particles back to the pool', () => {
    const manager = new ParticleManager(60);
    manager.emit('sakura', 300, 400, 25, 0xff94b8);
    expect(manager.activeCount).toBe(25);

    manager.clearAll();
    expect(manager.activeCount).toBe(0);

    // Pool capacity should be completely reusable after clearAll
    manager.emit('heart', 300, 400, 60, 0xff007f);
    expect(manager.activeCount).toBe(60);
  });
});
