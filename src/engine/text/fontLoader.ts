import { tauriBridge } from '../../services/tauriBridge';

/**
 * SubStellar - System Font Discovery, Font Stack Utilities & Dynamic Custom Font Loader
 *
 * Supports:
 * 1. Native Rust/Tauri OS font discovery (Registry + OpenType name parser on Windows/macOS/Linux)
 * 2. Browser Local Font Access API (window.queryLocalFonts) + OS defaults fallback
 * 3. Reliable comma-separated font stack parsing & CSS quoting for PixiJS v8 / Canvas 2D
 * 4. Offscreen Canvas availability & Japanese glyph detection
 * 5. File upload & drag-and-drop loading (.ttf, .otf, .woff, .woff2) via FontFace API
 */

export interface FontOption {
  family: string;
  label: string;
  category: 'Curated J-Pop' | 'System Fonts' | 'Custom Imported';
  fallback?: string;
  installed?: boolean;
  supportsJapanese?: boolean;
}

const GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'emoji',
]);

export const CURATED_FONTS: FontOption[] = [
  {
    family: 'Segoe UI',
    label: 'Segoe UI (Windows Default Clean)',
    category: 'Curated J-Pop',
    fallback: 'sans-serif',
  },
  {
    family: 'Inter',
    label: 'Inter (Modern Geometric Sans)',
    category: 'Curated J-Pop',
    fallback: 'sans-serif',
  },
  {
    family: 'Noto Sans JP',
    label: 'Noto Sans JP (Universal Japanese)',
    category: 'Curated J-Pop',
    fallback: 'sans-serif',
  },
  {
    family: 'Yu Gothic UI',
    label: 'Yu Gothic UI (Windows Japanese)',
    category: 'Curated J-Pop',
    fallback: 'sans-serif',
  },
  {
    family: 'Meiryo',
    label: 'Meiryo (Clear Japanese MV)',
    category: 'Curated J-Pop',
    fallback: 'sans-serif',
  },
  {
    family: 'BIZ UDPGothic',
    label: 'BIZ UDPGothic (Vocaloid / MV Heavy)',
    category: 'Curated J-Pop',
    fallback: 'sans-serif',
  },
  {
    family: 'Dela Gothic One',
    label: 'Dela Gothic One (Bold Anime Display)',
    category: 'Curated J-Pop',
    fallback: 'sans-serif',
  },
  {
    family: 'Zen Maru Gothic',
    label: 'Zen Maru Gothic (Cute Rounded Idol)',
    category: 'Curated J-Pop',
    fallback: 'sans-serif',
  },
  {
    family: 'Kaisei Decol',
    label: 'Kaisei Decol (Artistic Romance Mincho)',
    category: 'Curated J-Pop',
    fallback: 'serif',
  },
  {
    family: 'Sawarabi Mincho',
    label: 'Sawarabi Mincho (Traditional Calligraphy)',
    category: 'Curated J-Pop',
    fallback: 'serif',
  },
  {
    family: 'Orbitron',
    label: 'Orbitron (Futuristic Cyberpunk)',
    category: 'Curated J-Pop',
    fallback: 'sans-serif',
  },
  {
    family: 'Bebas Neue',
    label: 'Bebas Neue (Tall Kinetic Headline)',
    category: 'Curated J-Pop',
    fallback: 'sans-serif',
  },
  {
    family: 'Impact',
    label: 'Impact (Heavy Staccato Beat)',
    category: 'Curated J-Pop',
    fallback: 'sans-serif',
  },
];

export const COMMON_SYSTEM_FONTS: string[] = [
  'Arial',
  'Arial Black',
  'Bahnschrift',
  'Calibri',
  'Cambria',
  'Comic Sans MS',
  'Consolas',
  'Courier New',
  'Franklin Gothic Medium',
  'Georgia',
  'Impact',
  'Meiryo',
  'MS Gothic',
  'MS Mincho',
  'MS PGothic',
  'Segoe UI',
  'Segoe UI Variable',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Yu Gothic',
  'Yu Gothic UI',
  'Yu Mincho',
];

const loadedCustomFonts: FontOption[] = [];
const availabilityCache = new Map<string, boolean>();
const japaneseSupportCache = new Map<string, boolean>();

let probeCtx: CanvasRenderingContext2D | null | undefined;
function getProbeContext(): CanvasRenderingContext2D | null {
  if (probeCtx !== undefined) return probeCtx;
  if (typeof document === 'undefined') {
    probeCtx = null;
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    probeCtx = canvas.getContext('2d');
  } catch {
    probeCtx = null;
  }
  return probeCtx;
}

/**
 * Splits a CSS font-family string (e.g. "Impact, Arial Black, sans-serif") into a deduplicated array
 * of clean font family names suitable for PixiJS TextStyle.fontFamily.
 */
export function parseFontStack(
  fontFamily: string | string[] | undefined,
  extraFallbacks: string[] = ['Segoe UI', 'Yu Gothic UI', 'Meiryo', 'Noto Sans JP', 'sans-serif']
): string[] {
  const rawParts: string[] = [];

  if (Array.isArray(fontFamily)) {
    for (const entry of fontFamily) {
      rawParts.push(...String(entry).split(','));
    }
  } else if (typeof fontFamily === 'string' && fontFamily.trim().length > 0) {
    rawParts.push(...fontFamily.split(','));
  } else {
    rawParts.push('Segoe UI');
  }

  rawParts.push(...extraFallbacks);

  const result: string[] = [];
  const seen = new Set<string>();

  for (const part of rawParts) {
    const cleaned = part.trim().replace(/^['"]+|['"]+$/g, '').trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
  }

  return result.length > 0 ? result : ['Segoe UI', 'sans-serif'];
}

/**
 * Formats a CSS font-family stack string with proper double-quoting for non-generic names
 * (essential for names with spaces, hyphens, or leading digits like "07LogoTypeGothic").
 */
export function formatCssFontStack(
  fontFamily: string | string[] | undefined,
  extraFallbacks: string[] = ['Segoe UI', 'Yu Gothic UI', 'Meiryo', 'Noto Sans JP', 'sans-serif']
): string {
  const stack = parseFontStack(fontFamily, extraFallbacks);
  return stack
    .map((name) =>
      GENERIC_FONT_FAMILIES.has(name.toLowerCase()) ? name.toLowerCase() : `"${name.replace(/"/g, '')}"`
    )
    .join(', ');
}

/**
 * Probes whether a given font family is actually installed/loaded in the current browser/WebView.
 */
export function probeFontAvailability(
  family: string,
  discoveredSystemSet?: Set<string>
): boolean {
  const primary = parseFontStack(family, [])[0] || '';
  const key = primary.toLowerCase();
  if (!key) return false;
  if (GENERIC_FONT_FAMILIES.has(key)) return true;

  // Custom loaded FontFace
  if (loadedCustomFonts.some((f) => f.family.toLowerCase() === key)) {
    return true;
  }

  // Confirmed by OS discovery (Rust backend / queryLocalFonts)
  if (discoveredSystemSet && discoveredSystemSet.has(key)) {
    availabilityCache.set(key, true);
    return true;
  }

  const cached = availabilityCache.get(key);
  if (cached !== undefined) return cached;

  const ctx = getProbeContext();
  if (!ctx) {
    // Non-browser environment (SSR/Vitest jsdom): cannot measure pixels, assume available unless strict
    return true;
  }

  const testStr = 'mmmmmmmmmmlliWW123@#&あ';
  const safeFamily = primary.replace(/"/g, '');

  ctx.font = '700 48px monospace';
  const baseMono = ctx.measureText(testStr).width;
  ctx.font = `700 48px "${safeFamily}", monospace`;
  const testMono = ctx.measureText(testStr).width;

  ctx.font = '700 48px sans-serif';
  const baseSans = ctx.measureText(testStr).width;
  ctx.font = `700 48px "${safeFamily}", sans-serif`;
  const testSans = ctx.measureText(testStr).width;

  ctx.font = '700 48px serif';
  const baseSerif = ctx.measureText(testStr).width;
  ctx.font = `700 48px "${safeFamily}", serif`;
  const testSerif = ctx.measureText(testStr).width;

  const detected =
    Math.abs(testMono - baseMono) > 0.05 ||
    Math.abs(testSans - baseSans) > 0.05 ||
    Math.abs(testSerif - baseSerif) > 0.05;

  availabilityCache.set(key, detected);
  return detected;
}

/**
 * Probes whether a font contains native Japanese Kanji/Kana glyphs rather than delegating to OS fallback.
 */
export function probeJapaneseSupport(family: string): boolean {
  const primary = parseFontStack(family, [])[0] || '';
  const key = primary.toLowerCase();
  if (!key) return false;

  const cached = japaneseSupportCache.get(key);
  if (cached !== undefined) return cached;

  const ctx = getProbeContext();
  if (!ctx) return false;

  const jpSample = 'あ漢鬱愛';
  const safeFamily = primary.replace(/"/g, '');

  ctx.font = `700 48px "__SubStellarMissingFont__", sans-serif`;
  const fallbackSans = ctx.measureText(jpSample).width;
  ctx.font = `700 48px "__SubStellarMissingFont__", serif`;
  const fallbackSerif = ctx.measureText(jpSample).width;

  ctx.font = `700 48px "${safeFamily}", sans-serif`;
  const withSans = ctx.measureText(jpSample).width;
  ctx.font = `700 48px "${safeFamily}", serif`;
  const withSerif = ctx.measureText(jpSample).width;

  // If the font has its own Japanese glyphs, changing the generic fallback shouldn't alter measured width
  // (or its metrics differ from both missing-font baselines).
  const hasNativeJp =
    Math.abs(withSans - withSerif) < 0.05 ||
    (Math.abs(withSans - fallbackSans) > 0.05 && Math.abs(withSerif - fallbackSerif) > 0.05);

  japaneseSupportCache.set(key, hasNativeJp);
  return hasNativeJp;
}

/**
 * Returns CURATED_FONTS enriched with real availability & Japanese glyph support flags.
 */
export function getCuratedFontsWithStatus(systemFonts: FontOption[] = []): FontOption[] {
  const sysSet = new Set(systemFonts.map((f) => f.family.toLowerCase()));
  return CURATED_FONTS.map((f) => {
    const installed = probeFontAvailability(f.family, sysSet.size > 0 ? sysSet : undefined);
    const supportsJapanese = installed ? probeJapaneseSupport(f.family) : false;
    return {
      ...f,
      installed,
      supportsJapanese,
    };
  });
}

/**
 * Discovers fonts available on the operating system.
 * Priority:
 * 1. Native Rust Tauri OS scanner (tauriBridge.getSystemFonts — discovers 100% of installed OS fonts)
 * 2. Browser Local Font Access API (window.queryLocalFonts)
 * 3. Comprehensive OS defaults fallback (COMMON_SYSTEM_FONTS)
 */
export async function discoverSystemFonts(): Promise<FontOption[]> {
  const systemOptions: FontOption[] = [];
  const seenFamilies = new Set<string>();

  const addFamily = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (!seenFamilies.has(key)) {
      seenFamilies.add(key);
      availabilityCache.set(key, true);
      systemOptions.push({
        family: trimmed,
        label: trimmed,
        category: 'System Fonts',
        installed: true,
      });
    }
  };

  // 1. Native Rust backend OS scan (works silently in Tauri without WebView2 permission blocks)
  try {
    const nativeFonts = await tauriBridge.getSystemFonts();
    for (const fam of nativeFonts) {
      addFamily(fam);
    }
  } catch {
    // Non-Tauri or unavailable
  }

  // 2. Supplement with native Local Font Access API when running in Chromium/browser
  if (typeof window !== 'undefined' && 'queryLocalFonts' in window) {
    try {
      // @ts-expect-error - Local Font Access API experimental type
      const availableFonts = await window.queryLocalFonts();
      for (const font of availableFonts) {
        if (font.family) {
          addFamily(font.family);
        }
      }
    } catch {
      // Permission denied or requires transient user gesture in WebView2
    }
  }

  // 3. Fallback when neither native OS scan nor queryLocalFonts returned any fonts
  if (systemOptions.length === 0) {
    for (const name of COMMON_SYSTEM_FONTS) {
      addFamily(name);
    }
  }

  systemOptions.sort((a, b) => a.family.localeCompare(b.family));
  return systemOptions;
}

/**
 * Loads a local font file (.ttf, .otf, .woff, .woff2) into the document
 * using the native browser FontFace API.
 */
export async function loadFontFromFile(file: File): Promise<FontOption> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') {
    throw new Error('FontFace API is not supported in this environment.');
  }

  // Sanitize family name from file name
  const cleanName = file.name
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/[^a-zA-Z0-9_\-\s]/g, '') // remove special chars
    .trim();

  const familyName = `Custom_${cleanName || 'Font'}_${Date.now().toString(36)}`;
  const buffer = await file.arrayBuffer();

  const fontFace = new FontFace(familyName, buffer);
  await fontFace.load();
  document.fonts.add(fontFace);

  availabilityCache.set(familyName.toLowerCase(), true);

  const fontOption: FontOption = {
    family: familyName,
    label: `${cleanName || 'Custom'} (Imported File)`,
    category: 'Custom Imported',
    fallback: 'sans-serif',
    installed: true,
    supportsJapanese: probeJapaneseSupport(familyName),
  };

  loadedCustomFonts.push(fontOption);
  return fontOption;
}

/**
 * Returns any custom fonts previously loaded in this session.
 */
export function getLoadedCustomFonts(): FontOption[] {
  return [...loadedCustomFonts];
}
