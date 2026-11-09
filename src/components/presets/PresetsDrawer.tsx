import React from 'react';
import { Sliders, Sparkles, Check } from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';

interface Preset {
  id: string;
  name: string;
  category: 'Japanese MV' | 'Cyberpunk' | 'Anime' | 'Minimalist';
  description: string;
  previewColor: string;
}

const PRESETS: Preset[] = [
  {
    id: 'jpop-glow',
    name: 'J-Pop Starlight (Default)',
    category: 'Japanese MV',
    description: 'Double outline stroke with cyan stardust particles and ruby furigana.',
    previewColor: 'from-sky-400 to-indigo-500',
  },
  {
    id: 'cyberpunk-neon',
    name: 'Neo Shinjuku Cyberpunk',
    category: 'Cyberpunk',
    description: 'Electric cyan inner glow with hot magenta bursts and scanline aesthetics.',
    previewColor: 'from-cyan-400 to-fuchsia-500',
  },
  {
    id: 'sakura-blossom',
    name: 'Sakura Petal Dream',
    category: 'Anime',
    description: 'Soft pink glow with gentle drifting sakura blossom particles.',
    previewColor: 'from-pink-300 to-rose-500',
  },
  {
    id: 'minimal-cinema',
    name: 'Cinematic Minimalist',
    category: 'Minimalist',
    description: 'Crisp typography with pure black outline and zero-distraction particle haze.',
    previewColor: 'from-zinc-200 to-zinc-500',
  },
];

export const PresetsDrawer: React.FC = () => {
  const { setActiveTab } = useStudioStore();

  const handleSelectPreset = () => {
    setActiveTab('studio');
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gatefold-bg/30 backdrop-blur-sm select-none">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
            <Sliders className="w-6 h-6 text-gatefold-accent" />
            <span>Visual Presets & Particle Library</span>
          </h2>
          <p className="text-sm text-gatefold-text-3 mt-1">
            Choose pre-engineered subtitle typography, outline stroke thickness, and particle shaders.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRESETS.map((preset, idx) => (
            <div
              key={preset.id}
              className="gatefold-card p-5 flex flex-col justify-between hover:border-gatefold-accent/50 transition-all cursor-pointer group"
              onClick={handleSelectPreset}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-gatefold-surface-2 text-gatefold-text-3 border border-gatefold-line">
                    {preset.category}
                  </span>
                  {idx === 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-gatefold-accent">
                      <Sparkles className="w-3 h-3" />
                      Active Preset
                    </span>
                  )}
                </div>

                <div
                  className={`h-16 w-full rounded-lg bg-gradient-to-r ${preset.previewColor} mb-4 flex items-center justify-center p-3 shadow-inner`}
                >
                  <span className="text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    もう何もいらない
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-gatefold-text group-hover:text-gatefold-accent transition-colors">
                  {preset.name}
                </h3>
                <p className="text-xs text-gatefold-text-3 mt-1 line-clamp-2">
                  {preset.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-gatefold-line flex justify-end">
                <button className="px-3 py-1.5 rounded-md bg-gatefold-surface-2 group-hover:bg-gatefold-accent group-hover:text-gatefold-bg text-xs font-semibold text-gatefold-text transition-colors flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply Preset</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
