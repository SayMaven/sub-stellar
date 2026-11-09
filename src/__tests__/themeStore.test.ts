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

  it('updates custom tokens', () => {
    const { setCustomTokens } = useThemeStore.getState();
    setCustomTokens({ accent: '#123456' });

    expect(useThemeStore.getState().tokens.accent).toBe('#123456');
  });
});
