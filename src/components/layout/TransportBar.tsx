import React, { useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis
    .toString()
    .padStart(2, '0')}`;
}

const TransportBarInner: React.FC = () => {
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const duration = useStudioStore((s) => s.duration);
  const volume = useStudioStore((s) => s.volume);
  const isMuted = useStudioStore((s) => s.isMuted);
  const isLooping = useStudioStore((s) => s.isLooping);
  const togglePlay = useStudioStore((s) => s.togglePlay);
  const seek = useStudioStore((s) => s.seek);
  const stepTime = useStudioStore((s) => s.stepTime);
  const setVolume = useStudioStore((s) => s.setVolume);
  const toggleMute = useStudioStore((s) => s.toggleMute);
  const toggleLoop = useStudioStore((s) => s.toggleLoop);

  const timeLabelRef = useRef<HTMLSpanElement>(null);
  const scrubberRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const syncTimeDom = (time: number, dur: number) => {
      if (timeLabelRef.current) {
        timeLabelRef.current.textContent = formatTime(time);
      }
      if (scrubberRef.current) {
        scrubberRef.current.value = String(time);
        const pct = dur > 0 ? Math.max(0, Math.min(100, (time / dur) * 100)) : 0;
        scrubberRef.current.style.background = `linear-gradient(to right, var(--accent) ${pct}%, var(--surface-2) ${pct}%)`;
      }
    };

    const initial = useStudioStore.getState();
    syncTimeDom(initial.currentTime, initial.duration);

    let lastTime = initial.currentTime;
    let lastDuration = initial.duration;
    const unsubscribe = useStudioStore.subscribe((state) => {
      if (state.currentTime !== lastTime || state.duration !== lastDuration) {
        lastTime = state.currentTime;
        lastDuration = state.duration;
        syncTimeDom(state.currentTime, state.duration);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const initialTime = useStudioStore.getState().currentTime;
  const progressPercent = duration > 0 ? (initialTime / duration) * 100 : 0;

  return (
    <div
      role="toolbar"
      aria-label="Transport"
      className="h-12 shrink-0 w-full px-3 border-y border-gatefold-line bg-gatefold-panel-strong flex items-center gap-3 select-none"
    >
      <div className="flex items-center gap-1">
        <button
          onClick={() => stepTime(-5)}
          title="Step back 5s"
          aria-label="Step back 5 seconds"
          className="text-gatefold-text-3 hover:text-gatefold-text p-1.5 rounded hover:bg-gatefold-hover"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={togglePlay}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-8 h-8 rounded-md bg-gatefold-accent text-gatefold-bg flex items-center justify-center hover:opacity-90 active:opacity-80"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        <button
          onClick={() => stepTime(5)}
          title="Step forward 5s"
          aria-label="Step forward 5 seconds"
          className="text-gatefold-text-3 hover:text-gatefold-text p-1.5 rounded hover:bg-gatefold-hover"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <button
          onClick={toggleLoop}
          title="Loop (L)"
          aria-label="Toggle loop"
          aria-pressed={isLooping}
          className={`p-1.5 rounded ${
            isLooping
              ? 'text-gatefold-accent bg-gatefold-accent/20'
              : 'text-gatefold-text-3 hover:text-gatefold-text hover:bg-gatefold-hover'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
        </button>
      </div>

      <span
        ref={timeLabelRef}
        className="text-[11px] font-mono text-gatefold-text-2 w-[52px] text-right tabular-nums"
      >
        {formatTime(initialTime)}
      </span>

      <input
        ref={scrubberRef}
        type="range"
        min={0}
        max={duration || 100}
        step={0.01}
        defaultValue={initialTime}
        onChange={handleScrubberChange}
        aria-label="Seek"
        className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer accent-gatefold-accent focus:outline-none"
        style={{
          background: `linear-gradient(to right, var(--accent) ${progressPercent}%, var(--surface-2) ${progressPercent}%)`,
        }}
      />

      <span className="text-[11px] font-mono text-gatefold-text-3 w-[52px] tabular-nums">
        {formatTime(duration)}
      </span>

      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          className="text-gatefold-text-3 hover:text-gatefold-text p-1.5 rounded hover:bg-gatefold-hover"
        >
          {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={isMuted ? 0 : volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          aria-label="Volume"
          className="w-20 h-1 bg-gatefold-surface-2 rounded-lg appearance-none cursor-pointer accent-gatefold-accent focus:outline-none"
        />
      </div>
    </div>
  );
};

export const TransportBar = React.memo(TransportBarInner);
