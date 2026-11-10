import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Sparkles,
  Layers,
  Volume2,
} from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import { waveformManager } from '../../engine/audio/WaveformManager';
import { RubyEditorModal } from '../furigana/RubyEditorModal';

export const TimelineDrawer: React.FC = () => {
  const {
    currentTime,
    duration,
    seek,
    lines,
    selectedLineId,
    setSelectedLineId,
    updateLineTiming,
    track,
    loadSampleTrack,
  } = useStudioStore();

  const [zoom, setZoom] = useState<number>(1); // 1x, 2x, 4x
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load downsampled waveform peaks via Web Worker
  useEffect(() => {
    let isCurrent = true;

    async function loadWaveform() {
      if (duration <= 0) return;
      const data = await waveformManager.getPeaks(track.id || 'default', duration);
      if (isCurrent) {
        setPeaks(data);
      }
    }

    loadWaveform();

    return () => {
      isCurrent = false;
    };
  }, [track.id, duration]);

  // Render Canvas Waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    ctx.clearRect(0, 0, width, height);

    const totalBins = peaks.length / 2;
    const step = width / totalBins;

    // Gradient styling
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(143, 180, 255, 0.45)');
    grad.addColorStop(0.5, 'rgba(143, 180, 255, 0.85)');
    grad.addColorStop(1, 'rgba(143, 180, 255, 0.45)');

    ctx.fillStyle = grad;

    for (let b = 0; b < totalBins; b++) {
      const minPeak = peaks[b * 2];
      const maxPeak = peaks[b * 2 + 1];

      const x = b * step;
      const barHeight = Math.max(2, (maxPeak - minPeak) * midY * 0.85);
      const y = midY - barHeight / 2;

      ctx.fillRect(x, y, Math.max(1, step - 0.5), barHeight);
    }
  }, [peaks, zoom]);

  // Scrubber drag handling
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration <= 0) return;
    setIsScrubbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateTimeFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    updateTimeFromPointer(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Safe catch if pointer was not captured
      }
    }
  };

  const updateTimeFromPointer = useCallback(
    (clientX: number) => {
      if (!containerRef.current || duration <= 0) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scrollLeft = containerRef.current.scrollLeft;
      const totalWidth = rect.width * zoom;

      const clickX = clientX - rect.left + scrollLeft;
      const ratio = Math.max(0, Math.min(1, clickX / totalWidth));
      const newTime = Math.round(ratio * duration * 20) / 20; // 0.05s snap
      seek(newTime);
    },
    [duration, zoom, seek]
  );

  // Subtitle block trimming & drag logic
  const handleBlockDrag = (
    e: React.MouseEvent,
    lineId: string,
    mode: 'move' | 'start' | 'end'
  ) => {
    e.stopPropagation();
    if (!containerRef.current || duration <= 0) return;

    const line = lines.find((l) => l.id === lineId);
    if (!line) return;

    const startX = e.clientX;
    const initialStart = line.startTime;
    const initialEnd = line.endTime;
    const totalWidth = containerRef.current.clientWidth * zoom;
    const pxPerSec = totalWidth / duration;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startX;
      const deltaSec = deltaPx / pxPerSec;

      if (mode === 'move') {
        const lineLen = initialEnd - initialStart;
        const newStart = Math.max(0, Math.min(duration - lineLen, initialStart + deltaSec));
        const newEnd = newStart + lineLen;
        updateLineTiming(
          lineId,
          Math.round(newStart * 20) / 20,
          Math.round(newEnd * 20) / 20
        );
      } else if (mode === 'start') {
        const newStart = Math.max(0, Math.min(initialEnd - 0.2, initialStart + deltaSec));
        updateLineTiming(lineId, Math.round(newStart * 20) / 20, initialEnd);
      } else if (mode === 'end') {
        const newEnd = Math.max(initialStart + 0.2, Math.min(duration, initialEnd + deltaSec));
        updateLineTiming(lineId, initialStart, Math.round(newEnd * 20) / 20);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const editingLine = lines.find((l) => l.id === editingLineId);

  // Dynamic ruler markers
  const rulerInterval = zoom >= 4 ? 5 : zoom >= 2 ? 15 : 30;
  const rulerTicks = [];
  for (let t = 0; t <= duration; t += rulerInterval) {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    rulerTicks.push({
      time: t,
      label: `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.00`,
      left: (t / duration) * 100,
    });
  }

  return (
    <div className="h-full w-full border-t border-gatefold-line bg-gatefold-surface flex flex-col select-none">
      {/* Timeline Header / Control Bar */}
      <div className="h-8 px-4 border-b border-gatefold-line flex items-center justify-between text-[11px] font-mono bg-gatefold-panel">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-gatefold-accent font-semibold">
            <Volume2 className="w-3.5 h-3.5" />
            <span>TRACK 1: SUBTITLES & FURIGANA</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-gatefold-surface text-gatefold-text-3 border border-gatefold-line">
            {lines.length} events
          </span>
          <span className="text-[10px] text-gatefold-text-3">
            Grid: 0.05s snap
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gatefold-text-3 uppercase">Zoom:</span>
          <button
            onClick={() => setZoom((z) => Math.max(1, z / 2))}
            disabled={zoom <= 1}
            className="p-1 rounded hover:bg-gatefold-hover text-gatefold-text-3 hover:text-gatefold-text disabled:opacity-30"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-semibold text-gatefold-accent min-w-6 text-center">
            {zoom}x
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(4, z * 2))}
            disabled={zoom >= 4}
            className="p-1 rounded hover:bg-gatefold-hover text-gatefold-text-3 hover:text-gatefold-text disabled:opacity-30"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scroller Area */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex-1 relative cursor-crosshair overflow-x-auto overflow-y-hidden bg-gatefold-bg/50"
      >
        <div
          className="h-full relative min-w-full"
          style={{ width: `${zoom * 100}%` }}
        >
          {/* Dynamic Ruler Ticks */}
          <div className="absolute top-0 inset-x-0 h-4 border-b border-gatefold-line/50 pointer-events-none text-[9px] font-mono text-gatefold-text-3">
            {rulerTicks.map((tick) => (
              <span
                key={tick.time}
                className="absolute top-0.5 -translate-x-1/2"
                style={{ left: `${tick.left}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>

          {/* Canvas Waveform */}
          <canvas
            ref={canvasRef}
            width={1200 * zoom}
            height={70}
            className="absolute inset-x-0 top-5 h-16 w-full pointer-events-none opacity-40"
          />

          {/* Empty State when no lines */}
          {lines.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-gatefold-text-3 gap-2">
              <Layers className="w-4 h-4 text-gatefold-text-3" />
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
            <div className="absolute inset-x-0 bottom-2.5 h-14 flex items-center">
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
                    onMouseDown={(e) => handleBlockDrag(e, line.id, 'move')}
                    className={`absolute h-11 rounded-lg px-2 flex items-center justify-between text-xs font-medium cursor-grab active:cursor-grabbing border select-none group transition-shadow ${
                      isCurrent
                        ? 'bg-gatefold-accent/30 text-gatefold-accent border-gatefold-accent shadow-[0_0_12px_rgba(143,180,255,0.4)]'
                        : isSelected
                        ? 'bg-gatefold-surface-2 text-gatefold-text border-gatefold-accent ring-1 ring-gatefold-accent/50'
                        : 'bg-gatefold-surface/90 text-gatefold-text-2 border-gatefold-line hover:border-gatefold-line-2'
                    }`}
                    style={{
                      left: `${leftPercent}%`,
                      width: `${Math.max(4, widthPercent)}%`,
                    }}
                  >
                    {/* Left Trim Handle */}
                    <div
                      onMouseDown={(e) => handleBlockDrag(e, line.id, 'start')}
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-gatefold-accent/60 rounded-l-lg transition-colors"
                      title="Trim Start"
                    />

                    {/* Line Content & Syllables */}
                    <div className="flex items-center gap-1.5 overflow-hidden pl-1 pr-1 pointer-events-none">
                      <span className="truncate font-semibold">{line.text}</span>
                      {line.tokens && line.tokens.length > 1 && (
                        <span className="text-[9px] font-mono text-gatefold-text-3 px-1 py-0.2 rounded bg-gatefold-surface border border-gatefold-line shrink-0">
                          {line.tokens.length} words
                        </span>
                      )}
                    </div>

                    {/* Quick Edit Furigana Trigger */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLineId(line.id);
                        }}
                        className="p-1 rounded hover:bg-gatefold-accent hover:text-gatefold-bg text-gatefold-text-3 transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit Furigana"
                      >
                        <Sparkles className="w-3 h-3" />
                      </button>
                      <span className="text-[9px] font-mono text-gatefold-text-3">
                        {(line.endTime - line.startTime).toFixed(1)}s
                      </span>
                    </div>

                    {/* Right Trim Handle */}
                    <div
                      onMouseDown={(e) => handleBlockDrag(e, line.id, 'end')}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-gatefold-accent/60 rounded-r-lg transition-colors"
                      title="Trim End"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Draggable Playhead Scrubber */}
          {duration > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-30 pointer-events-none shadow-[0_0_10px_rgba(248,113,113,0.9)]"
              style={{ left: `${playheadPercent}%` }}
            >
              <div className="w-3 h-3 -ml-1.25 bg-red-400 rounded-full shadow-md" />
            </div>
          )}
        </div>
      </div>

      {/* Furigana / Ruby Editor Modal */}
      {editingLine && (
        <RubyEditorModal
          isOpen={Boolean(editingLineId)}
          onClose={() => setEditingLineId(null)}
          line={editingLine}
        />
      )}
    </div>
  );
};
