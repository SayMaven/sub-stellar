import React from 'react';
import { Settings, Palette, Zap, Info } from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';
import { usePerfStore } from '../../stores/usePerfStore';
import type { ThemePresetName, QualityMode } from '../../types';

export const SettingsModal: React.FC = () => {
  const { currentPreset, setPreset } = useThemeStore();
  const { mode, setQualityMode } = usePerfStore();

  const themes: { id: ThemePresetName; label: string; swatch: string }[] = [
    { id: 'default', label: 'Gatefold Obsidian', swatch: 'bg-[#8fb4ff]' },
    { id: 'sakura', label: 'Sakura Petal', swatch: 'bg-[#ff94b8]' },
    { id: 'cyberpunk', label: 'Neon Cyberpunk', swatch: 'bg-[#00f0ff]' },
    { id: 'aurora', label: 'Nordic Aurora', swatch: 'bg-[#5affb5]' },
    { id: 'monochrome', label: 'Graphite Mono', swatch: 'bg-[#ffffff]' },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gatefold-bg/30 backdrop-blur-sm select-none">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
            <Settings className="w-6 h-6 text-gatefold-accent" />
            <span>Appearance & System Settings</span>
          </h2>
          <p className="text-sm text-gatefold-text-3 mt-1">
            Configure Gatefold dynamic OKLCH color palettes, hardware quality tiers, and system preferences.
          </p>
        </div>

        {/* Theme Settings Card */}
        <div className="gatefold-card-strong p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider flex items-center gap-2">
            <Palette className="w-4 h-4 text-gatefold-accent" />
            <span>OKLCH Dynamic Theme Presets</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setPreset(t.id)}
                className={`p-3 rounded-lg border text-left flex items-center gap-3 transition-all ${
                  currentPreset === t.id
                    ? 'border-gatefold-accent bg-gatefold-accent/15 text-gatefold-accent font-medium'
                    : 'border-gatefold-line bg-gatefold-surface text-gatefold-text hover:border-gatefold-line-2'
                }`}
              >
                <div className={`w-4 h-4 rounded-full ${t.swatch} border border-white/20`} />
                <span className="text-xs truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Performance Mode Card */}
        <div className="gatefold-card-strong p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-gatefold-accent" />
            <span>Low-End Hardware Optimization (Tri-Tier Profile)</span>
          </h3>

          <div className="space-y-2">
            {[
              {
                id: 'low',
                title: 'Low Mode (Mandatory for Intel HD / 4GB RAM)',
                desc: '150-250 particles, soft text outline without heavy blur pass, 720p internal preview.',
              },
              {
                id: 'balanced',
                title: 'Balanced Mode (Default for Modern Laptops)',
                desc: '500-800 particles, standard bloom pass, 1080p preview.',
              },
              {
                id: 'ultra',
                title: 'Ultra Mode (Dedicated GPU & WebGPU)',
                desc: '2000+ particles, multi-pass bloom, WebGPU antialiasing.',
              },
            ].map((p) => (
              <div
                key={p.id}
                onClick={() => setQualityMode(p.id as QualityMode)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  mode === p.id
                    ? 'border-gatefold-accent bg-gatefold-accent/10'
                    : 'border-gatefold-line bg-gatefold-surface hover:border-gatefold-line-2'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gatefold-text">{p.title}</h4>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-gatefold-surface-2 text-gatefold-accent">
                    {p.id}
                  </span>
                </div>
                <p className="text-xs text-gatefold-text-3 mt-1">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* System & Architecture Info */}
        <div className="gatefold-card p-4 space-y-2 text-xs text-gatefold-text-3">
          <div className="flex items-center gap-2 font-semibold text-gatefold-text">
            <Info className="w-4 h-4 text-gatefold-accent" />
            <span>Architecture & Build Information</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
            <div>App Version: 1.0.0-alpha.1</div>
            <div>Desktop Shell: Tauri v2 (Rust 1.94)</div>
            <div>Rendering Canvas: PixiJS v8 (WebGPU / WebGL)</div>
            <div>CSS Theming: Gatefold OKLCH @property</div>
          </div>
        </div>
      </div>
    </div>
  );
};
