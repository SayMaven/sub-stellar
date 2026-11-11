import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore, THEME_PRESETS } from '../stores/useThemeStore';

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
});

