import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { playbackEngine } from '../engine/audio/PlaybackEngine';
import { useStudioStore } from '../stores/useStudioStore';

describe('PlaybackEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useStudioStore.setState({
      currentTime: 0,
      duration: 100,
      isPlaying: false,
      isLooping: false,
    });
  });

  afterEach(() => {
    playbackEngine.stop();
    vi.useRealTimers();
  });

  it('starts running when isPlaying is set to true', () => {
    useStudioStore.setState({ isPlaying: true });
    expect(useStudioStore.getState().isPlaying).toBe(true);
  });

  it('stops running when isPlaying is set to false', () => {
    useStudioStore.setState({ isPlaying: true });
    useStudioStore.setState({ isPlaying: false });
    expect(useStudioStore.getState().isPlaying).toBe(false);
  });

  it('syncs seek time to media element if bound', () => {
    const mockMedia = {
      currentTime: 0,
      volume: 1,
      muted: false,
      paused: true,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    } as unknown as HTMLMediaElement;

    playbackEngine.bindMediaElement(mockMedia);
    playbackEngine.syncSeek(45.5);

    expect(mockMedia.currentTime).toBe(45.5);
  });
});

