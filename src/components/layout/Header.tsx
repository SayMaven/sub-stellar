import React from 'react';
import { Sparkles, Search, Activity, Zap, Minus, Square, X } from 'lucide-react';
import { usePerfStore } from '../../stores/usePerfStore';
import { useStudioStore } from '../../stores/useStudioStore';

export const Header: React.FC = () => {
  const { mode, cycleQualityMode, toggleTelemetry, metrics } = usePerfStore();
  const { setActiveTab } = useStudioStore();

  const handleSearchFocus = () => {
    setActiveTab('youtube');
  };

  const getQualityBadgeColor = () => {
    switch (mode) {
      case 'low':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'balanced':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'ultra':
        return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
    }
  };

  return (
    <header className="h-[46px] w-full px-3 flex items-center justify-between border-b border-gatefold-line bg-gatefold-panel-strong backdrop-blur-md z-40 select-none">
      {/* Brand & Title */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gatefold-accent/20 border border-gatefold-accent/40 text-gatefold-accent">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm tracking-wide text-gatefold-text">SubStellar</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-gatefold-surface-2 border border-gatefold-line text-gatefold-text-3">
            v1.0.0-alpha
          </span>
        </div>
      </div>

      {/* Quick Search / Paste URL Bar */}
      <div className="flex-1 max-w-md mx-4">
        <div
          onClick={handleSearchFocus}
          className="relative flex items-center h-8 px-2.5 rounded-md bg-gatefold-surface border border-gatefold-line hover:border-gatefold-line-2 cursor-pointer transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-gatefold-text-3 mr-2" />
          <span className="text-xs text-gatefold-text-3 flex-1 truncate">
            Quick search or paste YouTube link...
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-gatefold-text-3 bg-gatefold-surface-2 border border-gatefold-line rounded">
            Ctrl+F
          </kbd>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Quality Mode Pill */}
        <button
          onClick={cycleQualityMode}
          title="Toggle Hardware Quality Profile (Ctrl+Q)"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition-colors ${getQualityBadgeColor()}`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="uppercase">{mode}</span>
          <span className="text-[10px] opacity-75">({metrics.fps} FPS)</span>
        </button>

        {/* Telemetry Toggle */}
        <button
          onClick={toggleTelemetry}
          title="Toggle Diagnostics & Telemetry (Ctrl+Shift+D)"
          className="p-1.5 rounded-md text-gatefold-text-3 hover:text-gatefold-text hover:bg-gatefold-hover border border-transparent hover:border-gatefold-line transition-colors"
          aria-label="Diagnostics"
        >
          <Activity className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-gatefold-line mx-1" />

        {/* Minimal Window Controls */}
        <div className="flex items-center gap-1 text-gatefold-text-3">
          <button
            className="p-1.5 rounded hover:bg-gatefold-hover hover:text-gatefold-text transition-colors"
            aria-label="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-gatefold-hover hover:text-gatefold-text transition-colors"
            aria-label="Maximize"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

