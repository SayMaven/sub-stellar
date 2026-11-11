import { describe, it, expect, beforeEach } from 'vitest';
import { usePerfStore, PERF_PROFILES } from '../stores/usePerfStore';

describe('usePerfStore', () => {
  beforeEach(() => {
    usePerfStore.setState({
      mode: 'low',
      profile: PERF_PROFILES.low,
      metrics: {
        fps: 60,
        activeParticles: 0,
        frameTimeMs: 16.6,
        droppedFrames: 0,
        memoryMbEst: 42,
      },
      showTelemetry: false,
    });
  });

  it('initializes in low mode for low-end hardware safety', () => {
    const state = usePerfStore.getState();
    expect(state.mode).toBe('low');
    expect(state.profile.maxParticles).toBe(200);
    expect(state.profile.previewResolution).toBe('720p');
    expect(state.profile.bloomEnabled).toBe(false);
  });

  it('cycles through quality modes correctly', () => {
    const { cycleQualityMode } = usePerfStore.getState();

    cycleQualityMode();
    expect(usePerfStore.getState().mode).toBe('balanced');
    expect(usePerfStore.getState().profile.maxParticles).toBe(750);
    expect(usePerfStore.getState().profile.bloomEnabled).toBe(true);

    cycleQualityMode();
    expect(usePerfStore.getState().mode).toBe('ultra');
    expect(usePerfStore.getState().profile.maxParticles).toBe(2200);

    cycleQualityMode();
    expect(usePerfStore.getState().mode).toBe('low');
  });

  it('updates metrics properly', () => {
    const { updateMetrics } = usePerfStore.getState();
    updateMetrics({ fps: 58, activeParticles: 120 });

    const state = usePerfStore.getState();
    expect(state.metrics.fps).toBe(58);
    expect(state.metrics.activeParticles).toBe(120);
    expect(state.metrics.memoryMbEst).toBe(42);
  });

  it('toggles telemetry HUD', () => {
    const { toggleTelemetry } = usePerfStore.getState();
    expect(usePerfStore.getState().showTelemetry).toBe(false);

    toggleTelemetry();
    expect(usePerfStore.getState().showTelemetry).toBe(true);

    toggleTelemetry();
    expect(usePerfStore.getState().showTelemetry).toBe(false);
  });

  it('persists quality mode selection when window.localStorage is present', () => {
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

    const { setQualityMode } = usePerfStore.getState();
    setQualityMode('ultra');

    expect(mockLocalStorage.getItem('substellar_perf_settings_v1')).toBe('ultra');

    // Clean up
    // @ts-expect-error - mock cleanup
    delete globalThis.window;
    // @ts-expect-error - mock cleanup
    delete globalThis.localStorage;
  });
});

