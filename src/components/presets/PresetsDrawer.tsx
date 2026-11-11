import React, { useState, useMemo } from 'react';
import { Sliders, Check, ArrowRight } from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { VISUAL_PRESETS, type VisualPreset } from '../../engine/presets/presetRegistry';

export const PresetsDrawer: React.FC = () => {
  const { setStyle, setActiveTab } = useStudioStore();
  const { setPreset } = useThemeStore();
  const [activePresetId, setActivePresetId] = useState<string>('jpop-starlight');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    for (const p of VISUAL_PRESETS) {
      set.add(p.category);
    }
    return Array.from(set);
  }, []);

  const filteredPresets = useMemo(() => {
    if (selectedCategory === 'All') return VISUAL_PRESETS;
    return VISUAL_PRESETS.filter((p) => p.category === selectedCategory);
  }, [selectedCategory]);

  const handleApplyPreset = (preset: VisualPreset) => {
    setActivePresetId(preset.id);
    setStyle(preset.style);
    if (preset.theme) {
      setPreset(preset.theme);
    }
  };

  const handleApplyAndGo = (preset: VisualPreset) => {
    handleApplyPreset(preset);
    setActiveTab('studio');
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-gatefold-bg/30 select-none">
      <div className="w-full max-w-[1720px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
              <Sliders className="w-5 h-5 text-gatefold-accent" />
              <span>Visual Presets & Particle Library</span>
            </h2>
            <p className="text-xs text-gatefold-text-3 mt-1">
              Curated J-Pop MV typography, stroke shaders, vocal animations, and procedural particle systems ({VISUAL_PRESETS.length} presets available).
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-gatefold-accent text-gatefold-bg font-semibold'
                    : 'bg-gatefold-surface border border-gatefold-line text-gatefold-text-3 hover:text-gatefold-text hover:border-gatefold-line-2'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Widescreen Responsive Preset Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredPresets.map((preset) => {
            const isActive = activePresetId === preset.id;

            return (
              <div
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className={`gatefold-card p-4 flex flex-col justify-between transition-all cursor-pointer ${
                  isActive
                    ? 'border-gatefold-accent bg-gatefold-accent/10 shadow-lg shadow-gatefold-accent/5'
                    : 'hover:border-gatefold-line-2 hover:bg-gatefold-surface/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
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
                    className={`h-24 w-full rounded-lg bg-gradient-to-br ${preset.gradientBadge} mb-3 flex flex-col items-center justify-center p-3 shadow-inner relative overflow-hidden`}
                  >
                    <span
                      className="text-[11px] font-bold leading-none mb-1 font-mono tracking-wider"
                      style={{
                        color: preset.style.rubyActiveColor || preset.style.rubyFillColor || '#fff',
                        textShadow: `0 0 6px ${preset.style.glowColor || 'rgba(0,0,0,0.5)'}`,
                      }}
                    >
                      ほしぞら
                    </span>
                    <span
                      className="text-base font-bold leading-none"
                      style={{
                        color: preset.style.wordActiveColor || preset.style.fillColor || '#fff',
                        WebkitTextStroke: `${preset.style.innerStrokeWidth || 1}px ${preset.style.innerStrokeColor || '#000'}`,
                        textShadow: `0 0 10px ${preset.style.glowColor || 'rgba(0,0,0,0.8)'}`,
                      }}
                    >
                      星空の歌
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-gatefold-text">
                    {preset.name}
                  </h3>
                  <p className="text-[11px] text-gatefold-text-3 mt-1 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-gatefold-line flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/40"
                      style={{ background: preset.style.wordActiveColor }}
                      title="Word Active Color"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/40"
                      style={{ background: preset.style.fillColor }}
                      title="Text Fill Color"
                    />
                    <span className="text-[10px] font-mono text-gatefold-accent uppercase ml-1">
                      {preset.style.particlePreset}
                    </span>
                  </div>

                  <button
                    type="button"
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
