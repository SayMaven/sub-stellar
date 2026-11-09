import { describe, it, expect, beforeEach } from 'vitest';
import { useStudioStore, SAMPLE_SUBTITLES, DEFAULT_SUBTITLE_STYLE } from '../stores/useStudioStore';

describe('useStudioStore', () => {
  beforeEach(() => {
    useStudioStore.setState({
      activeTab: 'studio',
      aspectRatio: '16:9',
      zoom: 100,
      sidebarCollapsed: false,
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
      lines: SAMPLE_SUBTITLES,
      selectedLineId: 'line-1',
      style: DEFAULT_SUBTITLE_STYLE,
    });
  });

  it('initializes with sample track and furigana lines', () => {
    const state = useStudioStore.getState();
    expect(state.activeTab).toBe('studio');
    expect(state.track.title).toBe('Stellar Night Flight');
    expect(state.lines.length).toBeGreaterThan(0);
    expect(state.lines[0].text).toBe('もう{何|なに}もいらない');
    expect(state.lines[0].tokens[1].ruby).toBe('なに');
  });

  it('controls playback play and pause', () => {
    const { play, pause, togglePlay } = useStudioStore.getState();

    play();
    expect(useStudioStore.getState().isPlaying).toBe(true);

    pause();
    expect(useStudioStore.getState().isPlaying).toBe(false);

    togglePlay();
    expect(useStudioStore.getState().isPlaying).toBe(true);
  });

  it('clamps seek time between 0 and duration', () => {
    const { seek } = useStudioStore.getState();

    seek(50.0);
    expect(useStudioStore.getState().currentTime).toBe(50.0);

    seek(-10.0);
    expect(useStudioStore.getState().currentTime).toBe(0.0);

    seek(500.0);
    expect(useStudioStore.getState().currentTime).toBe(185.0);
  });

  it('controls volume and muting', () => {
    const { setVolume, toggleMute } = useStudioStore.getState();

    setVolume(0.5);
    expect(useStudioStore.getState().volume).toBe(0.5);
    expect(useStudioStore.getState().isMuted).toBe(false);

    toggleMute();
    expect(useStudioStore.getState().isMuted).toBe(true);

    toggleMute();
    expect(useStudioStore.getState().isMuted).toBe(false);
  });

  it('switches aspect ratio and clamps zoom', () => {
    const { setAspectRatio, setZoom } = useStudioStore.getState();

    setAspectRatio('9:16');
    expect(useStudioStore.getState().aspectRatio).toBe('9:16');

    setZoom(150);
    expect(useStudioStore.getState().zoom).toBe(150);

    setZoom(300); // Should clamp to max 200
    expect(useStudioStore.getState().zoom).toBe(200);

    setZoom(10); // Should clamp to min 50
    expect(useStudioStore.getState().zoom).toBe(50);
  });

  it('toggles sidebar collapse', () => {
    const { toggleSidebar } = useStudioStore.getState();
    expect(useStudioStore.getState().sidebarCollapsed).toBe(false);

    toggleSidebar();
    expect(useStudioStore.getState().sidebarCollapsed).toBe(true);
  });

  it('updates line text and re-parses ruby tokens', () => {
    const { updateLineText } = useStudioStore.getState();
    updateLineText('line-1', '夢を{見|み}よう');

    const updated = useStudioStore.getState().lines.find((l) => l.id === 'line-1');
    expect(updated).toBeDefined();
    expect(updated?.text).toBe('夢を{見|み}よう');
    expect(updated?.tokens.some((t) => t.ruby === 'み')).toBe(true);
  });

  it('updates line timing correctly', () => {
    const { updateLineTiming } = useStudioStore.getState();
    updateLineTiming('line-1', 10.0, 15.0);

    const updated = useStudioStore.getState().lines.find((l) => l.id === 'line-1');
    expect(updated?.startTime).toBe(10.0);
    expect(updated?.endTime).toBe(15.0);
  });

  it('clears project to empty state and restores sample', () => {
    const { clearProject, loadSampleTrack } = useStudioStore.getState();

    clearProject();
    expect(useStudioStore.getState().status).toBe('idle');
    expect(useStudioStore.getState().lines.length).toBe(0);

    loadSampleTrack();
    expect(useStudioStore.getState().status).toBe('ready');
    expect(useStudioStore.getState().lines.length).toBeGreaterThan(0);
  });
});
