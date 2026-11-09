import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Volume2,
  VolumeX,
  Music,
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

export const TransportBar: React.FC = () => {
  const {
    track,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLooping,
    togglePlay,
    seek,
    stepTime,
    setVolume,
    toggleMute,
    toggleLoop,
    aspectRatio,
  } = useStudioStore();

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <footer className="h-[92px] w-full px-4 border-t border-gatefold-line bg-gatefold-panel-strong backdrop-blur-md flex items-center justify-between z-40 select-none">
      {/* Left: Track Information */}
      <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
        <div className="w-12 h-12 rounded-lg bg-gatefold-surface-2 border border-gatefold-line flex items-center justify-center overflow-hidden flex-shrink-0 relative group">
          {track.coverUrl ? (
            <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
          ) : (
            <Music className="w-6 h-6 text-gatefold-text-3" />
          )}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-gatefold-text truncate">{track.title}</h4>
          <p className="text-xs text-gatefold-text-3 truncate">{track.artist}</p>
          {track.bpm && (
            <span className="inline-block text-[10px] text-gatefold-accent mt-0.5 font-mono">
              {track.bpm} BPM
            </span>
          )}
        </div>
      </div>

      {/* Center: Playback Controls & Scrubber */}
      <div className="flex-1 max-w-2xl px-4 flex flex-col items-center gap-1.5">
        {/* Buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => stepTime(-5)}
            title="Step Back 5s"
            className="text-gatefold-text-3 hover:text-gatefold-text p-1.5 rounded-full hover:bg-gatefold-hover transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className="w-10 h-10 rounded-full bg-gatefold-accent text-gatefold-bg flex items-center justify-center shadow-[0_0_16px_var(--glow)] hover:scale-105 active:scale-95 transition-all"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={() => stepTime(5)}
            title="Step Forward 5s"
            className="text-gatefold-text-3 hover:text-gatefold-text p-1.5 rounded-full hover:bg-gatefold-hover transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={toggleLoop}
            title="Toggle Repeat Line (L)"
            className={`p-1.5 rounded-full transition-colors ${
              isLooping
                ? 'text-gatefold-accent bg-gatefold-accent/20'
                : 'text-gatefold-text-3 hover:text-gatefold-text hover:bg-gatefold-hover'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrubber & Timecode */}
        <div className="w-full flex items-center gap-3">
          <span className="text-[11px] font-mono text-gatefold-text-3 w-14 text-right">
            {formatTime(currentTime)}
          </span>

          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.01}
              value={currentTime}
              onChange={handleScrubberChange}
              className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg appearance-none cursor-pointer accent-gatefold-accent focus:outline-none"
              style={{
                background: `linear-gradient(to right, var(--accent) ${progressPercent}%, var(--surface-2) ${progressPercent}%)`,
              }}
            />
          </div>

          <span className="text-[11px] font-mono text-gatefold-text-3 w-14">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right: Audio Volume & Aspect Ratio Tag */}
      <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px]">
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-gatefold-surface-2 border border-gatefold-line text-gatefold-text-3">
          {aspectRatio}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="text-gatefold-text-3 hover:text-gatefold-text p-1.5 rounded-full hover:bg-gatefold-hover transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 h-1 bg-gatefold-surface-2 rounded-lg appearance-none cursor-pointer accent-gatefold-accent focus:outline-none"
          />
        </div>
      </div>
    </footer>
  );
};
