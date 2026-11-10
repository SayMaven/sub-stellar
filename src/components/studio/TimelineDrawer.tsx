import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Sparkles,
  Layers,
  Volume2,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import { waveformManager } from '../../engine/audio/WaveformManager';
import { RubyEditorModal } from '../furigana/RubyEditorModal';

export const TimelineDrawer: React.FC = () => {
  const duration = useStudioStore((s) => s.duration);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const seek = useStudioStore((s) => s.seek);
  const lines = useStudioStore((s) => s.lines);
  const selectedLineId = useStudioStore((s) => s.selectedLineId);
  const setSelectedLineId = useStudioStore((s) => s.setSelectedLineId);
  const addLine = useStudioStore((s) => s.addLine);
  const deleteLine = useStudioStore((s) => s.deleteLine);
  const updateLineTiming = useStudioStore((s) => s.updateLineTiming);
  const updateTokenTiming = useStudioStore((s) => s.updateTokenTiming);
  const resolveOverlappingLines = useStudioStore((s) => s.resolveOverlappingLines);
  const track = useStudioStore((s) => s.track);
  const loadSampleTrack = useStudioStore((s) => s.loadSampleTrack);

  // Only re-render when the active subtitle line ID changes, not at 60 FPS!
  const activeLineId = useStudioStore((s) => {
    const found = s.lines.find((l) => s.currentTime >= l.startTime && s.currentTime <= l.endTime);
    return found ? found.id : null;
  });

  const [zoom, setZoom] = useState<number>(2); // Default 2x for clearer block separation (1x..16x)
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ scrollLeft: 0, width: 1200 });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

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
  }, [peaks, zoom, viewport.width]);

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
    e: React.PointerEvent,
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

    const onPointerMove = (moveEvent: PointerEvent) => {
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

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Dragging a word boundary inside a selected subtitle block
  const handleTokenBoundaryDrag = (
    e: React.PointerEvent,
    lineId: string,
    tokenIndex: number
  ) => {
    e.stopPropagation();
    if (!containerRef.current || duration <= 0) return;

    const line = lines.find((l) => l.id === lineId);
    const token = line?.tokens[tokenIndex];
    if (!line || !token) return;

    const startX = e.clientX;
    const initialStart = token.startTime;
    const initialEnd = token.endTime;
    const totalWidth = containerRef.current.clientWidth * zoom;
    const pxPerSec = totalWidth / duration;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaPx = moveEvent.clientX - startX;
      const deltaSec = deltaPx / pxPerSec;
      const nextEnd = Math.round((initialEnd + deltaSec) * 20) / 20;
      updateTokenTiming(lineId, tokenIndex, initialStart, nextEnd);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const editingLine = lines.find((l) => l.id === editingLineId);

  const rulerTicks = useMemo(() => {
    const interval = zoom >= 8 ? 2 : zoom >= 4 ? 5 : zoom >= 2 ? 15 : 30;
    const ticks: { time: number; label: string; left: number }[] = [];
    if (duration <= 0) return ticks;
    for (let tm = 0; tm <= duration; tm += interval) {
      const mins = Math.floor(tm / 60);
      const secs = Math.floor(tm % 60);
      ticks.push({
        time: tm,
        label: `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.00`,
        left: (tm / duration) * 100,
      });
    }
    return ticks;
  }, [zoom, duration]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = () => setViewport({ scrollLeft: el.scrollLeft, width: el.clientWidth });
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', sync);
      observer.disconnect();
    };
  }, []);

  // Direct DOM playhead & auto-scroll update via store subscription (0 React re-renders per frame!)
  useEffect(() => {
    const syncPlayhead = (time: number) => {
      if (playheadRef.current && duration > 0) {
        const pct = Math.max(0, Math.min(100, (time / duration) * 100));
        playheadRef.current.style.left = `${pct}%`;
      }
      const el = containerRef.current;
      if (!el || !isPlaying || isScrubbing || duration <= 0) return;
      const totalW = el.clientWidth * zoom;
      const playheadX = (time / duration) * totalW;
      const viewStart = el.scrollLeft;
      const viewEnd = viewStart + el.clientWidth;

      if (playheadX > viewEnd - 80 || playheadX < viewStart) {
        el.scrollLeft = Math.max(0, playheadX - el.clientWidth * 0.25);
      }
    };

    syncPlayhead(useStudioStore.getState().currentTime);

    let lastTime = useStudioStore.getState().currentTime;
    const unsubscribe = useStudioStore.subscribe((state) => {
      if (state.currentTime !== lastTime) {
        lastTime = state.currentTime;
        syncPlayhead(state.currentTime);
      }
    });

    return () => unsubscribe();
  }, [duration, isPlaying, isScrubbing, zoom]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.altKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoom((z) => Math.min(16, z * 2));
      } else if (e.deltaY > 0) {
        setZoom((z) => Math.max(1, z / 2));
      }
    }
  };

  // Compute multi-lane packing (0 or 1) and count genuinely overlapping lines
  const { laneById, hasMultiLane, overlapCount } = useMemo(() => {
    const sorted = [...lines].sort((a, b) => a.startTime - b.startTime);
    const map = new Map<string, number>();
    const laneEnds = [-1, -1];
    let overlaps = 0;
    let multi = false;

    for (let i = 0; i < sorted.length; i++) {
      const line = sorted[i];
      const next = sorted[i + 1];
      if (next && line.endTime > next.startTime + 0.02) {
        overlaps++;
      }

      if (line.startTime >= laneEnds[0] - 0.02) {
        map.set(line.id, 0);
        laneEnds[0] = line.endTime;
      } else {
        map.set(line.id, 1);
        laneEnds[1] = Math.max(laneEnds[1], line.endTime);
        multi = true;
      }
    }

    return { laneById: map, hasMultiLane: multi, overlapCount: overlaps };
  }, [lines]);

  const totalPx = viewport.width * zoom;
  const visibleFrom = duration > 0 ? ((viewport.scrollLeft - 200) / totalPx) * duration : 0;
  const visibleTo =
    duration > 0 ? ((viewport.scrollLeft + viewport.width + 200) / totalPx) * duration : 0;
  const visibleLines = useMemo(
    () =>
      lines.filter(
        (l) => l.id === selectedLineId || (l.endTime >= visibleFrom && l.startTime <= visibleTo)
      ),
    [lines, selectedLineId, visibleFrom, visibleTo]
  );

  return (
    <div className="h-full w-full border-t border-gatefold-line bg-gatefold-surface flex flex-col select-none">
      {/* Timeline Header / Control Bar */}
      <div className="h-8 px-4 border-b border-gatefold-line flex items-center justify-between text-[11px] font-mono bg-gatefold-panel">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-gatefold-accent font-semibold">
            <Volume2 className="w-3.5 h-3.5" />
            <span>TRACK 1: SUBTITLES & VOCAL TIMING</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-gatefold-surface text-gatefold-text-3 border border-gatefold-line">
            {lines.length} events
          </span>

          <button
            onClick={() => addLine()}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-gatefold-accent/15 text-gatefold-accent hover:bg-gatefold-accent/25 border border-gatefold-accent/30 text-[10px] font-sans font-medium"
            title="Add Subtitle Line at Playhead (Ctrl+N)"
          >
            <Plus className="w-3 h-3" />
            <span>Add Line</span>
          </button>

          {selectedLineId && (
            <button
              onClick={() => deleteLine(selectedLineId)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-gatefold-surface hover:bg-red-500/20 text-gatefold-text-3 hover:text-red-400 border border-gatefold-line text-[10px] font-sans font-medium"
              title="Delete Selected Line (Delete)"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          )}

          {overlapCount > 0 && (
            <button
              onClick={() => resolveOverlappingLines()}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-sans font-medium"
              title="Auto-trim overlapping subtitle line end times so no two lines collide"
            >
              <Wand2 className="w-3 h-3" />
              <span>Fix Overlaps ({overlapCount})</span>
            </button>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gatefold-text-3 uppercase">Zoom:</span>
          <button
            onClick={() => setZoom((z) => Math.max(1, z / 2))}
            disabled={zoom <= 1}
            className="p-1 rounded hover:bg-gatefold-hover text-gatefold-text-3 hover:text-gatefold-text disabled:opacity-30"
            title="Zoom Out (Ctrl+Scroll)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-semibold text-gatefold-accent min-w-7 text-center">
            {zoom}x
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(16, z * 2))}
            disabled={zoom >= 16}
            className="p-1 rounded hover:bg-gatefold-hover text-gatefold-text-3 hover:text-gatefold-text disabled:opacity-30"
            title="Zoom In (Ctrl+Scroll)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scroller Area */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex-1 relative cursor-crosshair overflow-x-auto overflow-y-hidden bg-gatefold-bg/50"
      >
        <div className="h-full relative min-w-full" style={{ width: `${zoom * 100}%` }}>
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
            width={Math.max(300, Math.round(viewport.width * zoom * (window.devicePixelRatio || 1)))}
            height={70}
            className="absolute inset-x-0 top-5 h-14 w-full pointer-events-none opacity-40"
          />

          {/* Empty State when no lines */}
          {lines.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-gatefold-text-3 gap-3">
              <Layers className="w-4 h-4 text-gatefold-text-3" />
              <span>No subtitle events on timeline.</span>
              <button
                onClick={() => addLine()}
                className="text-gatefold-accent hover:underline font-medium"
              >
                + Add Subtitle Line
              </button>
              <span>or</span>
              <button
                onClick={loadSampleTrack}
                className="text-gatefold-accent hover:underline font-medium"
              >
                Load Demo Showcase
              </button>
            </div>
          ) : (
            /* Subtitle Blocks Track (Supports 1 or 2 staggered lanes so blocks never collide) */
            <div className="absolute inset-x-0 bottom-1.5 h-16">
              {visibleLines.map((line) => {
                const leftPercent = (line.startTime / duration) * 100;
                const widthPercent = Math.max(0.15, ((line.endTime - line.startTime) / duration) * 100);
                const isSelected = selectedLineId === line.id;
                const isCurrent = activeLineId === line.id;
                const lineSpan = Math.max(0.05, line.endTime - line.startTime);
                const lane = laneById.get(line.id) ?? 0;
                const blockPxWidth = (widthPercent / 100) * totalPx;

                return (
                  <div
                    key={line.id}
                    title={`${line.text || '(Empty)'} [${line.startTime.toFixed(2)}s - ${line.endTime.toFixed(2)}s]`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLineId(line.id);
                      seek(line.startTime);
                    }}
                    onPointerDown={(e) => handleBlockDrag(e, line.id, 'move')}
                    className={`absolute rounded-md px-1.5 flex items-center justify-between text-xs font-medium cursor-grab active:cursor-grabbing border select-none group overflow-hidden ${
                      hasMultiLane ? 'h-7' : 'h-11 top-2.5'
                    } ${
                      isCurrent
                        ? 'bg-gatefold-accent/30 text-gatefold-accent border-gatefold-accent z-20'
                        : isSelected
                        ? 'bg-gatefold-surface-2 text-gatefold-text border-gatefold-accent ring-1 ring-gatefold-accent/50 z-20'
                        : 'bg-gatefold-surface text-gatefold-text-2 border-gatefold-line hover:border-gatefold-line-2 z-10'
                    }`}
                    style={{
                      left: `${leftPercent}%`,
                      width: `calc(${widthPercent}% - 2px)`,
                      minWidth: '8px',
                      top: hasMultiLane ? (lane === 0 ? '2px' : '32px') : undefined,
                    }}
                  >
                    {/* Left Trim Handle */}
                    <div
                      onPointerDown={(e) => handleBlockDrag(e, line.id, 'start')}
                      className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-gatefold-accent/60 rounded-l-md z-20 transition-colors"
                      title="Trim Line Start"
                    />

                    {/* Draggable Word Boundaries (shown when line is selected) */}
                    {isSelected &&
                      line.tokens.slice(0, -1).map((tok, tIdx) => {
                        const relPct = ((tok.endTime - line.startTime) / lineSpan) * 100;
                        return (
                          <div
                            key={tIdx}
                            onPointerDown={(e) => handleTokenBoundaryDrag(e, line.id, tIdx)}
                            title={`Drag word boundary: "${tok.text}" -> "${
                              line.tokens[tIdx + 1]?.text || ''
                            }" (${tok.endTime.toFixed(2)}s)`}
                            className="absolute top-0 bottom-0 w-1.5 -ml-0.75 bg-gatefold-accent/40 hover:bg-gatefold-accent cursor-col-resize z-20"
                            style={{ left: `${Math.max(4, Math.min(96, relPct))}%` }}
                          />
                        );
                      })}

                    {/* Line Content & Syllables */}
                    <div className="flex items-center gap-1 overflow-hidden pl-0.5 pr-0.5 pointer-events-none z-10 min-w-0">
                      <span className="truncate font-semibold text-[11px]">
                        {line.text.trim() ? line.text : '(Empty)'}
                      </span>
                      {blockPxWidth >= 110 && line.tokens && line.tokens.length > 1 && (
                        <span className="text-[9px] font-mono text-gatefold-text-3 px-1 py-0.2 rounded bg-gatefold-bg/60 border border-gatefold-line shrink-0">
                          {line.tokens.length}w
                        </span>
                      )}
                    </div>

                    {/* Quick Edit Furigana Trigger (only shown when block is wide enough or hovered) */}
                    {blockPxWidth >= 64 && (
                      <div className="flex items-center gap-1 shrink-0 z-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLineId(line.id);
                          }}
                          className="p-0.5 rounded hover:bg-gatefold-accent hover:text-gatefold-bg text-gatefold-text-3 transition-colors opacity-0 group-hover:opacity-100"
                          title="Edit Furigana & Word Durations"
                        >
                          <Sparkles className="w-3 h-3" />
                        </button>
                        {blockPxWidth >= 90 && (
                          <span className="text-[9px] font-mono text-gatefold-text-3">
                            {(line.endTime - line.startTime).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    )}

                    {/* Right Trim Handle */}
                    <div
                      onPointerDown={(e) => handleBlockDrag(e, line.id, 'end')}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-gatefold-accent/60 rounded-r-md z-20 transition-colors"
                      title="Trim Line End"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Draggable Playhead Scrubber */}
          {duration > 0 && (
            <div
              ref={playheadRef}
              className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-30 pointer-events-none"
              style={{
                left: `${
                  duration > 0
                    ? Math.max(0, Math.min(100, (useStudioStore.getState().currentTime / duration) * 100))
                    : 0
                }%`,
              }}
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
