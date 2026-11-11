import { create } from 'zustand';
import type { QualityMode, PerfMetrics, PerfProfile } from '../types';

export const PERF_PROFILES: Record<QualityMode, PerfProfile> = {
  low: {
    mode: 'low',
    maxParticles: 200,
    previewResolution: '720p',
    renderScale: 0.67,
    bloomEnabled: false,
    supersampling: false,
    downsampledPeaksCount: 1500,
  },
  balanced: {
    mode: 'balanced',
    maxParticles: 750,
    previewResolution: '1080p',
    renderScale: 1.0,
    bloomEnabled: true,
    supersampling: false,
    downsampledPeaksCount: 2500,
  },
  ultra: {
    mode: 'ultra',
    maxParticles: 2200,
    previewResolution: '1080p',
    renderScale: 1.0,
    bloomEnabled: true,
    supersampling: true,
    downsampledPeaksCount: 4000,
  },
};

interface PerfStoreState {
  mode: QualityMode;
  profile: PerfProfile;
  metrics: PerfMetrics;
  showTelemetry: boolean;
  setQualityMode: (mode: QualityMode) => void;
  cycleQualityMode: () => void;
  updateMetrics: (partial: Partial<PerfMetrics>) => void;
  toggleTelemetry: () => void;
}

const PERF_STORAGE_KEY = 'substellar_perf_settings_v1';

function loadSavedPerfMode(): QualityMode {
  if (typeof window === 'undefined') return 'low';
  try {
    const raw = localStorage.getItem(PERF_STORAGE_KEY);
    if (raw && (raw === 'low' || raw === 'balanced' || raw === 'ultra')) {
      return raw as QualityMode;
    }
  } catch {
    // Fallback on error
  }
  return 'low';
}

function savePerfMode(mode: QualityMode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PERF_STORAGE_KEY, mode);
  } catch {
    // Ignore error
  }
}

const initialPerfMode = loadSavedPerfMode();

export const usePerfStore = create<PerfStoreState>((set) => ({
  mode: initialPerfMode,
  profile: PERF_PROFILES[initialPerfMode] || PERF_PROFILES.low,
  metrics: {
    fps: 60,
    activeParticles: 0,
    frameTimeMs: 16.6,
    droppedFrames: 0,
    memoryMbEst: 42,
  },
  showTelemetry: false,

  setQualityMode: (mode: QualityMode) => {
    savePerfMode(mode);
    set({
      mode,
      profile: PERF_PROFILES[mode],
    });
  },

  cycleQualityMode: () => {
    set((state) => {
      const order: QualityMode[] = ['low', 'balanced', 'ultra'];
      const nextIndex = (order.indexOf(state.mode) + 1) % order.length;
      const nextMode = order[nextIndex];
      savePerfMode(nextMode);
      return {
        mode: nextMode,
        profile: PERF_PROFILES[nextMode],
      };
    });
  },

  updateMetrics: (partial: Partial<PerfMetrics>) => {
    set((state) => ({
      metrics: {
        ...state.metrics,
        ...partial,
      },
    }));
  },

  toggleTelemetry: () => {
    set((state) => ({
      showTelemetry: !state.showTelemetry,
    }));
  },
}));

