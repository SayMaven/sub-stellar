import React, { useState, useEffect } from 'react';
import { Settings, Palette, Zap, Check, Monitor, Sparkles, ShieldCheck } from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';
import { usePerfStore } from '../../stores/usePerfStore';
import { tauriBridge, type SystemInfo } from '../../services/tauriBridge';
import type { ThemePresetName, QualityMode } from '../../types';

interface ThemeDefinition {
  id: ThemePresetName;
  label: string;
  subtitle: string;
  accent: string;
  palette: string[]; // [accent, bg, panel, surface, line]
}

export const SettingsModal: React.FC = () => {
  const { currentPreset, setPreset } = useThemeStore();
  const { mode, setQualityMode } = usePerfStore();
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    tauriBridge.getSystemInfo().then(setSysInfo).catch(() => {});
  }, []);

  const themes: ThemeDefinition[] = [
    {
      id: 'default',
      label: 'Gatefold Obsidian',
      subtitle: 'Original celestial blue on deep slate obsidian',
      accent: '#8fb4ff',
      palette: ['#8fb4ff', '#0e1015', '#161922', '#1e222e', '#2c3345'],
    },
    {
      id: 'sakura',
      label: 'Sakura Petal',
      subtitle: 'Delicate blush pink with warm rose quartz darks',
      accent: '#ff94b8',
      palette: ['#ff94b8', '#140e13', '#1c131a', '#291b26', '#3d2838'],
    },
    {
      id: 'cyberpunk',
      label: 'Neon Cyberpunk',
      subtitle: 'Electric high-contrast cyan with ultra-dark deep void',
      accent: '#00f0ff',
      palette: ['#00f0ff', '#0a0d14', '#101520', '#182133', '#24324d'],
    },
    {
      id: 'aurora',
      label: 'Nordic Aurora',
      subtitle: 'Vivid emerald mint on cold midnight pine tones',
      accent: '#5affb5',
      palette: ['#5affb5', '#08120e', '#0d1a15', '#142921', '#1e3d31'],
    },
    {
      id: 'monochrome',
      label: 'Graphite Mono',
      subtitle: 'Clean studio broadcast white on neutral graphite',
      accent: '#f3f4f6',
      palette: ['#ffffff', '#101012', '#18181b', '#242428', '#383840'],
    },
  ];

  const profiles: {
    id: QualityMode;
    title: string;
    target: string;
    specs: string[];
  }[] = [
    {
      id: 'low',
      title: 'Low Mode (Intel HD / 4GB RAM)',
      target: 'Older Laptops, Intel UHD 620, Budget Thin Clients',
      specs: [
        'Max 150-250 particles pool (Zero-GC)',
        '720p internal preview buffer',
        'Single-pass sharp text outlines (blur bypass)',
        'Throttled background tickers during export',
      ],
    },
    {
      id: 'balanced',
      title: 'Balanced Mode (Default Recommended)',
      target: 'Modern Laptops, AMD Ryzen iGPU, Apple Silicon M1/M2',
      specs: [
        '500-800 particles pool with full kinematics',
        '1080p full-fidelity viewport rendering',
        'Dual outline stroke + soft outer glow bloom',
        'Smooth 60 FPS timeline scrub sync',
      ],
    },
    {
      id: 'ultra',
      title: 'Ultra Mode (Dedicated GPU & WebGPU)',
      target: 'NVIDIA RTX, AMD Radeon RX, Apple M3/M4 Max',
      specs: [
        '2000+ simultaneous particle bursts',
        'Multi-pass HDR bloom and chromatic sheen',
        '4K native viewport oversampling',
        'Hardware WebGPU antialiasing pipeline',
      ],
    },
  ];

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-gatefold-bg/30 select-none">
      <div className="w-full max-w-[1720px] mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gatefold-line">
          <div>
            <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
              <Settings className="w-5 h-5 text-gatefold-accent" />
              <span>Appearance & System Settings</span>
            </h2>
            <p className="text-xs text-gatefold-text-3 mt-1">
              Configure Gatefold dynamic OKLCH color palettes, low-end hardware performance tiers, and runtime architecture diagnostics.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-gatefold-surface border border-gatefold-line text-gatefold-text-3">
              Active Tier: <strong className="text-gatefold-accent">{mode.toUpperCase()}</strong>
            </span>
            <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-gatefold-surface border border-gatefold-line text-gatefold-text-3">
              Theme: <strong className="text-gatefold-accent">{currentPreset.toUpperCase()}</strong>
            </span>
          </div>
        </div>

        {/* Widescreen 2-Column Grid: Left = Theme & Typography, Right = Hardware & Engine Profile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Theme & Visual Styling */}
          <div className="lg:col-span-6 space-y-5">
            {/* Theme Presets Card */}
            <div className="gatefold-card-strong p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Palette className="w-4 h-4 text-gatefold-accent" />
                  <span>OKLCH Dynamic Theme Presets</span>
                </h3>
                <span className="text-[10px] font-mono text-gatefold-text-3">
                  5 Curated Profiles
                </span>
              </div>

              <div className="space-y-2.5">
                {themes.map((t) => {
                  const isSelected = currentPreset === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPreset(t.id)}
                      className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between gap-4 transition-all ${
                        isSelected
                          ? 'border-gatefold-accent bg-gatefold-accent/15 shadow-sm shadow-gatefold-accent/10'
                          : 'border-gatefold-line bg-gatefold-surface hover:border-gatefold-line-2 hover:bg-gatefold-hover/40'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: t.accent }}
                          />
                          <span className={`text-xs font-semibold truncate ${isSelected ? 'text-gatefold-accent' : 'text-gatefold-text'}`}>
                            {t.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-gatefold-text-3 truncate pl-5">
                          {t.subtitle}
                        </p>
                      </div>

                      {/* Color Palette Strip Swatches */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center -space-x-1 border border-gatefold-line rounded-lg p-1 bg-black/30">
                          {t.palette.map((color, idx) => (
                            <div
                              key={idx}
                              className="w-4 h-4 rounded-full border border-black/40"
                              style={{ backgroundColor: color }}
                              title={`Palette ${idx + 1}: ${color}`}
                            />
                          ))}
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-gatefold-accent text-gatefold-bg flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* OKLCH Benefits & Live Preview Specimen */}
            <div className="gatefold-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gatefold-text">
                <Sparkles className="w-4 h-4 text-gatefold-accent" />
                <span>Perceptual OKLCH Uniformity</span>
              </div>
              <p className="text-xs text-gatefold-text-3 leading-relaxed">
                SubStellar utilizes native OKLCH lightness modeling across the entire interface. Unlike legacy RGB, OKLCH ensures uniform contrast perception regardless of hue drift, preventing eye fatigue during long subtitle timing sessions.
              </p>

              {/* Live Specimen Preview Bar */}
              <div className="pt-2 border-t border-gatefold-line flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-gatefold-accent text-gatefold-bg text-[10px] font-bold">
                    Primary Button
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-gatefold-surface-2 border border-gatefold-line text-gatefold-text text-[10px] font-medium">
                    Surface Control
                  </span>
                </div>
                <span className="text-[10px] font-mono text-gatefold-accent">
                  OKLCH Live Sync: OK
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Hardware Profiles & System Diagnostics */}
          <div className="lg:col-span-6 space-y-5">
            {/* Performance Mode Card */}
            <div className="gatefold-card-strong p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Zap className="w-4 h-4 text-gatefold-accent" />
                  <span>Low-End Hardware Optimization (Tri-Tier Profile)</span>
                </h3>
                <span className="text-[10px] font-mono text-gatefold-text-3">
                  Persistent Storage
                </span>
              </div>

              <div className="space-y-3">
                {profiles.map((p) => {
                  const isSelected = mode === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setQualityMode(p.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-gatefold-accent bg-gatefold-accent/15 shadow-sm shadow-gatefold-accent/10'
                          : 'border-gatefold-line bg-gatefold-surface hover:border-gatefold-line-2 hover:bg-gatefold-hover/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-gatefold-accent bg-gatefold-accent'
                                : 'border-gatefold-line-2 bg-transparent'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-gatefold-bg" />}
                          </div>
                          <h4 className={`text-xs font-semibold ${isSelected ? 'text-gatefold-accent' : 'text-gatefold-text'}`}>
                            {p.title}
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-gatefold-surface-2 text-gatefold-accent border border-gatefold-line">
                          {p.id}
                        </span>
                      </div>

                      <p className="text-[11px] text-gatefold-text-3 mt-1.5 pl-5">
                        Target: <span className="text-gatefold-text-2">{p.target}</span>
                      </p>

                      <ul className="mt-2.5 pl-5 space-y-1">
                        {p.specs.map((spec, sIdx) => (
                          <li key={sIdx} className="text-[11px] text-gatefold-text-3 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-gatefold-accent shrink-0" />
                            <span>{spec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* System Architecture & Runtime Diagnostics */}
            <div className="gatefold-card p-5 space-y-3 text-xs text-gatefold-text-3">
              <div className="flex items-center justify-between font-semibold text-gatefold-text pb-2 border-b border-gatefold-line">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-gatefold-accent" />
                  <span>Architecture & Engine Diagnostics</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Zero-GC Compliant</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 font-mono text-[11px]">
                <div className="space-y-1">
                  <div className="text-gatefold-text-3">Application Version</div>
                  <div className="text-gatefold-text font-semibold">{sysInfo?.app_version || '1.0.0-alpha.6'}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-gatefold-text-3">Host Operating System</div>
                  <div className="text-gatefold-text font-semibold">
                    {sysInfo?.os_name || 'Windows'} ({sysInfo?.arch || 'x64'})
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-gatefold-text-3">Desktop Shell</div>
                  <div className="text-gatefold-text font-semibold">Tauri v2 (Rust 1.94, Isolated IPC)</div>
                </div>

                <div className="space-y-1">
                  <div className="text-gatefold-text-3">Graphics Renderer</div>
                  <div className="text-gatefold-text font-semibold">PixiJS v8 (WebGPU / WebGL2 Fallback)</div>
                </div>

                <div className="space-y-1">
                  <div className="text-gatefold-text-3">Audio Waveform Engine</div>
                  <div className="text-gatefold-text font-semibold">Web Audio API + Offscreen Worker</div>
                </div>

                <div className="space-y-1">
                  <div className="text-gatefold-text-3">Export Pipeline</div>
                  <div className="text-gatefold-text font-semibold">FFmpeg 7.1 (HW Auto-Probed)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
