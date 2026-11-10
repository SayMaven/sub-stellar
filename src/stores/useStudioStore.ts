import { create } from 'zustand';
import type {
  AspectRatio,
  CanvasResolutionPreset,
  StudioTab,
  SubtitleLine,
  SubtitleStyle,
  TrackMetadata,
  ProjectStatus,
  RubyToken,
  SubStellarProjectFile,
} from '../types';
import { tokenizeSubtitleText } from '../engine/text/RubyLayout';
import { cacheActiveMediaFile, clearCachedMediaFile } from '../services/mediaCache';
import { tauriBridge } from '../services/tauriBridge';

export const AUTOSAVE_STORAGE_KEY = 'substellar:project-autosave:v1';

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: 'Segoe UI, Noto Sans JP, sans-serif',
  fontSize: 52,
  fillColor: '#ffffff',
  fillGradientEnabled: true,
  fillGradientEndColor: '#b8d0ff',
  outerStrokeColor: '#14161b',
  outerStrokeWidth: 8,
  innerStrokeColor: '#8fb4ff',
  innerStrokeWidth: 2,
  glowColor: '#5770b0',
  glowBlur: 12,
  rubyFillColor: '#8fb4ff',
  rubyActiveColor: '#5affb5',
  translationFillColor: '#bfc3ca',
  verticalPosition: 'bottom',
  xOffset: 0,
  yOffset: 60,
  rubyScale: 0.45,
  showSafeGuides: true,
  particlePreset: 'stardust',
  particleBurstCount: 15,
  particleEnabled: true,
  wordTransitionMs: 140,
  wordAnimStyle: 'pop',
  wordActiveColor: '#7df9ff',
};

export const SAMPLE_SUBTITLES: SubtitleLine[] = [
  {
    id: 'line-1',
    startTime: 12.0,
    endTime: 16.5,
    text: 'もう{何|なに}もいらない',
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
    text: 'あぁ{待|ま}ち{遠|とお}しいな',
    translation: 'Ah, I can hardly wait',
    tokens: [
      { text: 'あぁ', startTime: 17.0, endTime: 17.9 },
      { text: '待', ruby: 'ま', startTime: 17.9, endTime: 18.8 },
      { text: 'ち', startTime: 18.8, endTime: 19.4 },
      { text: '遠', ruby: 'とお', startTime: 19.4, endTime: 20.5 },
      { text: 'しいな', startTime: 20.5, endTime: 21.8 },
    ],
  },
  {
    id: 'line-3',
    startTime: 22.2,
    endTime: 27.0,
    text: '{星|ほし}{空|ぞら}の{下|した}で{歌|うた}おう',
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

function roundTime(t: number): number {
  return Math.round(t * 100) / 100;
}

function buildEvenTokens(text: string, startTime: number, endTime: number): RubyToken[] {
  if (!text || text.trim().length === 0) {
    return [];
  }
  const parsed = tokenizeSubtitleText(text);
  if (parsed.length === 0) {
    return [];
  }
  const count = parsed.length;
  const step = Math.max(0.05, endTime - startTime) / count;
  return parsed.map((pt, idx) => ({
    text: pt.base,
    ruby: pt.ruby,
    startTime: roundTime(startTime + idx * step),
    endTime: roundTime(idx === count - 1 ? endTime : startTime + (idx + 1) * step),
  }));
}

interface StudioStoreState {
  activeTab: StudioTab;
  aspectRatio: AspectRatio;
  canvasResolution: CanvasResolutionPreset;
  zoom: number;
  sidebarCollapsed: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLooping: boolean;
  status: ProjectStatus;
  errorMessage: string | null;
  projectFilePath: string | null;
  track: TrackMetadata;
  lines: SubtitleLine[];
  selectedLineId: string | null;
  style: SubtitleStyle;

  setActiveTab: (tab: StudioTab) => void;
  setProjectFilePath: (path: string | null) => void;
  setAspectRatio: (aspect: AspectRatio) => void;
  setCanvasResolution: (res: CanvasResolutionPreset) => void;
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
  setStyle: (partial: Partial<SubtitleStyle>) => void;
  setLines: (lines: SubtitleLine[]) => void;
  setTrack: (track: Partial<TrackMetadata>) => void;
  importLyrics: (lines: SubtitleLine[], trackMetadata?: Partial<TrackMetadata>) => void;
  addLine: (atTime?: number) => SubtitleLine;
  duplicateLine: (id: string) => SubtitleLine | null;
  deleteLine: (id: string) => void;
  updateLineText: (id: string, text: string) => void;
  updateLineTranslation: (id: string, translation: string) => void;
  updateLineTiming: (id: string, startTime: number, endTime: number) => void;
  updateTokenTiming: (lineId: string, tokenIndex: number, startTime: number, endTime: number) => void;
  resetTokenTimingsEvenly: (lineId: string) => void;
  splitTokenIntoChars: (lineId: string, tokenIndex: number) => void;
  splitAllTokensIntoChars: (lineId: string) => void;
  mergeTokenWithNeighbor: (lineId: string, tokenIndex: number, direction: 'prev' | 'next') => void;
  toggleTokenAnimDisabled: (lineId: string, tokenIndex: number) => void;
  setAllTokensAnimDisabled: (lineId: string, disabled: boolean) => void;
  resolveOverlappingLines: () => number;
  setTokensForLine: (lineId: string, tokens: RubyToken[], serializedText?: string) => void;
  exportProjectJson: () => string;
  importProjectJson: (jsonString: string) => void;
  saveToLocalStorage: () => void;
  loadSampleTrack: () => void;
  loadLocalMedia: (file: File) => void;
  loadLocalMediaFromPath: (filePath: string) => Promise<void>;
  clearProject: () => void;
  setErrorMessage: (msg: string | null) => void;
}

export const useStudioStore = create<StudioStoreState>((set, get) => ({
  activeTab: 'studio',
  aspectRatio: '16:9',
  canvasResolution: '1080p',
  zoom: 100,
  sidebarCollapsed: true,
  isPlaying: false,
  currentTime: 13.2,
  duration: 185.0,
  volume: 0.8,
  isMuted: false,
  isLooping: false,
  status: 'ready',
  errorMessage: null,
  projectFilePath: null,
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
  style: DEFAULT_SUBTITLE_STYLE,

  setActiveTab: (tab: StudioTab) => set({ activeTab: tab }),
  setProjectFilePath: (path: string | null) => set({ projectFilePath: path }),
  setAspectRatio: (aspect: AspectRatio) => set({ aspectRatio: aspect }),
  setCanvasResolution: (res: CanvasResolutionPreset) => set({ canvasResolution: res }),
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

  setStyle: (partial: Partial<SubtitleStyle>) =>
    set((state) => ({ style: { ...state.style, ...partial } })),

  setLines: (lines: SubtitleLine[]) =>
    set({
      lines,
      selectedLineId: lines[0]?.id || null,
      status: lines.length > 0 ? 'ready' : 'idle',
    }),

  setTrack: (trackData: Partial<TrackMetadata>) =>
    set((state) => ({
      track: { ...state.track, ...trackData },
      duration: trackData.duration ?? state.duration,
    })),

  importLyrics: (lines: SubtitleLine[], trackMetadata?: Partial<TrackMetadata>) => {
    const { track, duration } = get();
    const updatedTrack = trackMetadata ? { ...track, ...trackMetadata } : track;
    const normalizedLines = lines.map((l) => {
      if (l.tokens.length <= 1 && tokenizeSubtitleText(l.text).length > 1) {
        return {
          ...l,
          tokens: buildEvenTokens(l.text, l.startTime, l.endTime),
        };
      }
      return l;
    });
    const newDuration =
      trackMetadata?.duration ??
      (normalizedLines.length > 0
        ? Math.max(duration, normalizedLines[normalizedLines.length - 1].endTime + 2.0)
        : duration);

    set({
      lines: normalizedLines,
      track: updatedTrack,
      duration: newDuration,
      selectedLineId: normalizedLines[0]?.id || null,
      currentTime: normalizedLines[0]?.startTime ?? 0,
      status: 'ready',
      errorMessage: null,
    });
  },

  addLine: (atTime?: number) => {
    const { lines, currentTime, duration } = get();
    const start = roundTime(Math.max(0, atTime ?? currentTime));
    const end = roundTime(Math.max(start + 0.5, Math.min(duration || 180, start + 3.0)));
    const newId = `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newLine: SubtitleLine = {
      id: newId,
      startTime: start,
      endTime: end,
      text: '',
      translation: '',
      tokens: [],
    };
    const nextLines = [...lines, newLine].sort((a, b) => a.startTime - b.startTime);
    set({
      lines: nextLines,
      selectedLineId: newId,
      status: 'ready',
    });
    return newLine;
  },

  duplicateLine: (id: string) => {
    const { lines, duration } = get();
    const source = lines.find((l) => l.id === id);
    if (!source) return null;
    const len = Math.max(0.5, source.endTime - source.startTime);
    const newStart = roundTime(source.endTime + 0.1);
    const newEnd = roundTime(Math.min(Math.max(duration, newStart + len), newStart + len));
    const delta = newStart - source.startTime;
    const newId = `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const cloned: SubtitleLine = {
      ...source,
      id: newId,
      startTime: newStart,
      endTime: newEnd,
      tokens: source.tokens.map((t) => ({
        ...t,
        startTime: roundTime(t.startTime + delta),
        endTime: roundTime(t.endTime + delta),
      })),
    };
    const nextLines = [...lines, cloned].sort((a, b) => a.startTime - b.startTime);
    set({
      lines: nextLines,
      selectedLineId: newId,
      status: 'ready',
    });
    return cloned;
  },

  deleteLine: (id: string) => {
    const { lines, selectedLineId } = get();
    const idx = lines.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const nextLines = lines.filter((l) => l.id !== id);
    let nextSelected = selectedLineId;
    if (selectedLineId === id) {
      nextSelected = nextLines[Math.min(idx, nextLines.length - 1)]?.id ?? null;
    }
    set({
      lines: nextLines,
      selectedLineId: nextSelected,
      status: nextLines.length > 0 ? 'ready' : 'idle',
    });
  },

  updateLineText: (id: string, text: string) => {
    const { lines } = get();
    const parsedTokens = tokenizeSubtitleText(text);

    const updated = lines.map((l) => {
      if (l.id !== id) return l;

      // Preserve existing per-token timing ratios when token count matches
      if (l.tokens.length === parsedTokens.length && parsedTokens.length > 0) {
        return {
          ...l,
          text,
          tokens: parsedTokens.map((pt, idx) => ({
            text: pt.base,
            ruby: pt.ruby,
            startTime: l.tokens[idx].startTime,
            endTime: l.tokens[idx].endTime,
          })),
        };
      }

      return {
        ...l,
        text,
        tokens: buildEvenTokens(text, l.startTime, l.endTime),
      };
    });

    set({ lines: updated });
  },

  updateLineTranslation: (id: string, translation: string) => {
    const { lines } = get();
    set({
      lines: lines.map((l) => (l.id === id ? { ...l, translation } : l)),
    });
  },

  updateLineTiming: (id: string, startTime: number, endTime: number) => {
    const { lines } = get();
    const safeStart = roundTime(Math.max(0, startTime));
    const safeEnd = roundTime(Math.max(safeStart + 0.1, endTime));

    const updated = lines.map((l) => {
      if (l.id !== id) return l;
      const oldSpan = Math.max(0.05, l.endTime - l.startTime);
      const newSpan = Math.max(0.05, safeEnd - safeStart);

      const scaledTokens: RubyToken[] = l.tokens.map((tok, i) => {
        const relStart = (tok.startTime - l.startTime) / oldSpan;
        const relEnd = (tok.endTime - l.startTime) / oldSpan;
        return {
          ...tok,
          startTime: i === 0 ? safeStart : roundTime(safeStart + relStart * newSpan),
          endTime:
            i === l.tokens.length - 1 ? safeEnd : roundTime(safeStart + relEnd * newSpan),
        };
      });

      return {
        ...l,
        startTime: safeStart,
        endTime: safeEnd,
        tokens: scaledTokens,
      };
    });
    set({ lines: updated });
  },

  updateTokenTiming: (lineId: string, tokenIndex: number, startTime: number, endTime: number) => {
    const { lines } = get();
    const updated = lines.map((l) => {
      if (l.id !== lineId) return l;
      if (tokenIndex < 0 || tokenIndex >= l.tokens.length) return l;

      const tokens = l.tokens.map((t) => ({ ...t }));
      const minDur = 0.05;

      const minStart = tokenIndex === 0 ? l.startTime : tokens[tokenIndex - 1].startTime + minDur;
      const maxEnd =
        tokenIndex === tokens.length - 1 ? l.endTime : tokens[tokenIndex + 1].endTime - minDur;

      const clampedStart = roundTime(
        Math.max(minStart, Math.min(startTime, maxEnd - minDur))
      );
      const clampedEnd = roundTime(
        Math.max(clampedStart + minDur, Math.min(endTime, maxEnd))
      );

      tokens[tokenIndex].startTime = clampedStart;
      tokens[tokenIndex].endTime = clampedEnd;

      // Keep contiguous boundaries with neighboring tokens so there are no gaps/overlaps
      if (tokenIndex > 0) {
        tokens[tokenIndex - 1].endTime = clampedStart;
      }
      if (tokenIndex < tokens.length - 1) {
        tokens[tokenIndex + 1].startTime = clampedEnd;
      }

      const newLineStart = tokens[0].startTime;
      const newLineEnd = tokens[tokens.length - 1].endTime;

      return {
        ...l,
        startTime: newLineStart,
        endTime: newLineEnd,
        tokens,
      };
    });

    set({ lines: updated });
  },

  resetTokenTimingsEvenly: (lineId: string) => {
    const { lines } = get();
    set({
      lines: lines.map((l) =>
        l.id === lineId
          ? { ...l, tokens: buildEvenTokens(l.text, l.startTime, l.endTime) }
          : l
      ),
    });
  },

  splitTokenIntoChars: (lineId: string, tokenIndex: number) => {
    const { lines } = get();
    set({
      lines: lines.map((l) => {
        if (l.id !== lineId) return l;
        if (tokenIndex < 0 || tokenIndex >= l.tokens.length) return l;

        const target = l.tokens[tokenIndex];
        const chars = Array.from(target.text).filter((ch) => ch.trim().length > 0);
        if (chars.length <= 1) return l;

        const span = Math.max(0.05 * chars.length, target.endTime - target.startTime);
        const step = span / chars.length;
        const rubyChars = target.ruby ? Array.from(target.ruby) : [];
        const splitRubyEvenly = rubyChars.length === chars.length;

        const replacement: RubyToken[] = chars.map((ch, idx) => ({
          text: ch,
          ruby: splitRubyEvenly ? rubyChars[idx] : idx === 0 ? target.ruby : undefined,
          startTime: idx === 0 ? target.startTime : roundTime(target.startTime + idx * step),
          endTime:
            idx === chars.length - 1
              ? target.endTime
              : roundTime(target.startTime + (idx + 1) * step),
          disableAnim: target.disableAnim,
        }));

        const nextTokens = [
          ...l.tokens.slice(0, tokenIndex),
          ...replacement,
          ...l.tokens.slice(tokenIndex + 1),
        ];

        return {
          ...l,
          tokens: nextTokens,
        };
      }),
    });
  },

  splitAllTokensIntoChars: (lineId: string) => {
    const { lines } = get();
    set({
      lines: lines.map((l) => {
        if (l.id !== lineId) return l;
        const nextTokens: RubyToken[] = [];

        for (const tok of l.tokens) {
          const chars = Array.from(tok.text).filter((ch) => ch.trim().length > 0);
          if (chars.length <= 1) {
            nextTokens.push({ ...tok });
            continue;
          }
          const span = Math.max(0.05 * chars.length, tok.endTime - tok.startTime);
          const step = span / chars.length;
          const rubyChars = tok.ruby ? Array.from(tok.ruby) : [];
          const splitRubyEvenly = rubyChars.length === chars.length;

          chars.forEach((ch, idx) => {
            nextTokens.push({
              text: ch,
              ruby: splitRubyEvenly ? rubyChars[idx] : idx === 0 ? tok.ruby : undefined,
              startTime: idx === 0 ? tok.startTime : roundTime(tok.startTime + idx * step),
              endTime:
                idx === chars.length - 1
                  ? tok.endTime
                  : roundTime(tok.startTime + (idx + 1) * step),
              disableAnim: tok.disableAnim,
            });
          });
        }

        return {
          ...l,
          tokens: nextTokens,
        };
      }),
    });
  },

  mergeTokenWithNeighbor: (lineId: string, tokenIndex: number, direction: 'prev' | 'next') => {
    const { lines } = get();
    set({
      lines: lines.map((l) => {
        if (l.id !== lineId) return l;
        const firstIdx = direction === 'prev' ? tokenIndex - 1 : tokenIndex;
        const secondIdx = direction === 'prev' ? tokenIndex : tokenIndex + 1;
        if (firstIdx < 0 || secondIdx >= l.tokens.length) return l;

        const first = l.tokens[firstIdx];
        const second = l.tokens[secondIdx];

        const bothLatinWords =
          /^[a-zA-Z0-9]+$/.test(first.text) && /^[a-zA-Z0-9]+$/.test(second.text);
        const joinedText = bothLatinWords && l.text.includes(`${first.text} ${second.text}`)
          ? `${first.text} ${second.text}`
          : `${first.text}${second.text}`;
        const joinedRuby =
          first.ruby || second.ruby ? `${first.ruby || ''}${second.ruby || ''}` : undefined;

        const merged: RubyToken = {
          text: joinedText,
          ruby: joinedRuby,
          startTime: first.startTime,
          endTime: second.endTime,
          disableAnim: Boolean(first.disableAnim && second.disableAnim),
        };

        const nextTokens = [
          ...l.tokens.slice(0, firstIdx),
          merged,
          ...l.tokens.slice(secondIdx + 1),
        ];

        return {
          ...l,
          tokens: nextTokens,
        };
      }),
    });
  },

  toggleTokenAnimDisabled: (lineId: string, tokenIndex: number) => {
    const { lines } = get();
    set({
      lines: lines.map((l) => {
        if (l.id !== lineId) return l;
        if (tokenIndex < 0 || tokenIndex >= l.tokens.length) return l;
        const nextTokens = l.tokens.map((t, idx) =>
          idx === tokenIndex ? { ...t, disableAnim: !t.disableAnim } : t
        );
        return { ...l, tokens: nextTokens };
      }),
    });
  },

  setAllTokensAnimDisabled: (lineId: string, disabled: boolean) => {
    const { lines } = get();
    set({
      lines: lines.map((l) =>
        l.id === lineId
          ? {
              ...l,
              tokens: l.tokens.map((t) => ({ ...t, disableAnim: disabled })),
            }
          : l
      ),
    });
  },

  resolveOverlappingLines: () => {
    const { lines } = get();
    if (lines.length <= 1) return 0;

    const sorted = [...lines].sort((a, b) => a.startTime - b.startTime);
    let fixedCount = 0;

    const resolved = sorted.map((line, idx) => {
      const next = sorted[idx + 1];
      if (!next) return line;
      if (line.endTime <= next.startTime) return line;

      fixedCount++;
      const clampedEnd = roundTime(Math.max(line.startTime + 0.15, next.startTime - 0.02));
      const oldSpan = Math.max(0.05, line.endTime - line.startTime);
      const newSpan = Math.max(0.05, clampedEnd - line.startTime);

      const scaledTokens: RubyToken[] = line.tokens.map((tok, i) => {
        const relStart = (tok.startTime - line.startTime) / oldSpan;
        const relEnd = (tok.endTime - line.startTime) / oldSpan;
        return {
          ...tok,
          startTime: i === 0 ? line.startTime : roundTime(line.startTime + relStart * newSpan),
          endTime:
            i === line.tokens.length - 1
              ? clampedEnd
              : roundTime(line.startTime + relEnd * newSpan),
        };
      });

      return {
        ...line,
        endTime: clampedEnd,
        tokens: scaledTokens,
      };
    });

    if (fixedCount > 0) {
      set({ lines: resolved });
    }
    return fixedCount;
  },

  setTokensForLine: (lineId: string, tokens: RubyToken[], serializedText?: string) => {
    const { lines } = get();
    set({
      lines: lines.map((l) => {
        if (l.id !== lineId) return l;
        const startTime = tokens[0]?.startTime ?? l.startTime;
        const endTime = tokens[tokens.length - 1]?.endTime ?? l.endTime;
        return {
          ...l,
          text: serializedText ?? l.text,
          startTime,
          endTime,
          tokens,
        };
      }),
    });
  },

  exportProjectJson: () => {
    const state = get();
    const payload: SubStellarProjectFile = {
      version: '1.0.0-alpha.8',
      savedAt: new Date().toISOString(),
      aspectRatio: state.aspectRatio,
      canvasResolution: state.canvasResolution,
      track: state.track,
      style: state.style,
      lines: state.lines,
    };
    return JSON.stringify(payload, null, 2);
  },

  importProjectJson: (jsonString: string) => {
    const parsed = JSON.parse(jsonString) as Partial<SubStellarProjectFile>;
    if (!parsed || !Array.isArray(parsed.lines)) {
      throw new Error('Invalid SubStellar project file: missing subtitle lines array.');
    }
    const nextLines: SubtitleLine[] = parsed.lines.map((l, idx) => {
      const startTime = typeof l.startTime === 'number' ? l.startTime : idx * 4;
      const endTime = typeof l.endTime === 'number' ? l.endTime : startTime + 3;
      const text = typeof l.text === 'string' ? l.text : '';
      const tokens =
        Array.isArray(l.tokens) &&
        (l.tokens.length > 1 ||
          (l.tokens.length === 1 && tokenizeSubtitleText(text).length <= 1))
          ? l.tokens
          : buildEvenTokens(text, startTime, endTime);
      return {
        id: l.id || `line-${idx + 1}`,
        startTime,
        endTime,
        text,
        translation: l.translation || '',
        tokens,
      };
    });

    const nextStyle: SubtitleStyle = {
      ...DEFAULT_SUBTITLE_STYLE,
      ...(parsed.style || {}),
    };

    const nextTrack: TrackMetadata = {
      id: parsed.track?.id || `proj-${Date.now()}`,
      title: parsed.track?.title || 'Imported Project',
      artist: parsed.track?.artist || 'Unknown Artist',
      duration:
        parsed.track?.duration ||
        (nextLines.length > 0 ? nextLines[nextLines.length - 1].endTime + 2 : 180),
      bpm: parsed.track?.bpm,
      coverUrl: parsed.track?.coverUrl,
      audioUrl: parsed.track?.audioUrl,
      videoUrl: parsed.track?.videoUrl,
      mediaFilePath: parsed.track?.mediaFilePath,
    };

    const hasMedia = Boolean(nextTrack.videoUrl || nextTrack.audioUrl || nextTrack.mediaFilePath);

    set({
      aspectRatio: parsed.aspectRatio || '16:9',
      canvasResolution: parsed.canvasResolution || '1080p',
      track: nextTrack,
      duration: nextTrack.duration,
      style: nextStyle,
      lines: nextLines,
      selectedLineId: nextLines[0]?.id || null,
      currentTime: nextLines[0]?.startTime ?? 0,
      status: nextLines.length > 0 || hasMedia ? 'ready' : 'idle',
      errorMessage: null,
    });
  },

  saveToLocalStorage: () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUTOSAVE_STORAGE_KEY, get().exportProjectJson());
      }
    } catch {
      // Ignore quota errors
    }
  },

  loadSampleTrack: () => {
    void clearCachedMediaFile();
    set({
      status: 'ready',
      errorMessage: null,
      projectFilePath: null,
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
      style: DEFAULT_SUBTITLE_STYLE,
    });
  },

  loadLocalMedia: (file: File) => {
    const prevTrack = get().track;
    if (prevTrack.videoUrl?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(prevTrack.videoUrl);
      } catch {
        // Ignore
      }
    }
    if (prevTrack.audioUrl?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(prevTrack.audioUrl);
      } catch {
        // Ignore
      }
    }

    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mkv|mov)$/i.test(file.name);
    const url = URL.createObjectURL(file);
    const nativePath = (file as File & { path?: string }).path;

    // Only cache in IndexedDB when no native file path is available (and capped at 50 MB)
    if (!nativePath) {
      void cacheActiveMediaFile(file, isVideo);
    }

    if (typeof document !== 'undefined') {
      const media = document.createElement(isVideo ? 'video' : 'audio');
      media.src = url;
      media.preload = 'metadata';

      const cleanupProbe = () => {
        media.onloadedmetadata = null;
        media.onerror = null;
        media.removeAttribute('src');
        media.load();
      };

      media.onloadedmetadata = () => {
        const duration = media.duration && !isNaN(media.duration) ? media.duration : 180;
        cleanupProbe();
        set({
          track: {
            id: `local-${Date.now()}`,
            title: file.name.replace(/\.[^/.]+$/, ''),
            artist: 'Local Media',
            duration,
            videoUrl: isVideo ? url : undefined,
            audioUrl: !isVideo ? url : undefined,
            mediaFilePath: nativePath,
          },
          duration,
          currentTime: 0,
          status: 'ready',
          errorMessage: null,
        });
      };

      media.onerror = () => {
        cleanupProbe();
        set({
          track: {
            id: `local-${Date.now()}`,
            title: file.name.replace(/\.[^/.]+$/, ''),
            artist: 'Local Media',
            duration: 180,
            videoUrl: isVideo ? url : undefined,
            audioUrl: !isVideo ? url : undefined,
            mediaFilePath: nativePath,
          },
          duration: 180,
          currentTime: 0,
          status: 'ready',
          errorMessage: null,
        });
      };
    }
  },

  loadLocalMediaFromPath: async (filePath: string) => {
    const prevTrack = get().track;
    if (prevTrack.videoUrl?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(prevTrack.videoUrl);
      } catch {
        // Ignore
      }
    }
    if (prevTrack.audioUrl?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(prevTrack.audioUrl);
      } catch {
        // Ignore
      }
    }

    const isVideo = /\.(mp4|webm|mkv|mov)$/i.test(filePath);
    const playableUrl = await tauriBridge.toPlayableUrl(filePath);
    const filename = filePath.split(/[/\\]/).pop() || 'Local Media';
    const title = filename.replace(/\.[^/.]+$/, '');

    if (typeof document !== 'undefined') {
      const media = document.createElement(isVideo ? 'video' : 'audio');
      media.src = playableUrl;
      media.preload = 'metadata';

      const cleanupProbe = () => {
        media.onloadedmetadata = null;
        media.onerror = null;
        media.removeAttribute('src');
        media.load();
      };

      media.onloadedmetadata = () => {
        const duration = media.duration && !isNaN(media.duration) ? media.duration : 180;
        cleanupProbe();
        set({
          track: {
            id: `local-${Date.now()}`,
            title,
            artist: 'Local Media',
            duration,
            videoUrl: isVideo ? playableUrl : undefined,
            audioUrl: !isVideo ? playableUrl : undefined,
            mediaFilePath: filePath,
          },
          duration,
          currentTime: 0,
          status: 'ready',
          errorMessage: null,
        });
      };

      media.onerror = () => {
        cleanupProbe();
        set({
          track: {
            id: `local-${Date.now()}`,
            title,
            artist: 'Local Media',
            duration: 180,
            videoUrl: isVideo ? playableUrl : undefined,
            audioUrl: !isVideo ? playableUrl : undefined,
            mediaFilePath: filePath,
          },
          duration: 180,
          currentTime: 0,
          status: 'ready',
          errorMessage: null,
        });
      };
    }
  },

  clearProject: () => {
    const prevTrack = get().track;
    if (prevTrack.videoUrl?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(prevTrack.videoUrl);
      } catch {
        // Ignore
      }
    }
    if (prevTrack.audioUrl?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(prevTrack.audioUrl);
      } catch {
        // Ignore
      }
    }
    void clearCachedMediaFile();
    set({
      status: 'idle',
      errorMessage: null,
      projectFilePath: null,
      track: {
        id: '',
        title: 'Untitled Project',
        artist: 'Unknown Artist',
        duration: 0,
      },
      lines: [],
      currentTime: 0,
      selectedLineId: null,
      isPlaying: false,
    });
  },

  setErrorMessage: (msg: string | null) => {
    set({
      errorMessage: msg,
      status: msg ? 'error' : get().lines.length > 0 ? 'ready' : 'idle',
    });
  },
}));
