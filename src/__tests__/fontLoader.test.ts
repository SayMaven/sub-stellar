import { describe, it, expect } from 'vitest';
import {
  CURATED_FONTS,
  COMMON_SYSTEM_FONTS,
  discoverSystemFonts,
  getLoadedCustomFonts,
  parseFontStack,
  formatCssFontStack,
} from '../engine/text/fontLoader';

describe('Font Loader & Discovery', () => {
  it('exposes curated J-Pop and anime typography options', () => {
    expect(COMMON_SYSTEM_FONTS.length).toBeGreaterThan(0);
    expect(CURATED_FONTS.length).toBeGreaterThanOrEqual(10);
    const families = CURATED_FONTS.map((f) => f.family);
    expect(families).toContain('Segoe UI');
    expect(families).toContain('Noto Sans JP');
    expect(families).toContain('Dela Gothic One');
    expect(families).toContain('Zen Maru Gothic');
  });

  it('discoverSystemFonts returns common OS fonts when queryLocalFonts is not available', async () => {
    const fonts = await discoverSystemFonts();
    expect(fonts.length).toBeGreaterThan(0);
    const families = fonts.map((f) => f.family);
    expect(families).toContain('Segoe UI');
    expect(families).toContain('Arial');
  });

  it('getLoadedCustomFonts starts empty or with session fonts', () => {
    const loaded = getLoadedCustomFonts();
    expect(Array.isArray(loaded)).toBe(true);
  });

  it('parseFontStack splits comma-separated preset stacks cleanly without duplicating entries', () => {
    const parsed = parseFontStack('Dela Gothic One, "Segoe UI", segoe ui, sans-serif', [
      'Segoe UI',
      'Noto Sans JP',
      'sans-serif',
    ]);
    expect(parsed).toEqual(['Dela Gothic One', 'Segoe UI', 'sans-serif', 'Noto Sans JP']);
  });

  it('formatCssFontStack quotes multi-word and digit-prefixed family names while leaving generic keywords unquoted', () => {
    const css = formatCssFontStack('07LogoTypeGothic, Impact, sans-serif', ['Segoe UI']);
    expect(css).toBe('"07LogoTypeGothic", "Impact", sans-serif, "Segoe UI"');
  });
});
