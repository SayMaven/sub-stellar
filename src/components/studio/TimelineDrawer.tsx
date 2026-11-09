import React, { useRef } from 'react';
import { useStudioStore } from '../../stores/useStudioStore';

export const TimelineDrawer: React.FC = () => {
  const { currentTime, duration, seek, lines, selectedLineId, setSelectedLineId } =
    useStudioStore();
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
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
        <div className="flex items-center gap-4">
          <span className="text-gatefold-accent font-semibold">TRACK 1: VOCALS & TIMECODES</span>
          <span>SYNC: LRCLIB VERIFIED</span>
        </div>
        <div className="flex items-center gap-6">
          <span>00:00</span>
          <span>01:00</span>
          <span>02:00</span>
          <span>03:00</span>
        </div>
      </div>

      {/* Waveform & Subtitle Track Area */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="flex-1 relative cursor-pointer overflow-hidden p-2 bg-gatefold-bg/50"
      >
        {/* Synthetic Waveform Bars for Phase 1 Demo */}
        <div className="absolute inset-x-2 top-2 h-16 flex items-center justify-between gap-0.5 opacity-30 pointer-events-none">
          {Array.from({ length: 90 }).map((_, i) => {
            const height = Math.abs(Math.sin(i * 0.2) * 80 + Math.cos(i * 0.5) * 20);
            return (
              <div
                key={i}
                className="w-1 bg-gatefold-accent rounded-full"
                style={{ height: `${Math.max(8, height)}%` }}
              />
            );
          })}
        </div>

        {/* Subtitle Blocks Track */}
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
                    ? 'bg-gatefold-accent/30 text-gatefold-accent border-gatefold-accent shadow-[0_0_10px_rgba(143,180,255,0.3)]'
                    : isSelected
                    ? 'bg-gatefold-surface-2 text-gatefold-text border-gatefold-line-2'
                    : 'bg-gatefold-surface/80 text-gatefold-text-2 border-gatefold-line hover:border-gatefold-line-2'
                }`}
                style={{
                  left: `${leftPercent}%`,
                  width: `${Math.max(5, widthPercent)}%`,
                }}
              >
                <span className="truncate">{line.text}</span>
              </div>
            );
          })}
        </div>

        {/* Playhead Scrubber Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10 pointer-events-none shadow-[0_0_8px_rgba(248,113,113,0.8)]"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="w-2.5 h-2.5 -ml-1 bg-red-400 rounded-full" />
        </div>
      </div>
    </div>
  );
};
