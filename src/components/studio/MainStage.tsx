import React from 'react';
import { PixiViewport } from './PixiViewport';
import { TimelineDrawer } from './TimelineDrawer';
import { useStudioStore } from '../../stores/useStudioStore';
import type { AspectRatio } from '../../types';
import { ZoomIn, ZoomOut } from 'lucide-react';

const ASPECT_RATIOS: { id: AspectRatio; label: string }[] = [
  { id: '16:9', label: '16:9 (Landscape)' },
  { id: '9:16', label: '9:16 (Shorts/TikTok)' },
  { id: '1:1', label: '1:1 (Square)' },
  { id: '4:3', label: '4:3 (Classic)' },
];

export const MainStage: React.FC = () => {
  const { aspectRatio, setAspectRatio, zoom, setZoom } = useStudioStore();

  const getAspectClass = () => {
    switch (aspectRatio) {
      case '16:9':
        return 'aspect-video max-w-4xl max-h-[70vh]';
      case '9:16':
        return 'aspect-[9/16] max-h-[70vh]';
      case '1:1':
        return 'aspect-square max-h-[70vh]';
      case '4:3':
        return 'aspect-[4/3] max-w-3xl max-h-[70vh]';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gatefold-bg/40 backdrop-blur-sm overflow-hidden select-none">
      {/* Top Stage Toolbar */}
      <div className="h-10 px-4 border-b border-gatefold-line flex items-center justify-between bg-gatefold-panel text-xs text-gatefold-text-2">
        {/* Aspect Ratio Switcher */}
        <div className="flex items-center gap-1.5">
          <span className="text-gatefold-text-3 mr-1 font-medium">Aspect:</span>
          {ASPECT_RATIOS.map((item) => (
            <button
              key={item.id}
              onClick={() => setAspectRatio(item.id)}
              className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                aspectRatio === item.id
                  ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40 font-semibold'
                  : 'text-gatefold-text-3 hover:text-gatefold-text hover:bg-gatefold-hover border border-transparent'
              }`}
            >
              {item.id}
            </button>
          ))}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(zoom - 10)}
            className="p-1 rounded text-gatefold-text-3 hover:text-gatefold-text hover:bg-gatefold-hover"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-xs text-gatefold-text-3 w-10 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom(zoom + 10)}
            className="p-1 rounded text-gatefold-text-3 hover:text-gatefold-text hover:bg-gatefold-hover"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Stage Canvas Viewport */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
        <div
          className={`w-full transition-all duration-200 border border-gatefold-line bg-black/60 rounded-xl overflow-hidden shadow-2xl relative ${getAspectClass()}`}
          style={{ transform: `scale(${zoom / 100})` }}
        >
          <PixiViewport />
        </div>
      </div>

      {/* Bottom Timeline Drawer */}
      <TimelineDrawer />
    </div>
  );
};
