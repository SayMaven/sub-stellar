import { describe, it, expect, beforeEach } from 'vitest';
import {
  useStudioStore,
  SAMPLE_SUBTITLES,
  DEFAULT_SUBTITLE_STYLE,
} from '../stores/useStudioStore';
import { getCanvasPixelDimensions } from '../engine/layout/layoutMath';
import { generateAss, generateSrt } from '../engine/text/SubtitleExporter';

describe('Phase 8: Canvas Resolution, Project Save/Load, Line CRUD & Per-Word Vocal Timing', () => {
  beforeEach(() => {
    useStudioStore.setState({
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
      track: {
        id: 'sample-track-1',
        title: 'Stellar Night Flight',
        artist: 'Luna feat. Hatsune Miku',
        duration: 185.0,
        bpm: 134,
      },
      lines: structuredClone(SAMPLE_SUBTITLES),
      selectedLineId: 'line-1',
      style: { ...DEFAULT_SUBTITLE_STYLE },
    });
  });

  it('computes accurate pixel dimensions for all aspect ratios and resolutions', () => {
    expect(getCanvasPixelDimensions('16:9', '720p')).toEqual({ width: 1280, height: 720 });
    expect(getCanvasPixelDimensions('16:9', '1080p')).toEqual({ width: 1920, height: 1080 });
    expect(getCanvasPixelDimensions('16:9', '1440p')).toEqual({ width: 2560, height: 1440 });
    expect(getCanvasPixelDimensions('16:9', '4k')).toEqual({ width: 3840, height: 2160 });

    expect(getCanvasPixelDimensions('9:16', '1080p')).toEqual({ width: 1080, height: 1920 });
    expect(getCanvasPixelDimensions('1:1', '1080p')).toEqual({ width: 1080, height: 1080 });
    expect(getCanvasPixelDimensions('4:3', '1080p')).toEqual({ width: 1440, height: 1080 });
  });

  it('adds, duplicates, and deletes subtitle lines', () => {
    const store = useStudioStore.getState();
    const initialCount = store.lines.length;

    const created = store.addLine(30.0);
    expect(useStudioStore.getState().lines.length).toBe(initialCount + 1);
    expect(useStudioStore.getState().selectedLineId).toBe(created.id);
    expect(created.startTime).toBe(30.0);
    expect(created.endTime).toBe(33.0);
    expect(created.text).toBe('');
    expect(created.tokens.length).toBe(0);

    const dup = useStudioStore.getState().duplicateLine(created.id);
    expect(dup).not.toBeNull();
    expect(useStudioStore.getState().lines.length).toBe(initialCount + 2);
    expect(dup?.startTime).toBeCloseTo(33.1, 1);

    useStudioStore.getState().deleteLine(created.id);
    expect(useStudioStore.getState().lines.length).toBe(initialCount + 1);
    expect(useStudioStore.getState().lines.some((l) => l.id === created.id)).toBe(false);
  });

  it('edits secondary translation and exports it to .ass and .srt', () => {
    const { updateLineTranslation } = useStudioStore.getState();
    updateLineTranslation('line-1', 'Aku tidak butuh apa-apa lagi');

    const line1 = useStudioStore.getState().lines.find((l) => l.id === 'line-1')!;
    expect(line1.translation).toBe('Aku tidak butuh apa-apa lagi');

    const srt = generateSrt([line1]);
    expect(srt).toContain('もう何もいらない\nAku tidak butuh apa-apa lagi');

    const ass = generateAss([line1], useStudioStore.getState().style, undefined, {
      width: 2560,
      height: 1440,
    });
    expect(ass).toContain('PlayResX: 2560');
    expect(ass).toContain('PlayResY: 1440');
    expect(ass).toContain('Dialogue: 0,0:00:12.00,0:00:16.50,Translation,,0,0,0,,Aku tidak butuh apa-apa lagi');
  });

  it('updates individual word timing and keeps neighboring word boundaries contiguous', () => {
    const { updateTokenTiming } = useStudioStore.getState();
    // Line 1 tokens: [0]: 12.0-12.8, [1]: 12.8-13.9, [2]: 13.9-14.5, [3]: 14.5-16.5
    updateTokenTiming('line-1', 1, 12.6, 14.2);

    const line1 = useStudioStore.getState().lines.find((l) => l.id === 'line-1')!;
    expect(line1.tokens[0].endTime).toBe(12.6);
    expect(line1.tokens[1].startTime).toBe(12.6);
    expect(line1.tokens[1].endTime).toBe(14.2);
    expect(line1.tokens[2].startTime).toBe(14.2);
  });

  it('preserves custom per-word timings when editing text with same token count', () => {
    const { updateLineText, updateTokenTiming } = useStudioStore.getState();
    // Set 3-word lyric (space-separated or ruby-separated)
    updateLineText('line-1', 'kamu dan aku');
    updateTokenTiming('line-1', 0, 12.0, 13.4);
    // Edit the first word while keeping 3 words
    updateLineText('line-1', 'dia dan aku');

    const line1 = useStudioStore.getState().lines.find((l) => l.id === 'line-1')!;
    expect(line1.tokens.length).toBe(3);
    expect(line1.tokens[0].text).toBe('dia');
    expect(line1.tokens[0].endTime).toBe(13.4);
  });

  it('serializes and restores full project JSON (.substellar)', () => {
    const store = useStudioStore.getState();
    store.setCanvasResolution('4k');
    store.setAspectRatio('9:16');
    store.setStyle({ wordTransitionMs: 260, wordAnimStyle: 'float' });
    store.updateLineTranslation('line-1', 'Custom translation');

    const json = useStudioStore.getState().exportProjectJson();
    useStudioStore.getState().clearProject();
    expect(useStudioStore.getState().lines.length).toBe(0);

    useStudioStore.getState().importProjectJson(json);
    const restored = useStudioStore.getState();
    expect(restored.canvasResolution).toBe('4k');
    expect(restored.aspectRatio).toBe('9:16');
    expect(restored.style.wordTransitionMs).toBe(260);
    expect(restored.style.wordAnimStyle).toBe('float');
    expect(restored.lines[0].translation).toBe('Custom translation');
  });

  it('resolves overlapping subtitle lines automatically via resolveOverlappingLines', () => {
    const store = useStudioStore.getState();
    // Force line-1 endTime (20.0s) to overlap past line-2 startTime (17.0s)
    store.updateLineTiming('line-1', 12.0, 20.0);
    const fixed = useStudioStore.getState().resolveOverlappingLines();
    expect(fixed).toBe(1);

    const lines = useStudioStore.getState().lines;
    expect(lines[0].endTime).toBeLessThanOrEqual(lines[1].startTime);
  });

  it('splits words into individual characters, merges neighboring tokens, and mutes per-word vocal animation', () => {
    const store = useStudioStore.getState();
    // Line 1 tokens: ['もう', '何', 'も', 'いらない']
    store.splitTokenIntoChars('line-1', 0);
    let line1 = useStudioStore.getState().lines.find((l) => l.id === 'line-1')!;
    expect(line1.tokens[0].text).toBe('も');
    expect(line1.tokens[1].text).toBe('う');
    expect(line1.tokens[0].startTime).toBe(12.0);
    expect(line1.tokens[1].endTime).toBe(12.8);

    // Merge 'も' and 'う' back together using merge right ('next')
    useStudioStore.getState().mergeTokenWithNeighbor('line-1', 0, 'next');
    line1 = useStudioStore.getState().lines.find((l) => l.id === 'line-1')!;
    expect(line1.tokens[0].text).toBe('もう');
    expect(line1.tokens[0].startTime).toBe(12.0);
    expect(line1.tokens[0].endTime).toBe(12.8);

    // Toggle per-word vocal animation disable
    useStudioStore.getState().toggleTokenAnimDisabled('line-1', 0);
    line1 = useStudioStore.getState().lines.find((l) => l.id === 'line-1')!;
    expect(line1.tokens[0].disableAnim).toBe(true);

    // Split entire line into characters
    useStudioStore.getState().splitAllTokensIntoChars('line-1');
    line1 = useStudioStore.getState().lines.find((l) => l.id === 'line-1')!;
    expect(line1.tokens.map((t) => t.text)).toEqual([
      'も',
      'う',
      '何',
      'も',
      'い',
      'ら',
      'な',
      'い',
    ]);

    // Mute entire line
    useStudioStore.getState().setAllTokensAnimDisabled('line-1', true);
    line1 = useStudioStore.getState().lines.find((l) => l.id === 'line-1')!;
    expect(line1.tokens.every((t) => t.disableAnim)).toBe(true);
  });

  it('reuses existing file handle on subsequent Ctrl+S saves without reopening Save As dialog', async () => {
    const { saveProjectToDisk, clearCachedProjectHandle } = await import('../services/mediaCache');
    await clearCachedProjectHandle();

    let pickerCallCount = 0;
    let writtenContents = '';
    const fakeHandle = {
      name: 'test1.substellar',
      createWritable: async () => ({
        write: async (data: string) => {
          writtenContents = data;
        },
        close: async () => {},
      }),
    };

    const g = globalThis as unknown as {
      window?: { showSaveFilePicker?: () => Promise<typeof fakeHandle> };
    };
    const prevWindow = g.window;
    g.window = {
      ...(prevWindow || {}),
      showSaveFilePicker: async () => {
        pickerCallCount++;
        return fakeHandle;
      },
    };

    try {
      // 1st save (no existingPath yet): opens Save As dialog once
      const first = await saveProjectToDisk({
        json: '{"step":1}',
        defaultFilename: 'test1.substellar',
        existingPath: null,
        forceSaveAs: false,
      });
      expect(first).toEqual({ saved: true, path: 'test1.substellar' });
      expect(pickerCallCount).toBe(1);
      expect(writtenContents).toBe('{"step":1}');

      // 2nd save (Ctrl+S with existingPath = 'test1.substellar', forceSaveAs = false):
      // writes directly to test1.substellar WITHOUT reopening the Save As dialog!
      const second = await saveProjectToDisk({
        json: '{"step":2}',
        defaultFilename: 'test1.substellar',
        existingPath: 'test1.substellar',
        forceSaveAs: false,
      });
      expect(second).toEqual({ saved: true, path: 'test1.substellar' });
      expect(pickerCallCount).toBe(1);
      expect(writtenContents).toBe('{"step":2}');

      // 3rd save (Ctrl+Shift+S with forceSaveAs = true): opens Save As dialog again
      const third = await saveProjectToDisk({
        json: '{"step":3}',
        defaultFilename: 'test1.substellar',
        existingPath: 'test1.substellar',
        forceSaveAs: true,
      });
      expect(third).toEqual({ saved: true, path: 'test1.substellar' });
      expect(pickerCallCount).toBe(2);
      expect(writtenContents).toBe('{"step":3}');
    } finally {
      g.window = prevWindow;
      await clearCachedProjectHandle();
    }
  });
});
