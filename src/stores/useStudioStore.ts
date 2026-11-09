import { create } from 'zustand';
import type { AspectRatio, StudioTab, SubtitleLine, TrackMetadata } from '../types';

export const SAMPLE_SUBTITLES: SubtitleLine[] = [
  {
    id: 'line-1',
    startTime: 12.0,
    endTime: 16.5,
    text: 'もう何もいらない',
    translation: 'I do not need anything anymore',
    tokens: [
      { text: 'もう', startTime: 12.0, endTime: 12.8 },
      { text: '何', ruby: 'なに', startTime: 12.8, endTime: 13.9 },
      { text: 'も', startTime: 13.9, endTime: 14.5 },
      { text: 'いらない', startTime: 14.5, endTime: 16.5 },
    ],
  },
  {
    id: 'line-2',
    startTime: 17.0,
    endTime: 21.8,
    text: 'あぁ待ち遠しいな',
    translation: 'Ah, I can hardly wait',
    tokens: [
      { text: 'あぁ', startTime: 17.0, endTime: 17.9 },
      { text: '待', ruby: 'ま', startTime: 17.9, endTime: 18.8 },
      { text: 'ち', startTime: 18.8, endTime: 19.4 },
      { text: '遠', ruby: 'どお', startTime: 19.4, endTime: 20.5 },
      { text: 'しいな', startTime: 20.5, endTime: 21.8 },
    ],
  },
  {
    id: 'line-3',
    startTime: 22.2,
    endTime: 27.0,
    text: '星空の下で歌おう',
    translation: 'Let us sing under the starry sky',
    tokens: [
      { text: '星', ruby: 'ほし', startTime: 22.2, endTime: 23.2 },
      { text: '空', ruby: 'ぞら', startTime: 23.2, endTime: 24.1 },
      { text: 'の', startTime: 24.1, endTime: 24.5 },
      { text: '下', ruby: 'した', startTime: 24.5, endTime: 25.4 },
      { text: 'で', startTime: 25.4, endTime: 25.8 },
      { text: '歌', ruby: 'うた', startTime: 25.8, endTime: 26.6 },
      { text: 'おう', startTime: 26.6, endTime: 27.0 },
    ],
  },
];

interface StudioStoreState {
  activeTab: StudioTab;
  aspectRatio: AspectRatio;
  zoom: number;
  sidebarCollapsed: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLooping: boolean;
  track: TrackMetadata;
  lines: SubtitleLine[];
  selectedLineId: string | null;

  setActiveTab: (tab: StudioTab) => void;
  setAspectRatio: (aspect: AspectRatio) => void;
  setZoom: (zoom: number) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  stepTime: (deltaSeconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleLoop: () => void;
  setSelectedLineId: (id: string | null) => void;
  loadSampleTrack: () => void;
}

export const useStudioStore = create<StudioStoreState>((set, get) => ({
  activeTab: 'studio',
  aspectRatio: '16:9',
  zoom: 100,
  sidebarCollapsed: false,
  isPlaying: false,
  currentTime: 13.2, // Preset to mid of line-1 for instant visual showcase
  duration: 185.0,
  volume: 0.8,
  isMuted: false,
  isLooping: false,
  track: {
    id: 'sample-track-1',
    title: 'Stellar Night Flight',
    artist: 'Luna feat. Hatsune Miku',
    duration: 185.0,
    bpm: 134,
    coverUrl: '',
  },
  lines: SAMPLE_SUBTITLES,
  selectedLineId: 'line-1',

  setActiveTab: (tab: StudioTab) => set({ activeTab: tab }),
  setAspectRatio: (aspect: AspectRatio) => set({ aspectRatio: aspect }),
  setZoom: (zoom: number) => set({ zoom: Math.min(200, Math.max(50, zoom)) }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  seek: (time: number) => {
    const { duration } = get();
    const clamped = Math.max(0, Math.min(duration, time));
    set({ currentTime: clamped });
  },

  stepTime: (deltaSeconds: number) => {
    const { currentTime, duration } = get();
    const next = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
    set({ currentTime: next });
  },

  setVolume: (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    set({ volume: clamped, isMuted: clamped === 0 });
  },

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleLoop: () => set((state) => ({ isLooping: !state.isLooping })),
  setSelectedLineId: (id: string | null) => set({ selectedLineId: id }),

  loadSampleTrack: () => {
    set({
      track: {
        id: 'sample-track-1',
        title: 'Stellar Night Flight',
        artist: 'Luna feat. Hatsune Miku',
        duration: 185.0,
        bpm: 134,
        coverUrl: '',
      },
      lines: SAMPLE_SUBTITLES,
      currentTime: 13.2,
      selectedLineId: 'line-1',
    });
  },
}));
