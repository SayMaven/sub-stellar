import React, { useRef } from 'react';
import { useStudioStore } from '../../stores/useStudioStore';

export const TimelineDrawer: React.FC = () => {
  const {
    currentTime,
    duration,
    seek,
    lines,
    selectedLineId,
    setSelectedLineId,
    loadSampleTrack,
  } = useStudioStore();
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || duration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    seek(ratio * duration);
  };

  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="h-44 w-full border-t border-gatefold-line bg-gatefold-surface flex flex-col select-none">
      {/* Timeline Header / Ruler */}
      <div className="h-7 px-4 border-b border-gatefold-line flex items-center justify-between text-[11px] font-mono text-gatefold-text-3 bg-gatefold-panel">
        <div className="flex items-center gap-3">
          <span className="text-gatefold-accent font-semibold">TRACK 1: SUBTITLE & FURIGANA</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-gatefold-surface-2 text-gatefold-text-3 border border-gatefold-line">
            {lines.length} events
          </span>
        </div>

        {/* Dynamic Ruler Ticks */}
        <div className="flex items-center gap-8 text-[10px] text-gatefold-text-3">
          <span>00:00.00</span>
          <span>00:30.00</span>
          <span>01:00.00</span>
          <span>01:30.00</span>
          <span>02:00.00</span>
          <span>02:30.00</span>
          <span>03:00.00</span>
        </div>
      </div>

      {/* Waveform & Subtitle Track Area */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="flex-1 relative cursor-pointer overflow-hidden p-2 bg-gatefold-bg/50"
      >
        {/* Synthetic Waveform Peaks */}
        {duration > 0 && (
          <div className="absolute inset-x-2 top-2 h-16 flex items-center justify-between gap-0.5 opacity-25 pointer-events-none">
            {Array.from({ length: 120 }).map((_, i) => {
              const height = Math.abs(Math.sin(i * 0.18) * 85 + Math.cos(i * 0.4) * 20);
              return (
                <div
                  key={i}
                  className="w-1 bg-gatefold-accent rounded-full"
                  style={{ height: `${Math.max(6, height)}%` }}
                />
              );
            })}
          </div>
        )}

        {/* Empty State when no lines */}
        {lines.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gatefold-text-3 gap-2">
            <span>No subtitle events on timeline.</span>
            <button
              onClick={loadSampleTrack}
              className="text-gatefold-accent hover:underline font-medium"
            >
              Load Demo Showcase
            </button>
          </div>
        ) : (
          /* Subtitle Blocks Track */
          <div className="absolute inset-x-2 bottom-3 h-12 flex items-center">
            {lines.map((line) => {
              const leftPercent = (line.startTime / duration) * 100;
              const widthPercent = ((line.endTime - line.startTime) / duration) * 100;
              const isSelected = selectedLineId === line.id;
              const isCurrent = currentTime >= line.startTime && currentTime <= line.endTime;

              return (
                <div
                  key={line.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLineId(line.id);
                    seek(line.startTime);
                  }}
                  className={`absolute h-9 rounded-md px-2 flex items-center justify-between text-xs font-medium cursor-pointer border transition-all ${
                    isCurrent
                      ? 'bg-gatefold-accent/30 text-gatefold-accent border-gatefold-accent shadow-[0_0_12px_rgba(143,180,255,0.35)]'
                      : isSelected
                      ? 'bg-gatefold-surface-2 text-gatefold-text border-gatefold-line-2 ring-1 ring-gatefold-accent/40'
                      : 'bg-gatefold-surface/80 text-gatefold-text-2 border-gatefold-line hover:border-gatefold-line-2'
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${Math.max(5, widthPercent)}%`,
                  }}
                >
                  <span className="truncate">{line.text}</span>
                  <span className="text-[9px] font-mono text-gatefold-text-3 ml-1 flex-shrink-0">
                    {(line.endTime - line.startTime).toFixed(1)}s
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Playhead Scrubber Line */}
        {duration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10 pointer-events-none shadow-[0_0_8px_rgba(248,113,113,0.8)]"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="w-2.5 h-2.5 -ml-1 bg-red-400 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
};
