import React from 'react';
import { usePerfStore } from '../../stores/usePerfStore';
import { Activity, X } from 'lucide-react';

export const TelemetryOverlay: React.FC = () => {
  const { metrics, mode, profile, showTelemetry, toggleTelemetry } = usePerfStore();

  if (!showTelemetry) return null;

  return (
    <div className="fixed top-14 right-4 z-50 w-72 gatefold-card-strong p-4 text-xs font-mono select-none">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gatefold-line">
        <div className="flex items-center gap-1.5 text-gatefold-accent font-semibold">
          <Activity className="w-3.5 h-3.5" />
          <span>Telemetry & Diagnostics</span>
        </div>
        <button
          onClick={toggleTelemetry}
          className="text-gatefold-text-3 hover:text-gatefold-text transition-colors p-0.5 rounded"
          aria-label="Close telemetry"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1.5 text-gatefold-text-2">
        <div className="flex justify-between">
          <span>Profile Mode:</span>
          <span className="uppercase font-bold text-gatefold-accent">{mode}</span>
        </div>
        <div className="flex justify-between">
          <span>Frame Rate:</span>
          <span className={metrics.fps >= 55 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
            {metrics.fps} FPS
          </span>
        </div>
        <div className="flex justify-between">
          <span>Frame Time:</span>
          <span>{metrics.frameTimeMs.toFixed(1)} ms</span>
        </div>
        <div className="flex justify-between">
          <span>Active Particles:</span>
          <span>
            {metrics.activeParticles} / {profile.maxParticles}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Est. RAM:</span>
          <span>~{metrics.memoryMbEst} MB</span>
        </div>
        <div className="flex justify-between">
          <span>Dropped Frames:</span>
          <span>{metrics.droppedFrames}</span>
        </div>
        <div className="flex justify-between">
          <span>Preview Canvas:</span>
          <span>{profile.previewResolution} ({profile.renderScale}x)</span>
        </div>
        <div className="flex justify-between">
          <span>Bloom Filter:</span>
          <span>{profile.bloomEnabled ? 'Active' : 'Disabled'}</span>
        </div>
      </div>
    </div>
  );
};

