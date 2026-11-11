/**
 * SubStellar - System Font Discovery & Dynamic Custom Font Loader
 *
 * Supports:
 * 1. Native system font discovery (window.queryLocalFonts + comprehensive OS defaults)
 * 2. Curated J-Pop, Anime, and Display typography
 * 3. File upload & drag-and-drop loading (.ttf, .otf, .woff, .woff2) via FontFace API
 */

export interface FontOption {
  family: string;
  label: string;
  category: 'Curated J-Pop' | 'System Fonts' | 'Custom Imported';
  fallback?: string;
}

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

/**
 * Discovers fonts available on the operating system.
 * Attempts window.queryLocalFonts() (Chromium/WebView2 Local Font Access API).
 * If unavailable or denied, returns comprehensive OS default fonts.
 */
export async function discoverSystemFonts(): Promise<FontOption[]> {
  const systemOptions: FontOption[] = [];
  const seenFamilies = new Set<string>();

  // 1. Try native Local Font Access API
  if (typeof window !== 'undefined' && 'queryLocalFonts' in window) {
    try {
      // @ts-expect-error - Local Font Access API experimental type
      const availableFonts = await window.queryLocalFonts();
      for (const font of availableFonts) {
        if (font.family && !seenFamilies.has(font.family.toLowerCase())) {
          seenFamilies.add(font.family.toLowerCase());
          systemOptions.push({
            family: font.family,
            label: font.family,
            category: 'System Fonts',
          });
        }
      }
    } catch {
      // Permission denied or not supported in current context
    }
  }

  // 2. If queryLocalFonts didn't return any fonts, populate with standard common system fonts
  if (systemOptions.length === 0) {
    for (const name of COMMON_SYSTEM_FONTS) {
      if (!seenFamilies.has(name.toLowerCase())) {
        seenFamilies.add(name.toLowerCase());
        systemOptions.push({
          family: name,
          label: name,
          category: 'System Fonts',
        });
      }
    }
  }

  // Sort alphabetically
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

  const fontOption: FontOption = {
    family: familyName,
    label: `${cleanName} (Imported File)`,
    category: 'Custom Imported',
    fallback: 'sans-serif',
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

