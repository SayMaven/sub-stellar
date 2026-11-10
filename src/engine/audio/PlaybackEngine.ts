import { useStudioStore } from '../../stores/useStudioStore';

function safeRequestAnimationFrame(callback: (timestamp: number) => void): number {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(performance.now()), 16) as unknown as number;
}

function safeCancelAnimationFrame(id: number): void {
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(id);
    return;
  }
  clearTimeout(id);
}

export class PlaybackEngine {
  private mediaElement: HTMLMediaElement | null = null;
  private rafId: number | null = null;
  private lastTimestamp: number = 0;
  private isRunning: boolean = false;

  constructor() {
    this.initStoreSubscriber();
  }

  private initStoreSubscriber(): void {
    // Listen to isPlaying state changes from useStudioStore
    useStudioStore.subscribe((state, prevState) => {
      if (state.isPlaying !== prevState.isPlaying) {
        if (state.isPlaying) {
          this.start();
        } else {
          this.stop();
        }
      }

      // Synchronize volume and mute
      if (this.mediaElement) {
        if (state.volume !== prevState.volume) {
          this.mediaElement.volume = state.volume;
        }
        if (state.isMuted !== prevState.isMuted) {
          this.mediaElement.muted = state.isMuted;
        }
      }

      // If user seeks while paused or dragging
      if (Math.abs(state.currentTime - prevState.currentTime) > 0.05 && !this.isRunning) {
        this.syncSeek(state.currentTime);
      }
    });
  }

  public bindMediaElement(el: HTMLMediaElement | null): void {
    this.mediaElement = el;
    if (this.mediaElement) {
      const { volume, isMuted, currentTime } = useStudioStore.getState();
      this.mediaElement.volume = volume;
      this.mediaElement.muted = isMuted;
      if (Math.abs(this.mediaElement.currentTime - currentTime) > 0.1) {
        this.mediaElement.currentTime = currentTime;
      }
    }
  }

  public syncSeek(time: number): void {
    if (this.mediaElement && Math.abs(this.mediaElement.currentTime - time) > 0.05) {
      try {
        this.mediaElement.currentTime = time;
      } catch {
        // Safe catch if media is not yet ready to seek
      }
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();

    if (this.mediaElement) {
      this.mediaElement.play().catch(() => {
        // Fallback to synthetic clock if audio play was blocked by browser autoplay policy
      });
    }

    const loop = (now: number) => {
      if (!this.isRunning) return;

      const deltaSeconds = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;

      const store = useStudioStore.getState();
      let nextTime = store.currentTime;

      if (this.mediaElement && !this.mediaElement.paused) {
        nextTime = this.mediaElement.currentTime;
      } else {
        nextTime += deltaSeconds;
      }

      if (nextTime >= store.duration && store.duration > 0) {
        if (store.isLooping) {
          nextTime = 0;
          if (this.mediaElement) this.mediaElement.currentTime = 0;
          useStudioStore.setState({ currentTime: 0 });
        } else {
          nextTime = store.duration;
          this.stop();
          useStudioStore.setState({ isPlaying: false, currentTime: store.duration });
          return;
        }
      } else {
        useStudioStore.setState({ currentTime: nextTime });
      }

      this.rafId = safeRequestAnimationFrame(loop);
    };

    this.rafId = safeRequestAnimationFrame(loop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      safeCancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.mediaElement && !this.mediaElement.paused) {
      try {
        this.mediaElement.pause();
      } catch {
        // Safe catch
      }
    }
  }

  public destroy(): void {
    this.stop();
    this.mediaElement = null;
  }
}

export const playbackEngine = new PlaybackEngine();
