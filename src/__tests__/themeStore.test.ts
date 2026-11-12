import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore, THEME_PRESETS } from '../stores/useThemeStore';
import { hexToHsv, hsvToHex } from '../components/common/StudioColorPicker';

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({
      currentPreset: 'default',
      tokens: THEME_PRESETS.default,
    });
  });

  it('initializes with default Gatefold Obsidian tokens', () => {
    const { currentPreset, tokens } = useThemeStore.getState();
    expect(currentPreset).toBe('default');
    expect(tokens.bg).toBe('#14161b');
    expect(tokens.accent).toBe('#8fb4ff');
    expect(tokens.glow).toBe('#5770b0');
  });

  it('switches to Sakura preset properly', () => {
    const { setPreset } = useThemeStore.getState();
    setPreset('sakura');

    const state = useThemeStore.getState();
    expect(state.currentPreset).toBe('sakura');
    expect(state.tokens.accent).toBe('#ff94b8');
  });

  it('switches to Cyberpunk preset properly', () => {
    const { setPreset } = useThemeStore.getState();
    setPreset('cyberpunk');

    const state = useThemeStore.getState();
    expect(state.currentPreset).toBe('cyberpunk');
    expect(state.tokens.accent).toBe('#00f0ff');
    expect(state.tokens.glow).toBe('#ff0055');
  });

  it('persists theme selection when window.localStorage is present', () => {
    const storage: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, val: string) => {
        storage[key] = val;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        for (const k of Object.keys(storage)) delete storage[k];
      },
    };

    // @ts-expect-error - mock environment
    globalThis.window = { localStorage: mockLocalStorage };
    // @ts-expect-error - mock environment
    globalThis.localStorage = mockLocalStorage;

    const { setPreset } = useThemeStore.getState();
    setPreset('cyberpunk');

    const stored = mockLocalStorage.getItem('substellar_theme_settings_v1');
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed.preset).toBe('cyberpunk');
    expect(parsed.tokens.accent).toBe('#00f0ff');

    // Clean up
    // @ts-expect-error - mock cleanup
    delete globalThis.window;
    // @ts-expect-error - mock cleanup
    delete globalThis.localStorage;
  });

  it('syncThemeToRoot preserves non-default persisted presets like aurora', () => {
    const { setPreset, syncThemeToRoot } = useThemeStore.getState();
    setPreset('aurora');
    syncThemeToRoot();

    const state = useThemeStore.getState();
    expect(state.currentPreset).toBe('aurora');
    expect(state.tokens.accent).toBe('#5affb5');
    expect(state.tokens.bg).toBe('#0d1615');
  });

  it('converts full-range hex <-> HSV cleanly including white, black, and cyan', () => {
    expect(hexToHsv('#ffffff')).toEqual({ h: 0, s: 0, v: 100 });
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    expect(hsvToHex(0, 0, 100)).toBe('#ffffff');
    expect(hsvToHex(0, 0, 0)).toBe('#000000');

    const cyan = hexToHsv('#00f0ff');
    expect(cyan.h).toBe(184);
    expect(cyan.s).toBe(100);
    expect(cyan.v).toBe(100);
    expect(hsvToHex(cyan.h, cyan.s, cyan.v)).toBe('#00eeff');
  });
});

