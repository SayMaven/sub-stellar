import { describe, it, expect } from 'vitest';
import { VISUAL_PRESETS } from '../engine/presets/presetRegistry';

describe('Visual Presets Registry', () => {
  it('contains at least 16 unique visual presets', () => {
    expect(VISUAL_PRESETS.length).toBeGreaterThanOrEqual(16);
  });

  it('each preset has a unique ID, name, category, and complete subtitle style', () => {
    const ids = new Set<string>();

    for (const preset of VISUAL_PRESETS) {
      expect(preset.id).toBeDefined();
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);

      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.category).toBeDefined();
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.gradientBadge).toBeDefined();

      const { style } = preset;
      expect(style.fontSize).toBeGreaterThan(20);
      expect(style.fillColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(style.wordActiveColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(style.outerStrokeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(style.particleBurstCount).toBeGreaterThanOrEqual(0);
      expect(['stardust', 'sparkle', 'cosmic', 'sakura', 'notes', 'firefly', 'heart']).toContain(
        style.particlePreset
      );
      expect(['pop', 'sweep', 'smooth-sweep', 'float', 'glow-pulse', 'slide', 'staccato', 'zoom-strike', 'wave']).toContain(
        style.wordAnimStyle
      );
    }
  });

  it('includes Clean Minimalist without particle distractions', () => {
    const clean = VISUAL_PRESETS.find((p) => p.id === 'clean-minimalist');
    expect(clean).toBeDefined();
    expect(clean?.style.particleEnabled).toBe(false);
    expect(clean?.style.fillGradientEnabled).toBe(false);
  });
});
