import React, { useState } from 'react';
import { Sliders, Check, ArrowRight } from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import { useThemeStore } from '../../stores/useThemeStore';
import type { SubtitleStyle, ThemePresetName } from '../../types';

interface PresetItem {
  id: string;
  name: string;
  category: 'Japanese MV' | 'Cyberpunk' | 'Anime' | 'Minimalist';
  description: string;
  gradient: string;
  theme: ThemePresetName;
  style: Partial<SubtitleStyle>;
}

const PRESETS: PresetItem[] = [
  {
    id: 'jpop-starlight',
    name: 'J-Pop Starlight (Default)',
    category: 'Japanese MV',
    description: 'Double outline stroke with cyan stardust particles and ruby furigana.',
    gradient: 'from-sky-500 via-indigo-500 to-purple-600',
    theme: 'default',
    style: {
      fontSize: 54,
      outerStrokeWidth: 8,
      outerStrokeColor: '#14161b',
      innerStrokeWidth: 2,
      innerStrokeColor: '#8fb4ff',
      glowColor: '#5770b0',
      rubyScale: 0.45,
      particlePreset: 'stardust',
      particleBurstCount: 15,
      particleEnabled: true,
    },
  },
  {
    id: 'cyberpunk-neon',
    name: 'Neo Shinjuku Cyberpunk',
    category: 'Cyberpunk',
    description: 'Electric cyan inner glow with hot magenta bursts and high-contrast dark outline.',
    gradient: 'from-cyan-400 via-fuchsia-500 to-rose-600',
    theme: 'cyberpunk',
    style: {
      fontSize: 52,
      outerStrokeWidth: 10,
      outerStrokeColor: '#0a0d14',
      innerStrokeWidth: 3,
      innerStrokeColor: '#ff007f',
      glowColor: '#ff007f',
      rubyScale: 0.45,
      particlePreset: 'sparkle',
      particleBurstCount: 25,
      particleEnabled: true,
    },
  },
  {
    id: 'sakura-blossom',
    name: 'Sakura Petal Dream',
    category: 'Anime',
    description: 'Soft pink glow with gentle drifting cosmic sakura particles.',
    gradient: 'from-pink-400 via-rose-400 to-purple-500',
    theme: 'sakura',
    style: {
      fontSize: 50,
      outerStrokeWidth: 6,
      outerStrokeColor: '#181216',
      innerStrokeWidth: 2,
      innerStrokeColor: '#ff94b8',
      glowColor: '#b84f7b',
      rubyScale: 0.42,
      particlePreset: 'cosmic',
      particleBurstCount: 20,
      particleEnabled: true,
    },
  },
  {
    id: 'aurora-boreal',
    name: 'Nordic Mint Aurora',
    category: 'Japanese MV',
    description: 'Radiant emerald mint outline with rising stellar stardust.',
    gradient: 'from-emerald-400 via-teal-500 to-sky-600',
    theme: 'aurora',
    style: {
      fontSize: 52,
      outerStrokeWidth: 8,
      outerStrokeColor: '#0d1615',
      innerStrokeWidth: 2,
      innerStrokeColor: '#5affb5',
      glowColor: '#2a8f6d',
      rubyScale: 0.45,
      particlePreset: 'stardust',
      particleBurstCount: 18,
      particleEnabled: true,
    },
  },
  {
    id: 'minimal-cinema',
    name: 'Cinematic Minimalist',
    category: 'Minimalist',
    description: 'Crisp typography with pure black outline and zero-distraction particle haze.',
    gradient: 'from-zinc-300 via-zinc-500 to-neutral-700',
    theme: 'monochrome',
    style: {
      fontSize: 48,
      outerStrokeWidth: 6,
      outerStrokeColor: '#000000',
      innerStrokeWidth: 0,
      innerStrokeColor: '#ffffff',
      glowColor: '#000000',
      rubyScale: 0.40,
      particlePreset: 'stardust',
      particleBurstCount: 5,
      particleEnabled: false,
    },
  },
];

export const PresetsDrawer: React.FC = () => {
  const { setStyle, setActiveTab } = useStudioStore();
  const { setPreset } = useThemeStore();
  const [activePresetId, setActivePresetId] = useState<string>('jpop-starlight');

  const handleApplyPreset = (preset: PresetItem) => {
    setActivePresetId(preset.id);
    setStyle(preset.style);
    setPreset(preset.theme);
  };

  const handleApplyAndGo = (preset: PresetItem) => {
    handleApplyPreset(preset);
    setActiveTab('studio');
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gatefold-bg/30 backdrop-blur-sm select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
            <Sliders className="w-5 h-5 text-gatefold-accent" />
            <span>Visual Presets & Particle Library</span>
          </h2>
          <p className="text-xs text-gatefold-text-3 mt-1">
            Choose pre-engineered subtitle typography, stroke thickness, particle shaders, and dynamic OKLCH color palettes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id;

            return (
              <div
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className={`gatefold-card p-5 flex flex-col justify-between transition-all cursor-pointer ${
                  isActive
                    ? 'border-gatefold-accent bg-gatefold-accent/10 shadow-[0_0_20px_rgba(143,180,255,0.2)]'
                    : 'hover:border-gatefold-line-2'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-gatefold-surface-2 text-gatefold-text-3 border border-gatefold-line">
                      {preset.category}
                    </span>
                    {isActive ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-gatefold-accent">
                        <Check className="w-3 h-3" />
                        Active
                      </span>
                    ) : null}
                  </div>

                  {/* Visual Preview Box */}
                  <div
                    className={`h-20 w-full rounded-lg bg-gradient-to-r ${preset.gradient} mb-3 flex flex-col items-center justify-center p-3 shadow-inner relative overflow-hidden`}
                  >
                    <span className="text-[10px] font-bold text-white/90 leading-none mb-0.5">
                      なに
                    </span>
                    <span className="text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none">
                      何
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-gatefold-text">
                    {preset.name}
                  </h3>
                  <p className="text-[11px] text-gatefold-text-3 mt-1 line-clamp-2">
                    {preset.description}
                  </p>
                </div>

                <div className="pt-3 mt-4 border-t border-gatefold-line flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gatefold-text-3 uppercase">
                    {preset.style.particlePreset} particles
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyAndGo(preset);
                    }}
                    className="px-2.5 py-1 rounded bg-gatefold-accent text-gatefold-bg hover:opacity-90 font-semibold text-[11px] transition-all flex items-center gap-1"
                  >
                    <span>Use in Studio</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
