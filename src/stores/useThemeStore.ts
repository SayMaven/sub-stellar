import { create } from 'zustand';
import type { ThemeTokens, ThemePresetName } from '../types';

export const THEME_PRESETS: Record<ThemePresetName, ThemeTokens> = {
  default: {
    bg: '#14161b',
    surface: '#1b1e24',
    surface2: '#23272e',
    text: '#f3f4f6',
    text2: '#bfc3ca',
    text3: '#8b9099',
    accent: '#8fb4ff',
    glow: '#5770b0',
    blob1: '#26324f',
    blob2: '#3a2d55',
    blob3: '#1f3d48',
  },
  sakura: {
    bg: '#181216',
    surface: '#221920',
    surface2: '#2e212b',
    text: '#faf0f4',
    text2: '#cfb8c5',
    text3: '#997c8d',
    accent: '#ff94b8',
    glow: '#b84f7b',
    blob1: '#4a1d2f',
    blob2: '#5c2438',
    blob3: '#361427',
  },
  cyberpunk: {
    bg: '#0c1017',
    surface: '#131b26',
    surface2: '#1b2636',
    text: '#f0faff',
    text2: '#9cd5eb',
    text3: '#5a8699',
    accent: '#00f0ff',
    glow: '#ff0055',
    blob1: '#0d2b45',
    blob2: '#380c2f',
    blob3: '#003d4d',
  },
  aurora: {
    bg: '#0d1615',
    surface: '#14211f',
    surface2: '#1c2d2a',
    text: '#eefcf8',
    text2: '#a4d4c7',
    text3: '#6a9489',
    accent: '#5affb5',
    glow: '#2a8f6d',
    blob1: '#11382b',
    blob2: '#1a473e',
    blob3: '#1d3345',
  },
  monochrome: {
    bg: '#121212',
    surface: '#1a1a1a',
    surface2: '#262626',
    text: '#f5f5f5',
    text2: '#cccccc',
    text3: '#888888',
    accent: '#ffffff',
    glow: '#666666',
    blob1: '#222222',
    blob2: '#2b2b2b',
    blob3: '#1f1f1f',
  },
  cover: {
    bg: '#14161b',
    surface: '#1b1e24',
    surface2: '#23272e',
    text: '#f3f4f6',
    text2: '#bfc3ca',
    text3: '#8b9099',
    accent: '#8fb4ff',
    glow: '#5770b0',
    blob1: '#26324f',
    blob2: '#3a2d55',
    blob3: '#1f3d48',
  },
};

function applyTokensToRoot(tokens: ThemeTokens) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--bg', tokens.bg);
  root.style.setProperty('--surface', tokens.surface);
  root.style.setProperty('--surface-2', tokens.surface2);
  root.style.setProperty('--text', tokens.text);
  root.style.setProperty('--text-2', tokens.text2);
  root.style.setProperty('--text-3', tokens.text3);
  root.style.setProperty('--accent', tokens.accent);
  root.style.setProperty('--glow', tokens.glow);
  root.style.setProperty('--blob-1', tokens.blob1);
  root.style.setProperty('--blob-2', tokens.blob2);
  root.style.setProperty('--blob-3', tokens.blob3);
}

interface ThemeStoreState {
  currentPreset: ThemePresetName;
  tokens: ThemeTokens;
  setPreset: (preset: ThemePresetName) => void;
  setCustomTokens: (partial: Partial<ThemeTokens>) => void;
  extractFromCover: (imageUrl: string) => Promise<void>;
}

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  currentPreset: 'default',
  tokens: THEME_PRESETS.default,

  setPreset: (preset: ThemePresetName) => {
    const tokens = THEME_PRESETS[preset] || THEME_PRESETS.default;
    applyTokensToRoot(tokens);
    set({ currentPreset: preset, tokens });
  },

  setCustomTokens: (partial: Partial<ThemeTokens>) => {
    const updated = { ...get().tokens, ...partial };
    applyTokensToRoot(updated);
    set({ tokens: updated });
  },

  extractFromCover: async (imageUrl: string) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = imageUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image for extraction'));
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 64;
      canvas.height = 64;
      ctx.drawImage(img, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;

      for (let i = 0; i < data.length; i += 16) {
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
        count++;
      }

      const avgR = Math.round(rSum / count);
      const avgG = Math.round(gSum / count);
      const avgB = Math.round(bSum / count);

      // Generate harmonious dark theme from dominant color
      const accent = `rgb(${avgR}, ${avgG}, ${avgB})`;
      const glow = `rgba(${avgR}, ${avgG}, ${avgB}, 0.6)`;
      const blob1 = `rgb(${Math.floor(avgR * 0.4)}, ${Math.floor(avgG * 0.4)}, ${Math.floor(avgB * 0.5)})`;
      const blob2 = `rgb(${Math.floor(avgR * 0.5)}, ${Math.floor(avgG * 0.3)}, ${Math.floor(avgB * 0.6)})`;
      const blob3 = `rgb(${Math.floor(avgR * 0.3)}, ${Math.floor(avgG * 0.5)}, ${Math.floor(avgB * 0.5)})`;

      const newTokens: ThemeTokens = {
        ...THEME_PRESETS.default,
        accent,
        glow,
        blob1,
        blob2,
        blob3,
      };

      applyTokensToRoot(newTokens);
      set({ currentPreset: 'cover', tokens: newTokens });
    } catch {
      // Fallback silently if CORS or load fails
      const fallback = THEME_PRESETS.default;
      applyTokensToRoot(fallback);
      set({ currentPreset: 'default', tokens: fallback });
    }
  },
}));
