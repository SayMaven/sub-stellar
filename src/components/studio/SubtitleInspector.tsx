import React, { useState } from 'react';
import {
  Type,
  Clock,
  Sparkles,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Wand2,
  Flame,
} from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import type { ParticlePresetType } from '../../types';

export const SubtitleInspector: React.FC = () => {
  const [tab, setTab] = useState<'text' | 'style' | 'particles' | 'presets'>('text');
  const {
    lines,
    selectedLineId,
    setSelectedLineId,
    updateLineText,
    updateLineTiming,
    style,
    setStyle,
    seek,
  } = useStudioStore();

  const activeIndex = lines.findIndex((l) => l.id === selectedLineId);
  const activeLine = lines[activeIndex] || lines[0];

  const handlePrevLine = () => {
    if (activeIndex > 0) {
      const prev = lines[activeIndex - 1];
      setSelectedLineId(prev.id);
      seek(prev.startTime);
    }
  };

  const handleNextLine = () => {
    if (activeIndex < lines.length - 1) {
      const next = lines[activeIndex + 1];
      setSelectedLineId(next.id);
      seek(next.startTime);
    }
  };

  if (!activeLine) {
    return (
      <div className="w-80 border-l border-gatefold-line bg-gatefold-surface p-4 text-xs text-gatefold-text-3">
        No subtitle line selected.
      </div>
    );
  }

  return (
    <aside className="w-80 border-l border-gatefold-line bg-gatefold-panel-strong backdrop-blur-md flex flex-col h-full text-xs select-none">
      {/* Inspector Tabs */}
      <div className="h-10 px-2 border-b border-gatefold-line flex items-center justify-between bg-gatefold-panel">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('text')}
            className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1.5 ${
              tab === 'text'
                ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40 font-semibold'
                : 'text-gatefold-text-3 hover:text-gatefold-text'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Line & Ruby</span>
          </button>
          <button
            onClick={() => setTab('style')}
            className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1.5 ${
              tab === 'style'
                ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40 font-semibold'
                : 'text-gatefold-text-3 hover:text-gatefold-text'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Typography</span>
          </button>
          <button
            onClick={() => setTab('particles')}
            className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1.5 ${
              tab === 'particles'
                ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40 font-semibold'
                : 'text-gatefold-text-3 hover:text-gatefold-text'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Particles</span>
          </button>
          <button
            onClick={() => setTab('presets')}
            className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1.5 ${
              tab === 'presets'
                ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40 font-semibold'
                : 'text-gatefold-text-3 hover:text-gatefold-text'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Presets</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {tab === 'text' && (
          <>
            {/* Line Navigation */}
            <div className="flex items-center justify-between pb-2 border-b border-gatefold-line">
              <span className="font-mono text-gatefold-text-3">
                Line {activeIndex + 1} of {lines.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevLine}
                  disabled={activeIndex <= 0}
                  className="p-1 rounded hover:bg-gatefold-hover disabled:opacity-30"
                  title="Previous Line"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextLine}
                  disabled={activeIndex >= lines.length - 1}
                  className="p-1 rounded hover:bg-gatefold-hover disabled:opacity-30"
                  title="Next Line"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Timing Inputs */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold">
                Timing (Seconds)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gatefold-text-3 block">Start Time</label>
                  <input
                    type="number"
                    step={0.05}
                    value={activeLine.startTime}
                    onChange={(e) =>
                      updateLineTiming(
                        activeLine.id,
                        parseFloat(e.target.value) || 0,
                        activeLine.endTime
                      )
                    }
                    className="w-full px-2 py-1 bg-gatefold-surface border border-gatefold-line rounded font-mono text-xs focus:border-gatefold-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gatefold-text-3 block">End Time</label>
                  <input
                    type="number"
                    step={0.05}
                    value={activeLine.endTime}
                    onChange={(e) =>
                      updateLineTiming(
                        activeLine.id,
                        activeLine.startTime,
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full px-2 py-1 bg-gatefold-surface border border-gatefold-line rounded font-mono text-xs focus:border-gatefold-accent focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-between text-[11px] text-gatefold-text-3 pt-1">
                <span>Duration: {(activeLine.endTime - activeLine.startTime).toFixed(2)}s</span>
                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      updateLineTiming(
                        activeLine.id,
                        activeLine.startTime - 0.1,
                        activeLine.endTime - 0.1
                      )
                    }
                    className="px-1.5 py-0.5 rounded bg-gatefold-surface-2 hover:bg-gatefold-hover"
                  >
                    -0.1s
                  </button>
                  <button
                    onClick={() =>
                      updateLineTiming(
                        activeLine.id,
                        activeLine.startTime + 0.1,
                        activeLine.endTime + 0.1
                      )
                    }
                    className="px-1.5 py-0.5 rounded bg-gatefold-surface-2 hover:bg-gatefold-hover"
                  >
                    +0.1s
                  </button>
                </div>
              </div>
            </div>

            {/* Markdown Ruby Text Editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold">
                  Subtitle Text & Ruby
                </span>
                <span className="text-[10px] text-gatefold-accent font-mono">
                  {`{Kanji|Ruby}`} format
                </span>
              </div>
              <textarea
                rows={2}
                value={activeLine.text}
                onChange={(e) => updateLineText(activeLine.id, e.target.value)}
                placeholder="もう{何|なに}もいらない"
                className="w-full px-2.5 py-1.5 bg-gatefold-surface border border-gatefold-line rounded font-mono text-xs text-gatefold-text focus:border-gatefold-accent focus:outline-none resize-none"
              />
            </div>

            {/* Tokenized Ruby Badges */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold">
                Detected Syllables ({activeLine.tokens.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {activeLine.tokens.map((tok, i) => (
                  <div
                    key={i}
                    className="px-2 py-1 rounded bg-gatefold-surface border border-gatefold-line flex flex-col items-center"
                  >
                    {tok.ruby && (
                      <span className="text-[9px] font-bold text-gatefold-accent font-mono leading-none">
                        {tok.ruby}
                      </span>
                    )}
                    <span className="text-xs font-medium text-gatefold-text leading-tight">
                      {tok.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Translation */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold">
                Secondary Translation
              </span>
              <input
                type="text"
                value={activeLine.translation || ''}
                readOnly
                className="w-full px-2 py-1 bg-gatefold-surface/60 border border-gatefold-line rounded text-gatefold-text-2 text-xs"
              />
            </div>
          </>
        )}

        {tab === 'style' && (
          <>
            {/* Font & Size */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gatefold-text">Font Size</span>
                <span className="font-mono text-gatefold-text-3">{style.fontSize}px</span>
              </div>
              <input
                type="range"
                min={24}
                max={96}
                value={style.fontSize}
                onChange={(e) => setStyle({ fontSize: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
              />
            </div>

            {/* Ruby Scale */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gatefold-text">Furigana Scale</span>
                <span className="font-mono text-gatefold-text-3">
                  {Math.round(style.rubyScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={70}
                value={Math.round(style.rubyScale * 100)}
                onChange={(e) => setStyle({ rubyScale: parseInt(e.target.value, 10) / 100 })}
                className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
              />
            </div>

            {/* Outer Stroke */}
            <div className="space-y-2 pt-2 border-t border-gatefold-line">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gatefold-text">Outer Stroke (Dark)</span>
                <span className="font-mono text-gatefold-text-3">{style.outerStrokeWidth}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={style.outerStrokeWidth}
                onChange={(e) => setStyle({ outerStrokeWidth: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
              />
            </div>

            {/* Inner Glow Stroke */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gatefold-text">Inner Glow Width</span>
                <span className="font-mono text-gatefold-text-3">{style.innerStrokeWidth}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={style.innerStrokeWidth}
                onChange={(e) => setStyle({ innerStrokeWidth: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
              />
            </div>

            {/* Y-Offset Position */}
            <div className="space-y-2 pt-2 border-t border-gatefold-line">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gatefold-text">Y-Position Offset</span>
                <span className="font-mono text-gatefold-text-3">{style.yOffset}px</span>
              </div>
              <input
                type="range"
                min={20}
                max={160}
                value={style.yOffset}
                onChange={(e) => setStyle({ yOffset: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
              />
            </div>

            {/* Safe Guides Toggle */}
            <div className="pt-2 border-t border-gatefold-line flex items-center justify-between">
              <span className="font-semibold text-gatefold-text">Title & Action Safe Guides</span>
              <button
                onClick={() => setStyle({ showSafeGuides: !style.showSafeGuides })}
                className={`p-1.5 rounded transition-colors ${
                  style.showSafeGuides
                    ? 'bg-gatefold-accent/20 text-gatefold-accent'
                    : 'text-gatefold-text-3 hover:bg-gatefold-hover'
                }`}
              >
                {style.showSafeGuides ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </>
        )}

        {tab === 'particles' && (
          <div className="space-y-4">
            {/* Master Toggle */}
            <div className="flex items-center justify-between pb-2 border-b border-gatefold-line">
              <div>
                <span className="font-semibold text-gatefold-text block">Particle Engine</span>
                <span className="text-[10px] text-gatefold-text-3">Zero-GC ParticleContainer</span>
              </div>
              <button
                onClick={() => setStyle({ particleEnabled: !style.particleEnabled })}
                className={`p-1.5 rounded transition-colors ${
                  style.particleEnabled
                    ? 'bg-gatefold-accent/20 text-gatefold-accent'
                    : 'text-gatefold-text-3 hover:bg-gatefold-hover'
                }`}
                title={style.particleEnabled ? 'Disable Particles' : 'Enable Particles'}
              >
                {style.particleEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>

            {/* Particle Preset Selector */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold">
                Stellar Preset
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['stardust', 'sparkle', 'cosmic'] as ParticlePresetType[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setStyle({ particlePreset: preset })}
                    className={`py-2 px-1 text-center rounded border capitalize transition-colors flex flex-col items-center gap-1 ${
                      style.particlePreset === preset
                        ? 'border-gatefold-accent bg-gatefold-accent/15 text-gatefold-accent font-semibold'
                        : 'border-gatefold-line bg-gatefold-surface text-gatefold-text-3 hover:text-gatefold-text'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="text-[11px]">{preset}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Burst Count Slider */}
            <div className="space-y-2 pt-2 border-t border-gatefold-line">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gatefold-text">Syllable Burst Count</span>
                <span className="font-mono text-gatefold-text-3">{style.particleBurstCount} particles</span>
              </div>
              <input
                type="range"
                min={5}
                max={40}
                step={5}
                value={style.particleBurstCount}
                onChange={(e) => setStyle({ particleBurstCount: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
              />
              <p className="text-[10px] text-gatefold-text-3">
                Particles spawned dynamically on each lyric syllable transition.
              </p>
            </div>

            {/* Manual Test Burst Button */}
            <div className="pt-2 border-t border-gatefold-line">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('substellar:trigger-burst'));
                }}
                disabled={!style.particleEnabled}
                className="w-full py-2 px-3 rounded-lg bg-gatefold-accent/20 border border-gatefold-accent/40 text-gatefold-accent hover:bg-gatefold-accent/30 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Flame className="w-4 h-4" />
                <span>Test Particle Burst</span>
              </button>
            </div>
          </div>
        )}

        {tab === 'presets' && (
          <div className="space-y-2">
            {[
              {
                name: 'J-Pop Starlight (Cyan)',
                style: {
                  fontSize: 54,
                  outerStrokeWidth: 8,
                  innerStrokeWidth: 2,
                  innerStrokeColor: '#8fb4ff',
                  glowColor: '#5770b0',
                },
              },
              {
                name: 'Neon Shinjuku (Magenta)',
                style: {
                  fontSize: 52,
                  outerStrokeWidth: 10,
                  innerStrokeWidth: 3,
                  innerStrokeColor: '#ff007f',
                  glowColor: '#ff007f',
                },
              },
              {
                name: 'Sakura Petal (Pink)',
                style: {
                  fontSize: 50,
                  outerStrokeWidth: 6,
                  innerStrokeWidth: 2,
                  innerStrokeColor: '#ff94b8',
                  glowColor: '#b84f7b',
                },
              },
              {
                name: 'Clean Minimalist',
                style: {
                  fontSize: 48,
                  outerStrokeWidth: 6,
                  innerStrokeWidth: 0,
                  innerStrokeColor: '#ffffff',
                  glowColor: '#000000',
                },
              },
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => setStyle(p.style)}
                className="w-full p-2.5 rounded-lg border border-gatefold-line bg-gatefold-surface hover:border-gatefold-accent/50 text-left transition-colors flex items-center justify-between"
              >
                <span className="font-medium text-gatefold-text">{p.name}</span>
                <Wand2 className="w-3.5 h-3.5 text-gatefold-accent" />
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
