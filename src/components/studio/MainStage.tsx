import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PixiViewport } from './PixiViewport';
import { TimelineDrawer } from './TimelineDrawer';
import { SubtitleInspector } from './SubtitleInspector';
import { EmptyStudioState } from './EmptyStudioState';
import { TransportBar } from '../layout/TransportBar';
import { useStudioStore } from '../../stores/useStudioStore';
import { usePerfStore } from '../../stores/usePerfStore';
import type { AspectRatio, CanvasResolutionPreset } from '../../types';
import {
  TIMELINE_DEFAULT_HEIGHT,
  clampTimelineHeight,
  computeStageSize,
  getCanvasPixelDimensions,
} from '../../engine/layout/layoutMath';
import { ZoomIn, ZoomOut, AlertCircle, X, RotateCcw, Plus, Monitor } from 'lucide-react';

const ASPECT_RATIOS: { id: AspectRatio; label: string }[] = [
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '1:1', label: '1:1' },
  { id: '4:3', label: '4:3' },
];

const RESOLUTION_PRESETS: { id: CanvasResolutionPreset; label: string }[] = [
  { id: '720p', label: '720p HD' },
  { id: '1080p', label: '1080p FHD' },
  { id: '1440p', label: '1440p QHD' },
  { id: '4k', label: '4K UHD' },
];

const LAYOUT_STORAGE_KEY = 'substellar_studio_layout_v1';

interface StoredStudioLayout {
  timelineHeight?: number;
  inspectorWidth?: number;
}

const loadStoredLayout = (): StoredStudioLayout => {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return {};
};

const saveStoredLayout = (layout: Partial<StoredStudioLayout>) => {
  try {
    if (typeof localStorage !== 'undefined') {
      const current = loadStoredLayout();
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ ...current, ...layout }));
    }
  } catch {}
};

export const MainStage: React.FC = () => {
  const aspectRatio = useStudioStore((s) => s.aspectRatio);
  const setAspectRatio = useStudioStore((s) => s.setAspectRatio);
  const canvasResolution = useStudioStore((s) => s.canvasResolution);
  const setCanvasResolution = useStudioStore((s) => s.setCanvasResolution);
  const zoom = useStudioStore((s) => s.zoom);
  const setZoom = useStudioStore((s) => s.setZoom);
  const linesCount = useStudioStore((s) => s.lines.length);
  const track = useStudioStore((s) => s.track);
  const errorMessage = useStudioStore((s) => s.errorMessage);
  const setErrorMessage = useStudioStore((s) => s.setErrorMessage);
  const loadSampleTrack = useStudioStore((s) => s.loadSampleTrack);
  const addLine = useStudioStore((s) => s.addLine);

  const hasLoadedMedia = Boolean(
    track.videoUrl ||
      track.audioUrl ||
      track.mediaFilePath ||
      track.coverUrl ||
      (track.id && track.duration > 0 && linesCount > 0)
  );
  const isCompletelyEmpty = linesCount === 0 && !hasLoadedMedia;

  const profile = usePerfStore((s) => s.profile);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const stageAreaRef = useRef<HTMLDivElement>(null);
  const [areaSize, setAreaSize] = useState({ width: 0, height: 0 });
  const [timelineHeight, setTimelineHeight] = useState(() => {
    const stored = loadStoredLayout().timelineHeight;
    return typeof stored === 'number' && stored >= 120 && stored <= 480
      ? stored
      : TIMELINE_DEFAULT_HEIGHT;
  });
  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    const stored = loadStoredLayout().inspectorWidth;
    return typeof stored === 'number' && stored >= 240 && stored <= 640 ? stored : 320;
  });

  // Debounced persistence for studio layout dividers
  useEffect(() => {
    const timer = setTimeout(() => {
      saveStoredLayout({ timelineHeight, inspectorWidth });
    }, 300);
    return () => clearTimeout(timer);
  }, [timelineHeight, inspectorWidth]);

  useEffect(() => {
    const el = stageAreaRef.current;
    if (!el) return;
    let rafId: number | null = null;

    const updateSize = (w: number, h: number) => {
      const nextW = Math.max(0, Math.floor(w));
      const nextH = Math.max(0, Math.floor(h));
      setAreaSize((prev) =>
        prev.width === nextW && prev.height === nextH ? prev : { width: nextW, height: nextH }
      );
    };

    updateSize(el.clientWidth, el.clientHeight);

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateSize(rect.width, rect.height);
      });
    });
    observer.observe(el);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  const stageSize = computeStageSize(
    Math.max(0, areaSize.width - 24),
    Math.max(0, areaSize.height - 24),
    aspectRatio,
    zoom
  );

  const pixelDims = getCanvasPixelDimensions(aspectRatio, canvasResolution);

  const clampInspectorWidth = useCallback((w: number) => {
    const available = workspaceRef.current?.clientWidth ?? 1280;
    const maxW = Math.max(280, Math.min(640, Math.floor(available * 0.55)));
    return Math.min(maxW, Math.max(240, Math.round(w)));
  }, []);

  const handleInspectorResizeDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startWidth = inspectorWidth;
      const startAreaWidth = stageAreaRef.current?.clientWidth ?? areaSize.width;
      const startAreaHeight = stageAreaRef.current?.clientHeight ?? areaSize.height;
      let rafId: number | null = null;
      let latestClientX = startX;

      const applyResize = () => {
        rafId = null;
        const nextInspectorWidth = clampInspectorWidth(startWidth + (startX - latestClientX));
        const deltaInspector = nextInspectorWidth - startWidth;
        const nextAreaWidth = Math.max(0, Math.floor(startAreaWidth - deltaInspector));
        const nextAreaHeight = Math.max(0, Math.floor(startAreaHeight));

        setInspectorWidth((prev) => (prev === nextInspectorWidth ? prev : nextInspectorWidth));
        setAreaSize((prev) =>
          prev.width === nextAreaWidth && prev.height === nextAreaHeight
            ? prev
            : { width: nextAreaWidth, height: nextAreaHeight }
        );
      };

      const onMove = (ev: PointerEvent) => {
        latestClientX = ev.clientX;
        if (rafId === null) {
          rafId = requestAnimationFrame(applyResize);
        }
      };

      const onEnd = (ev: PointerEvent) => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        try {
          if (handle.hasPointerCapture(ev.pointerId)) {
            handle.releasePointerCapture(ev.pointerId);
          }
        } catch {
          // Ignore if pointer capture was already released
        }
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
        handle.removeEventListener('lostpointercapture', onEnd);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
      handle.addEventListener('lostpointercapture', onEnd);
    },
    [inspectorWidth, areaSize.width, areaSize.height, clampInspectorWidth]
  );

  const handleInspectorResizeKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setInspectorWidth((w) => clampInspectorWidth(w + 20));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setInspectorWidth((w) => clampInspectorWidth(w - 20));
    }
  };

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startHeight = timelineHeight;
      const available = workspaceRef.current?.clientHeight ?? 800;
      const startAreaWidth = stageAreaRef.current?.clientWidth ?? areaSize.width;
      const startAreaHeight = stageAreaRef.current?.clientHeight ?? areaSize.height;
      let rafId: number | null = null;
      let latestClientY = startY;

      const applyResize = () => {
        rafId = null;
        const nextTimelineHeight = clampTimelineHeight(
          startHeight + (startY - latestClientY),
          available
        );
        const deltaTimeline = nextTimelineHeight - startHeight;
        const nextAreaWidth = Math.max(0, Math.floor(startAreaWidth));
        const nextAreaHeight = Math.max(0, Math.floor(startAreaHeight - deltaTimeline));

        setTimelineHeight((prev) => (prev === nextTimelineHeight ? prev : nextTimelineHeight));
        setAreaSize((prev) =>
          prev.width === nextAreaWidth && prev.height === nextAreaHeight
            ? prev
            : { width: nextAreaWidth, height: nextAreaHeight }
        );
      };

      const onMove = (ev: PointerEvent) => {
        latestClientY = ev.clientY;
        if (rafId === null) {
          rafId = requestAnimationFrame(applyResize);
        }
      };

      const onEnd = (ev: PointerEvent) => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        try {
          if (handle.hasPointerCapture(ev.pointerId)) {
            handle.releasePointerCapture(ev.pointerId);
          }
        } catch {
          // Ignore if pointer capture was already released
        }
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
        handle.removeEventListener('lostpointercapture', onEnd);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
      handle.addEventListener('lostpointercapture', onEnd);
    },
    [timelineHeight, areaSize.width, areaSize.height]
  );

  const handleResizeKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const available = workspaceRef.current?.clientHeight ?? 800;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setTimelineHeight((h) => clampTimelineHeight(h + 24, available));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setTimelineHeight((h) => clampTimelineHeight(h - 24, available));
    }
  };

  return (
    <div
      ref={workspaceRef}
      className="flex-1 min-w-0 flex flex-col h-full bg-gatefold-bg overflow-hidden select-none"
    >
      {/* Error State Banner */}
      {errorMessage && (
        <div className="px-4 py-2 bg-red-500/15 border-b border-red-500/30 text-red-300 text-xs flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSampleTrack}
              className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-[11px] font-medium"
            >
              Restore Sample
            </button>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 rounded hover:bg-red-500/20"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Stage Toolbar */}
      <div className="h-10 px-4 border-b border-gatefold-line flex items-center justify-between bg-gatefold-panel text-xs text-gatefold-text-2">
        {/* Left: Aspect Ratio & Canvas Resolution Picker */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gatefold-text-3 font-medium text-[11px] hidden sm:inline">
            Format:
          </span>
          <div className="flex items-center gap-1 bg-gatefold-surface rounded-md p-0.5 border border-gatefold-line">
            {ASPECT_RATIOS.map((item) => (
              <button
                key={item.id}
                onClick={() => setAspectRatio(item.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  aspectRatio === item.id
                    ? 'bg-gatefold-accent/20 text-gatefold-accent font-semibold'
                    : 'text-gatefold-text-3 hover:text-gatefold-text'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <span className="text-gatefold-line-2 mx-0.5">|</span>

          {/* Canvas Resolution Dropdown */}
          <div className="flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-gatefold-accent hidden md:inline" />
            <select
              aria-label="Canvas Resolution"
              value={canvasResolution}
              onChange={(e) => setCanvasResolution(e.target.value as CanvasResolutionPreset)}
              className="px-2 py-0.5 rounded bg-gatefold-surface border border-gatefold-line text-[11px] font-mono text-gatefold-text focus:border-gatefold-accent focus:outline-none"
            >
              {RESOLUTION_PRESETS.map((res) => (
                <option key={res.id} value={res.id}>
                  {res.label}
                </option>
              ))}
            </select>
            <span className="hidden lg:inline font-mono text-[11px] text-gatefold-text-3">
              {pixelDims.width}×{pixelDims.height} ({profile.renderScale}x)
            </span>
          </div>
        </div>

        {/* Right: Add Line, Zoom & Reset */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => addLine()}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-gatefold-accent/15 text-gatefold-accent hover:bg-gatefold-accent/25 border border-gatefold-accent/30 transition-colors"
            title="Add New Subtitle Line at Playhead (Ctrl+N)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Line</span>
          </button>

          <div className="flex items-center gap-1.5 bg-gatefold-surface rounded-md px-2 py-0.5 border border-gatefold-line">
            <button
              onClick={() => setZoom(zoom - 10)}
              className="text-gatefold-text-3 hover:text-gatefold-text"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] text-gatefold-text-3 w-8 text-center">
              {zoom}%
            </span>
            <button
              onClick={() => setZoom(zoom + 10)}
              className="text-gatefold-text-3 hover:text-gatefold-text"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={loadSampleTrack}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gatefold-text-3 hover:text-gatefold-text hover:bg-gatefold-hover border border-transparent hover:border-gatefold-line transition-colors"
            title={isCompletelyEmpty ? 'Load J-Pop Demo Showcase' : 'Reset Project to Sample Track'}
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden lg:inline">{isCompletelyEmpty ? 'Load Demo' : 'Reset Demo'}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Split: Viewport (Left) + Resizable Divider + Subtitle Inspector (Right) */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Outer measured stage container (never scrolls, prevents ResizeObserver scrollbar feedback loop) */}
        <div ref={stageAreaRef} className="flex-1 min-w-0 min-h-0 flex overflow-hidden">
          <div
            className={`w-full h-full flex p-3 ${
              zoom > 100 ? 'overflow-auto' : 'overflow-hidden'
            }`}
          >
            {isCompletelyEmpty ? (
              <div className="m-auto w-full flex justify-center">
                <EmptyStudioState />
              </div>
            ) : (
              <div
                className={`relative m-auto shrink-0 border border-gatefold-line bg-black rounded-lg overflow-hidden ${
                  zoom <= 100 ? 'max-w-full max-h-full' : ''
                }`}
                style={{ width: stageSize.width, height: stageSize.height }}
              >
                <PixiViewport />
              </div>
            )}
          </div>
        </div>

        {/* Vertical Resize Handle between Video Stage and Inspector Sidebar */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector sidebar (Drag or Double-click to reset)"
          title="Drag left/right to resize Inspector sidebar (Double-click to reset to 320px)"
          tabIndex={0}
          onPointerDown={handleInspectorResizeDown}
          onKeyDown={handleInspectorResizeKey}
          onDoubleClick={() => setInspectorWidth(320)}
          className="w-1.5 shrink-0 cursor-col-resize bg-gatefold-line hover:bg-gatefold-accent/60 focus-visible:bg-gatefold-accent focus:outline-none transition-colors"
        />

        <SubtitleInspector width={inspectorWidth} />
      </div>

      {/* Timeline resize handle */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize timeline (Arrow Up / Arrow Down)"
        tabIndex={0}
        onPointerDown={handleResizePointerDown}
        onKeyDown={handleResizeKey}
        className="h-1.5 shrink-0 cursor-row-resize bg-gatefold-line hover:bg-gatefold-accent/60 focus-visible:bg-gatefold-accent focus:outline-none"
      />

      {/* Transport sits directly above the timeline (NLE pattern) */}
      <TransportBar />

      {/* Bottom Timeline Drawer */}
      <div className="shrink-0 overflow-hidden" style={{ height: timelineHeight }}>
        <TimelineDrawer />
      </div>
    </div>
  );
};
