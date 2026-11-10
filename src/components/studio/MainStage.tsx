import React from 'react';
import { PixiViewport } from './PixiViewport';
import { TimelineDrawer } from './TimelineDrawer';
import { SubtitleInspector } from './SubtitleInspector';
import { EmptyStudioState } from './EmptyStudioState';
import { useStudioStore } from '../../stores/useStudioStore';
import { usePerfStore } from '../../stores/usePerfStore';
import type { AspectRatio } from '../../types';
import { ZoomIn, ZoomOut, AlertCircle, X, RotateCcw } from 'lucide-react';

const ASPECT_RATIOS: { id: AspectRatio; label: string }[] = [
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '1:1', label: '1:1' },
  { id: '4:3', label: '4:3' },
];

export const MainStage: React.FC = () => {
  const {
    aspectRatio,
    setAspectRatio,
    zoom,
    setZoom,
    lines,
    errorMessage,
    setErrorMessage,
    loadSampleTrack,
  } = useStudioStore();

  const { profile } = usePerfStore();

  const getAspectClass = () => {
    switch (aspectRatio) {
      case '16:9':
        return 'aspect-video max-h-full max-w-full';
      case '9:16':
        return 'aspect-[9/16] max-h-full max-w-full';
      case '1:1':
        return 'aspect-square max-h-full max-w-full';
      case '4:3':
        return 'aspect-[4/3] max-h-full max-w-full';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gatefold-bg/50 backdrop-blur-sm overflow-hidden select-none">
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
        {/* Left: Aspect Ratio & Safe Guide Indicators */}
        <div className="flex items-center gap-2">
          <span className="text-gatefold-text-3 font-medium text-[11px]">Format:</span>
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

          <span className="text-gatefold-line-2 mx-1">|</span>

          <span className="font-mono text-[11px] text-gatefold-text-3">
            Internal Canvas: {profile.previewResolution} ({profile.renderScale}x)
          </span>
        </div>

        {/* Right: Zoom & Reset */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-gatefold-surface rounded-md px-2 py-0.5 border border-gatefold-line">
            <button
              onClick={() => setZoom(zoom - 10)}
              className="text-gatefold-text-3 hover:text-gatefold-text"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] text-gatefold-text-3 w-8 text-center">{zoom}%</span>
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
            title="Reset Project to Sample Track"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Split: Viewport (Left) + Subtitle Inspector (Right) */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Canvas Stage Area */}
        <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center p-3 overflow-hidden relative">
          {lines.length === 0 ? (
            <EmptyStudioState />
          ) : (
            <div
              className={`relative border border-gatefold-line bg-black rounded-xl overflow-hidden shadow-2xl flex items-center justify-center ${getAspectClass()}`}
              style={{
                transform: zoom === 100 ? undefined : `scale(${zoom / 100})`,
                transition: 'transform 0.15s ease-out',
              }}
            >
              <PixiViewport />
            </div>
          )}
        </div>

        {/* Subtitle & Typography Inspector */}
        {lines.length > 0 && <SubtitleInspector />}
      </div>

      {/* Bottom Timeline Drawer */}
      <div className="h-44 shrink-0 overflow-hidden">
        <TimelineDrawer />
      </div>
    </div>
  );
};
