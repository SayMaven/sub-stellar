import React, { useState, useEffect } from 'react';
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
  Plus,
  Copy,
  Trash2,
  RotateCcw,
  Crosshair,
  Palette,
  Scissors,
  Merge,
  Ban,
} from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import { FuriganaEditor } from '../furigana/FuriganaEditor';
import type { ParticlePresetType, WordAnimationStyle } from '../../types';

interface SubtitleInspectorProps {
  width?: number;
}

const SubtitleInspectorBody: React.FC = React.memo(() => {
  const [tab, setTab] = useState<'text' | 'colors' | 'style' | 'particles' | 'presets'>('text');
  const [selectedTokenIdx, setSelectedTokenIdx] = useState<number>(0);

  const lines = useStudioStore((s) => s.lines);
  const selectedLineId = useStudioStore((s) => s.selectedLineId);
  const setSelectedLineId = useStudioStore((s) => s.setSelectedLineId);
  const addLine = useStudioStore((s) => s.addLine);
  const duplicateLine = useStudioStore((s) => s.duplicateLine);
  const deleteLine = useStudioStore((s) => s.deleteLine);
  const updateLineTranslation = useStudioStore((s) => s.updateLineTranslation);
  const updateLineTiming = useStudioStore((s) => s.updateLineTiming);
  const updateTokenTiming = useStudioStore((s) => s.updateTokenTiming);
  const resetTokenTimingsEvenly = useStudioStore((s) => s.resetTokenTimingsEvenly);
  const splitTokenIntoChars = useStudioStore((s) => s.splitTokenIntoChars);
  const splitAllTokensIntoChars = useStudioStore((s) => s.splitAllTokensIntoChars);
  const mergeTokenWithNeighbor = useStudioStore((s) => s.mergeTokenWithNeighbor);
  const toggleTokenAnimDisabled = useStudioStore((s) => s.toggleTokenAnimDisabled);
  const setAllTokensAnimDisabled = useStudioStore((s) => s.setAllTokensAnimDisabled);
  const style = useStudioStore((s) => s.style);
  const setStyle = useStudioStore((s) => s.setStyle);
  const seek = useStudioStore((s) => s.seek);
  const setActiveTab = useStudioStore((s) => s.setActiveTab);

  // Only re-render when the active token index changes, not at 60 FPS!
  const playingTokenIdx = useStudioStore((s) => {
    const line = s.lines.find((l) => l.id === s.selectedLineId) || s.lines[0];
    if (!line || !line.tokens) return -1;
    return line.tokens.findIndex(
      (t) => s.currentTime >= t.startTime && s.currentTime < t.endTime
    );
  });

  const activeIndex = lines.findIndex((l) => l.id === selectedLineId);
  const activeLine = lines[activeIndex] || lines[0];

  useEffect(() => {
    setSelectedTokenIdx(0);
  }, [activeLine?.id]);

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
      <>
        <div className="h-10 px-3 border-b border-gatefold-line flex items-center text-gatefold-text-3 font-medium">
          Subtitle Inspector
        </div>
        <div className="flex-1 p-4 flex flex-col gap-3 text-gatefold-text-3">
          <p className="text-gatefold-text-2 font-medium">No subtitle line selected</p>
          <p>Create a new subtitle line or search synced lyrics to start editing.</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => addLine()}
              className="px-2.5 py-1.5 rounded bg-gatefold-accent text-gatefold-bg font-semibold flex items-center gap-1 hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Line</span>
            </button>
            <button
              onClick={() => setActiveTab('lyrics')}
              className="px-2.5 py-1.5 rounded border border-gatefold-line hover:border-gatefold-accent/50 text-gatefold-text hover:text-gatefold-accent"
            >
              Search Lyrics
            </button>
          </div>
        </div>
      </>
    );
  }

  const safeTokenIdx = Math.min(
    Math.max(0, selectedTokenIdx),
    Math.max(0, activeLine.tokens.length - 1)
  );
  const activeToken = activeLine.tokens[safeTokenIdx];

  const handleTokenDurationDelta = (deltaSec: number) => {
    if (!activeToken) return;
    const newEnd = Math.max(activeToken.startTime + 0.05, activeToken.endTime + deltaSec);
    updateTokenTiming(activeLine.id, safeTokenIdx, activeToken.startTime, newEnd);
  };

  const handleSnapTokenEndToPlayhead = () => {
    if (!activeToken) return;
    const nowTime = useStudioStore.getState().currentTime;
    if (nowTime > activeToken.startTime + 0.05 && nowTime <= activeLine.endTime) {
      updateTokenTiming(activeLine.id, safeTokenIdx, activeToken.startTime, nowTime);
      if (safeTokenIdx < activeLine.tokens.length - 1) {
        setSelectedTokenIdx(safeTokenIdx + 1);
      }
    }
  };

  const allTokensDisabled =
    activeLine.tokens.length > 0 && activeLine.tokens.every((t) => Boolean(t.disableAnim));
  const activeTokenCharCount = activeToken
    ? Array.from(activeToken.text).filter((c) => c.trim().length > 0).length
    : 0;

  return (
    <>
      {/* Inspector Tabs */}
      <div className="h-10 px-1.5 border-b border-gatefold-line flex items-center justify-between bg-gatefold-panel">
        <div className="flex gap-0.5 w-full justify-between">
          <button
            onClick={() => setTab('text')}
            className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              tab === 'text'
                ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40 font-semibold'
                : 'text-gatefold-text-3 hover:text-gatefold-text'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Line</span>
          </button>
          <button
            onClick={() => setTab('colors')}
            className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              tab === 'colors'
                ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40 font-semibold'
                : 'text-gatefold-text-3 hover:text-gatefold-text'
            }`}
          >
            <Palette className="w-3 h-3" />
            <span>Colors</span>
          </button>
          <button
            onClick={() => setTab('style')}
            className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              tab === 'style'
                ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40 font-semibold'
                : 'text-gatefold-text-3 hover:text-gatefold-text'
            }`}
          >
            <Type className="w-3 h-3" />
            <span>Style</span>
          </button>
          <button
            onClick={() => setTab('particles')}
            className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              tab === 'particles'
                ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40 font-semibold'
                : 'text-gatefold-text-3 hover:text-gatefold-text'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>FX</span>
          </button>
          <button
            onClick={() => setTab('presets')}
            className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              tab === 'presets'
                ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40 font-semibold'
                : 'text-gatefold-text-3 hover:text-gatefold-text'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span>Presets</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {tab === 'text' && (
          <>
            {/* Line Navigation & CRUD Actions */}
            <div className="flex items-center justify-between pb-2 border-b border-gatefold-line">
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevLine}
                  disabled={activeIndex <= 0}
                  className="p-1 rounded hover:bg-gatefold-hover disabled:opacity-30"
                  title="Previous Line"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-gatefold-text-2 text-[11px]">
                  Line {activeIndex + 1}/{lines.length}
                </span>
                <button
                  onClick={handleNextLine}
                  disabled={activeIndex >= lines.length - 1}
                  className="p-1 rounded hover:bg-gatefold-hover disabled:opacity-30"
                  title="Next Line"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => addLine()}
                  className="p-1 rounded bg-gatefold-accent/15 text-gatefold-accent hover:bg-gatefold-accent/25 border border-gatefold-accent/30"
                  title="Add New Line at Playhead (Ctrl+N)"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => duplicateLine(activeLine.id)}
                  className="p-1 rounded hover:bg-gatefold-hover text-gatefold-text-2 hover:text-gatefold-text border border-gatefold-line"
                  title="Duplicate Line"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteLine(activeLine.id)}
                  className="p-1 rounded hover:bg-red-500/20 text-gatefold-text-3 hover:text-red-400 border border-gatefold-line"
                  title="Delete Line (Delete)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Timing Inputs */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold">
                Line Timing (Seconds)
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

            {/* Subtitle Text, Reading (Furigana) & Raw Syntax */}
            <FuriganaEditor line={activeLine} />

            {/* Secondary Translation (Editable!) */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold">
                Secondary Translation
              </span>
              <input
                type="text"
                placeholder="Enter English / Indonesian translation..."
                value={activeLine.translation || ''}
                onChange={(e) => updateLineTranslation(activeLine.id, e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text text-xs focus:border-gatefold-accent focus:outline-none"
              />
            </div>

            {/* Per-Word Vocal Timing & Syllable Editor */}
            <div className="space-y-2 pt-2 border-t border-gatefold-line">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold">
                  Per-Word Vocal Timing ({activeLine.tokens.length})
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => splitAllTokensIntoChars(activeLine.id)}
                    title="Split all multi-character words in this line into individual characters"
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-gatefold-text-2 hover:text-gatefold-accent flex items-center gap-1"
                  >
                    <Scissors className="w-2.5 h-2.5" />
                    <span>All Chars</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllTokensAnimDisabled(activeLine.id, !allTokensDisabled)}
                    title={
                      allTokensDisabled
                        ? 'Re-enable vocal animation on all words in this line'
                        : 'Disable vocal animation on all words in this line'
                    }
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                      allTokensDisabled
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-gatefold-surface hover:bg-gatefold-hover border-gatefold-line text-gatefold-text-3 hover:text-gatefold-text'
                    }`}
                  >
                    <Ban className="w-2.5 h-2.5" />
                    <span>{allTokensDisabled ? 'All Muted' : 'Mute Line'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => resetTokenTimingsEvenly(activeLine.id)}
                    title="Reset to smart auto-detected words and equal timing across line"
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-gatefold-text-3 hover:text-gatefold-accent flex items-center gap-1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Auto Split</span>
                  </button>
                </div>
              </div>

              {/* Selectable Word Badges */}
              {activeLine.tokens.length === 0 ? (
                <div className="p-2.5 rounded bg-gatefold-surface border border-gatefold-line text-[11px] text-gatefold-text-3">
                  Type subtitle lyrics above to split words and configure per-word vocal timing.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activeLine.tokens.map((tok, i) => {
                    const isSel = i === safeTokenIdx;
                    const isPlayingNow = i === playingTokenIdx && !tok.disableAnim;
                    const dur = Math.max(0.05, tok.endTime - tok.startTime);
                    const isMuted = Boolean(tok.disableAnim);
                    return (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setSelectedTokenIdx(i)}
                        title={
                          isMuted
                            ? `"${tok.text}" — Vocal animation disabled (static)`
                            : `"${tok.text}" (${dur.toFixed(2)}s)`
                        }
                        className={`px-2 py-1 rounded border flex flex-col items-center transition-colors relative ${
                          isSel
                            ? 'bg-gatefold-accent/20 border-gatefold-accent text-gatefold-accent'
                            : isPlayingNow
                            ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                            : isMuted
                            ? 'bg-gatefold-surface/40 border-dashed border-gatefold-line text-gatefold-text-3 opacity-60'
                            : 'bg-gatefold-surface border-gatefold-line text-gatefold-text hover:border-gatefold-line-2'
                        }`}
                      >
                        {tok.ruby && (
                          <span className="text-[9px] font-bold text-gatefold-accent font-mono leading-none">
                            {tok.ruby}
                          </span>
                        )}
                        <span
                          className={`text-xs font-medium leading-tight ${
                            isMuted ? 'line-through decoration-amber-400/70' : ''
                          }`}
                        >
                          {tok.text}
                        </span>
                        <span className="text-[9px] font-mono text-gatefold-text-3 mt-0.5">
                          {isMuted ? 'OFF' : `${dur.toFixed(2)}s`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Active Word Timing & Split/Merge/Mute Controls */}
              {activeToken && (
                <div className="p-2.5 rounded-lg bg-gatefold-surface border border-gatefold-line space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gatefold-text truncate">
                      Word #{safeTokenIdx + 1}: "{activeToken.text}"
                    </span>
                    <span className="font-mono text-[10px] text-gatefold-accent shrink-0">
                      {(activeToken.endTime - activeToken.startTime).toFixed(2)}s
                    </span>
                  </div>

                  {/* Word Area Split / Merge / Mute Action Bar */}
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      disabled={activeTokenCharCount <= 1}
                      onClick={() => splitTokenIntoChars(activeLine.id, safeTokenIdx)}
                      title="Split this word into individual characters"
                      className="py-1 px-2 rounded bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-[11px] font-medium text-gatefold-text flex items-center justify-center gap-1 disabled:opacity-35 disabled:pointer-events-none"
                    >
                      <Scissors className="w-3 h-3 text-gatefold-accent" />
                      <span>Split to Chars ({activeTokenCharCount})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleTokenAnimDisabled(activeLine.id, safeTokenIdx)}
                      title="Enable or disable vocal highlight/bounce animation for this word area"
                      className={`py-1 px-2 rounded border text-[11px] font-medium flex items-center justify-center gap-1 transition-colors ${
                        activeToken.disableAnim
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      }`}
                    >
                      <Ban className="w-3 h-3" />
                      <span>{activeToken.disableAnim ? 'Anim: OFF (Static)' : 'Anim: ON (Active)'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={safeTokenIdx <= 0}
                      onClick={() => {
                        mergeTokenWithNeighbor(activeLine.id, safeTokenIdx, 'prev');
                        setSelectedTokenIdx(Math.max(0, safeTokenIdx - 1));
                      }}
                      title="Merge this word/char with the previous word on the left"
                      className="py-1 px-2 rounded bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-[11px] font-medium text-gatefold-text flex items-center justify-center gap-1 disabled:opacity-35 disabled:pointer-events-none"
                    >
                      <Merge className="w-3 h-3 text-gatefold-accent rotate-180" />
                      <span>← Merge Left</span>
                    </button>

                    <button
                      type="button"
                      disabled={safeTokenIdx >= activeLine.tokens.length - 1}
                      onClick={() => {
                        mergeTokenWithNeighbor(activeLine.id, safeTokenIdx, 'next');
                      }}
                      title="Merge this word/char with the next word on the right"
                      className="py-1 px-2 rounded bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-[11px] font-medium text-gatefold-text flex items-center justify-center gap-1 disabled:opacity-35 disabled:pointer-events-none"
                    >
                      <Merge className="w-3 h-3 text-gatefold-accent" />
                      <span>Merge Right →</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gatefold-text-3 block">
                        Word Start (s)
                      </label>
                      <input
                        type="number"
                        step={0.05}
                        value={activeToken.startTime}
                        onChange={(e) =>
                          updateTokenTiming(
                            activeLine.id,
                            safeTokenIdx,
                            parseFloat(e.target.value) || 0,
                            activeToken.endTime
                          )
                        }
                        className="w-full px-2 py-1 bg-gatefold-bg border border-gatefold-line rounded font-mono text-xs focus:border-gatefold-accent focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gatefold-text-3 block">
                        Word End (s)
                      </label>
                      <input
                        type="number"
                        step={0.05}
                        value={activeToken.endTime}
                        onChange={(e) =>
                          updateTokenTiming(
                            activeLine.id,
                            safeTokenIdx,
                            activeToken.startTime,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full px-2 py-1 bg-gatefold-bg border border-gatefold-line rounded font-mono text-xs focus:border-gatefold-accent focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Duration Slider + Quick Step + Playhead Sync */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-gatefold-text-3">
                      <span>Vocal Hold Duration</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleTokenDurationDelta(-0.05)}
                          className="px-1.5 py-0.5 rounded bg-gatefold-surface-2 hover:bg-gatefold-hover text-gatefold-text"
                        >
                          -0.05s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTokenDurationDelta(0.05)}
                          className="px-1.5 py-0.5 rounded bg-gatefold-surface-2 hover:bg-gatefold-hover text-gatefold-text"
                        >
                          +0.05s
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={Math.max(0.5, activeLine.endTime - activeToken.startTime)}
                      step={0.05}
                      value={Math.max(0.05, activeToken.endTime - activeToken.startTime)}
                      onChange={(e) => {
                        const dur = parseFloat(e.target.value) || 0.1;
                        updateTokenTiming(
                          activeLine.id,
                          safeTokenIdx,
                          activeToken.startTime,
                          activeToken.startTime + dur
                        );
                      }}
                      className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
                    />
                    <button
                      type="button"
                      onClick={handleSnapTokenEndToPlayhead}
                      className="w-full py-1 px-2 rounded bg-gatefold-accent/15 hover:bg-gatefold-accent/25 border border-gatefold-accent/30 text-gatefold-accent font-medium text-[11px] flex items-center justify-center gap-1.5"
                      title="Set this word's end time to the current playhead and advance to the next word"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Set Word End to Current Playhead</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'colors' && (
          <div className="space-y-4">
            {/* Base Text Fill & Gradient */}
            <div className="space-y-2.5 pb-3 border-b border-gatefold-line">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold">
                  Text Fill & Gradient
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gatefold-text-2">
                  <input
                    type="checkbox"
                    checked={style.fillGradientEnabled}
                    onChange={(e) => setStyle({ fillGradientEnabled: e.target.checked })}
                    className="accent-gatefold-accent rounded"
                  />
                  <span>Gradient Fill</span>
                </label>
              </div>

              {/* Live Gradient / Fill Preview Swatch */}
              <div
                className="h-6 w-full rounded border border-gatefold-line flex items-center justify-center text-[10px] font-mono font-bold tracking-wider"
                style={{
                  background: style.fillGradientEnabled
                    ? `linear-gradient(180deg, ${style.fillColor}, ${style.fillGradientEndColor})`
                    : style.fillColor,
                  color: style.outerStrokeColor,
                }}
              >
                {style.fillGradientEnabled
                  ? `${style.fillColor} → ${style.fillGradientEndColor}`
                  : style.fillColor}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gatefold-text-3 block mb-1">
                    {style.fillGradientEnabled ? 'Top / Start Color' : 'Solid Fill Color'}
                  </label>
                  <div className="flex items-center gap-1.5 bg-gatefold-surface border border-gatefold-line rounded px-1.5 py-1">
                    <input
                      type="color"
                      value={style.fillColor}
                      onChange={(e) => setStyle({ fillColor: e.target.value })}
                      className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={style.fillColor}
                      onChange={(e) => setStyle({ fillColor: e.target.value })}
                      className="w-full bg-transparent font-mono text-[11px] text-gatefold-text focus:outline-none"
                    />
                  </div>
                </div>

                {style.fillGradientEnabled && (
                  <div>
                    <label className="text-[10px] text-gatefold-text-3 block mb-1">
                      Bottom / End Color
                    </label>
                    <div className="flex items-center gap-1.5 bg-gatefold-surface border border-gatefold-line rounded px-1.5 py-1">
                      <input
                        type="color"
                        value={style.fillGradientEndColor}
                        onChange={(e) => setStyle({ fillGradientEndColor: e.target.value })}
                        className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={style.fillGradientEndColor}
                        onChange={(e) => setStyle({ fillGradientEndColor: e.target.value })}
                        className="w-full bg-transparent font-mono text-[11px] text-gatefold-text focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Active Word Karaoke Highlight Color */}
              <div>
                <label className="text-[10px] text-gatefold-text-3 block mb-1">
                  Active Sung Word Color (Karaoke Highlight)
                </label>
                <div className="flex items-center gap-1.5 bg-gatefold-surface border border-gatefold-line rounded px-2 py-1">
                  <input
                    type="color"
                    value={style.wordActiveColor}
                    onChange={(e) => setStyle({ wordActiveColor: e.target.value })}
                    className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={style.wordActiveColor}
                    onChange={(e) => setStyle({ wordActiveColor: e.target.value })}
                    className="w-full bg-transparent font-mono text-[11px] text-gatefold-text focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Stroke & Glow Colors */}
            <div className="space-y-2.5 pb-3 border-b border-gatefold-line">
              <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold block">
                Outline Stroke & Glow Colors
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gatefold-text-3 block mb-1">
                    Inner Stroke Color
                  </label>
                  <div className="flex items-center gap-1.5 bg-gatefold-surface border border-gatefold-line rounded px-1.5 py-1">
                    <input
                      type="color"
                      value={style.innerStrokeColor}
                      onChange={(e) => setStyle({ innerStrokeColor: e.target.value })}
                      className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={style.innerStrokeColor}
                      onChange={(e) => setStyle({ innerStrokeColor: e.target.value })}
                      className="w-full bg-transparent font-mono text-[11px] text-gatefold-text focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gatefold-text-3 block mb-1">
                    Outer Stroke Color
                  </label>
                  <div className="flex items-center gap-1.5 bg-gatefold-surface border border-gatefold-line rounded px-1.5 py-1">
                    <input
                      type="color"
                      value={style.outerStrokeColor}
                      onChange={(e) => setStyle({ outerStrokeColor: e.target.value })}
                      className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={style.outerStrokeColor}
                      onChange={(e) => setStyle({ outerStrokeColor: e.target.value })}
                      className="w-full bg-transparent font-mono text-[11px] text-gatefold-text focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-gatefold-text-3 block mb-1">
                    Glow / Shadow Color
                  </label>
                  <div className="flex items-center gap-1.5 bg-gatefold-surface border border-gatefold-line rounded px-1.5 py-1">
                    <input
                      type="color"
                      value={style.glowColor}
                      onChange={(e) => setStyle({ glowColor: e.target.value })}
                      className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={style.glowColor}
                      onChange={(e) => setStyle({ glowColor: e.target.value })}
                      className="w-full bg-transparent font-mono text-[11px] text-gatefold-text focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] text-gatefold-text-3">Glow Blur</label>
                    <span className="font-mono text-[10px] text-gatefold-accent">
                      {style.glowBlur}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={style.glowBlur}
                    onChange={(e) => setStyle({ glowBlur: parseInt(e.target.value, 10) })}
                    className="w-full h-1.5 mt-2 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
                  />
                </div>
              </div>
            </div>

            {/* Furigana & Translation Colors */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold block">
                Furigana (Ruby) & Translation Colors
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gatefold-text-3 block mb-1">
                    Ruby Fill Color
                  </label>
                  <div className="flex items-center gap-1.5 bg-gatefold-surface border border-gatefold-line rounded px-1.5 py-1">
                    <input
                      type="color"
                      value={style.rubyFillColor}
                      onChange={(e) => setStyle({ rubyFillColor: e.target.value })}
                      className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={style.rubyFillColor}
                      onChange={(e) => setStyle({ rubyFillColor: e.target.value })}
                      className="w-full bg-transparent font-mono text-[11px] text-gatefold-text focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gatefold-text-3 block mb-1">
                    Active Ruby Color
                  </label>
                  <div className="flex items-center gap-1.5 bg-gatefold-surface border border-gatefold-line rounded px-1.5 py-1">
                    <input
                      type="color"
                      value={style.rubyActiveColor}
                      onChange={(e) => setStyle({ rubyActiveColor: e.target.value })}
                      className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={style.rubyActiveColor}
                      onChange={(e) => setStyle({ rubyActiveColor: e.target.value })}
                      className="w-full bg-transparent font-mono text-[11px] text-gatefold-text focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gatefold-text-3 block mb-1">
                  Secondary Translation Color
                </label>
                <div className="flex items-center gap-1.5 bg-gatefold-surface border border-gatefold-line rounded px-2 py-1">
                  <input
                    type="color"
                    value={style.translationFillColor}
                    onChange={(e) => setStyle({ translationFillColor: e.target.value })}
                    className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={style.translationFillColor}
                    onChange={(e) => setStyle({ translationFillColor: e.target.value })}
                    className="w-full bg-transparent font-mono text-[11px] text-gatefold-text focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'style' && (
          <>
            {/* Word Transition Motion Speed & Style */}
            <div className="space-y-2.5 pb-3 border-b border-gatefold-line">
              <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold block">
                Word-to-Word Vocal Animation
              </span>

              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'pop', label: 'Pop Bounce' },
                    { id: 'sweep', label: 'Karaoke Sweep' },
                    { id: 'float', label: 'Vocal Float' },
                  ] as { id: WordAnimationStyle; label: string }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setStyle({ wordAnimStyle: item.id })}
                    className={`py-1.5 px-2 rounded border text-[11px] font-medium transition-colors ${
                      style.wordAnimStyle === item.id
                        ? 'border-gatefold-accent bg-gatefold-accent/15 text-gatefold-accent'
                        : 'border-gatefold-line bg-gatefold-surface text-gatefold-text-3 hover:text-gatefold-text'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gatefold-text">
                    Word Transition Duration
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={5000}
                      step={10}
                      value={style.wordTransitionMs}
                      onChange={(e) =>
                        setStyle({
                          wordTransitionMs: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-16 px-1.5 py-0.5 text-right bg-gatefold-surface border border-gatefold-line rounded font-mono text-[11px] text-gatefold-accent focus:border-gatefold-accent focus:outline-none"
                    />
                    <span className="text-[10px] font-mono text-gatefold-text-3">ms</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={10}
                  value={Math.min(1000, style.wordTransitionMs)}
                  onChange={(e) =>
                    setStyle({ wordTransitionMs: parseInt(e.target.value, 10) })
                  }
                  className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
                />
                <p className="text-[10px] text-gatefold-text-3">
                  Controls how fast the highlight and motion animate when moving from one sung word to the next.
                </p>
              </div>
            </div>

            {/* Subtitle Position & Alignment (Anchor + X Offset + Y Offset) */}
            <div className="space-y-2.5 pb-3 border-b border-gatefold-line">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold">
                  Position & Alignment
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setStyle({
                      verticalPosition: 'bottom',
                      xOffset: 0,
                      yOffset: 60,
                    })
                  }
                  title="Reset subtitle position to default bottom-center (0, 60)"
                  className="text-[10px] font-mono text-gatefold-text-3 hover:text-gatefold-accent flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Pos</span>
                </button>
              </div>

              {/* Vertical Anchor Selector */}
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'bottom', label: 'Bottom' },
                    { id: 'center', label: 'Center' },
                    { id: 'top', label: 'Top' },
                  ] as const
                ).map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => setStyle({ verticalPosition: pos.id })}
                    className={`py-1 px-2 rounded border text-[11px] font-medium transition-colors ${
                      style.verticalPosition === pos.id
                        ? 'border-gatefold-accent bg-gatefold-accent/15 text-gatefold-accent'
                        : 'border-gatefold-line bg-gatefold-surface text-gatefold-text-3 hover:text-gatefold-text'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>

              {/* X-Position Offset */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gatefold-text">X-Position Offset</span>
                  <div className="flex items-center gap-1">
                    {(style.xOffset ?? 0) !== 0 && (
                      <button
                        type="button"
                        onClick={() => setStyle({ xOffset: 0 })}
                        className="px-1.5 py-0.5 rounded bg-gatefold-surface-2 hover:bg-gatefold-hover text-[10px] font-mono text-gatefold-text-3"
                        title="Center horizontally (X = 0)"
                      >
                        0
                      </button>
                    )}
                    <input
                      type="number"
                      step={5}
                      value={style.xOffset ?? 0}
                      onChange={(e) =>
                        setStyle({
                          xOffset: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-16 px-1.5 py-0.5 text-right bg-gatefold-surface border border-gatefold-line rounded font-mono text-[11px] text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                    />
                    <span className="text-[10px] font-mono text-gatefold-text-3">px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={-640}
                  max={640}
                  step={2}
                  value={Math.max(-640, Math.min(640, style.xOffset ?? 0))}
                  onChange={(e) => setStyle({ xOffset: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
                />
              </div>

              {/* Y-Position Offset */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gatefold-text">Y-Position Offset</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={5}
                      value={style.yOffset}
                      onChange={(e) =>
                        setStyle({
                          yOffset: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-16 px-1.5 py-0.5 text-right bg-gatefold-surface border border-gatefold-line rounded font-mono text-[11px] text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                    />
                    <span className="text-[10px] font-mono text-gatefold-text-3">px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={-120}
                  max={600}
                  step={2}
                  value={Math.max(-120, Math.min(600, style.yOffset))}
                  onChange={(e) => setStyle({ yOffset: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
                />
              </div>
            </div>

            {/* Font & Size */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gatefold-text">Font Size</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={8}
                    max={500}
                    value={style.fontSize}
                    onChange={(e) =>
                      setStyle({ fontSize: Math.max(8, parseInt(e.target.value, 10) || 24) })
                    }
                    className="w-16 px-1.5 py-0.5 text-right bg-gatefold-surface border border-gatefold-line rounded font-mono text-[11px] text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                  />
                  <span className="text-[10px] font-mono text-gatefold-text-3">px</span>
                </div>
              </div>
              <input
                type="range"
                min={14}
                max={160}
                value={Math.min(160, style.fontSize)}
                onChange={(e) => setStyle({ fontSize: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
              />
            </div>

            {/* Ruby Scale */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gatefold-text">Furigana Scale</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={10}
                    max={200}
                    value={Math.round(style.rubyScale * 100)}
                    onChange={(e) =>
                      setStyle({
                        rubyScale: Math.max(10, parseInt(e.target.value, 10) || 45) / 100,
                      })
                    }
                    className="w-16 px-1.5 py-0.5 text-right bg-gatefold-surface border border-gatefold-line rounded font-mono text-[11px] text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                  />
                  <span className="text-[10px] font-mono text-gatefold-text-3">%</span>
                </div>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                value={Math.min(100, Math.round(style.rubyScale * 100))}
                onChange={(e) => setStyle({ rubyScale: parseInt(e.target.value, 10) / 100 })}
                className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
              />
            </div>

            {/* Outer Stroke */}
            <div className="space-y-1.5 pt-2 border-t border-gatefold-line">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gatefold-text">Outer Stroke (Dark)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={style.outerStrokeWidth}
                    onChange={(e) =>
                      setStyle({
                        outerStrokeWidth: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-16 px-1.5 py-0.5 text-right bg-gatefold-surface border border-gatefold-line rounded font-mono text-[11px] text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                  />
                  <span className="text-[10px] font-mono text-gatefold-text-3">px</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                value={Math.min(40, style.outerStrokeWidth)}
                onChange={(e) => setStyle({ outerStrokeWidth: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-gatefold-surface-2 rounded-lg accent-gatefold-accent"
              />
            </div>

            {/* Inner Glow Stroke */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gatefold-text">Inner Glow Width</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={style.innerStrokeWidth}
                    onChange={(e) =>
                      setStyle({
                        innerStrokeWidth: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-16 px-1.5 py-0.5 text-right bg-gatefold-surface border border-gatefold-line rounded font-mono text-[11px] text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                  />
                  <span className="text-[10px] font-mono text-gatefold-text-3">px</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={24}
                value={Math.min(24, style.innerStrokeWidth)}
                onChange={(e) => setStyle({ innerStrokeWidth: parseInt(e.target.value, 10) })}
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
                <span className="font-mono text-gatefold-text-3">
                  {style.particleBurstCount} particles
                </span>
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
                  fillColor: '#ffffff',
                  fillGradientEnabled: true,
                  fillGradientEndColor: '#b8d0ff',
                  wordActiveColor: '#7df9ff',
                  outerStrokeColor: '#14161b',
                  outerStrokeWidth: 8,
                  innerStrokeWidth: 2,
                  innerStrokeColor: '#8fb4ff',
                  glowColor: '#5770b0',
                  glowBlur: 12,
                  rubyFillColor: '#8fb4ff',
                  rubyActiveColor: '#5affb5',
                  wordTransitionMs: 140,
                  wordAnimStyle: 'pop' as const,
                },
              },
              {
                name: 'Neon Shinjuku (Magenta)',
                style: {
                  fontSize: 52,
                  fillColor: '#ffffff',
                  fillGradientEnabled: true,
                  fillGradientEndColor: '#ffb3df',
                  wordActiveColor: '#ff3399',
                  outerStrokeColor: '#12081a',
                  outerStrokeWidth: 10,
                  innerStrokeWidth: 3,
                  innerStrokeColor: '#ff007f',
                  glowColor: '#ff007f',
                  glowBlur: 14,
                  rubyFillColor: '#ff80bf',
                  rubyActiveColor: '#00f0ff',
                  wordTransitionMs: 100,
                  wordAnimStyle: 'sweep' as const,
                },
              },
              {
                name: 'Sakura Petal (Pink)',
                style: {
                  fontSize: 50,
                  fillColor: '#fff5f8',
                  fillGradientEnabled: true,
                  fillGradientEndColor: '#ffc2d9',
                  wordActiveColor: '#ff85b3',
                  outerStrokeColor: '#24121b',
                  outerStrokeWidth: 6,
                  innerStrokeWidth: 2,
                  innerStrokeColor: '#ff94b8',
                  glowColor: '#b84f7b',
                  glowBlur: 10,
                  rubyFillColor: '#ffb3cc',
                  rubyActiveColor: '#ffe066',
                  wordTransitionMs: 220,
                  wordAnimStyle: 'float' as const,
                },
              },
              {
                name: 'Golden Sunset (Amber)',
                style: {
                  fontSize: 52,
                  fillColor: '#fffbe6',
                  fillGradientEnabled: true,
                  fillGradientEndColor: '#ffcc66',
                  wordActiveColor: '#ff9900',
                  outerStrokeColor: '#1c1208',
                  outerStrokeWidth: 8,
                  innerStrokeWidth: 2,
                  innerStrokeColor: '#ffaa33',
                  glowColor: '#cc6600',
                  glowBlur: 12,
                  rubyFillColor: '#ffd685',
                  rubyActiveColor: '#ffffff',
                  wordTransitionMs: 150,
                  wordAnimStyle: 'pop' as const,
                },
              },
              {
                name: 'Clean Minimalist',
                style: {
                  fontSize: 48,
                  fillColor: '#ffffff',
                  fillGradientEnabled: false,
                  fillGradientEndColor: '#ffffff',
                  wordActiveColor: '#8fb4ff',
                  outerStrokeColor: '#101216',
                  outerStrokeWidth: 6,
                  innerStrokeWidth: 0,
                  innerStrokeColor: '#ffffff',
                  glowColor: '#000000',
                  glowBlur: 0,
                  rubyFillColor: '#d0d7e6',
                  rubyActiveColor: '#8fb4ff',
                  wordTransitionMs: 80,
                  wordAnimStyle: 'sweep' as const,
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
    </>
  );
});

export const SubtitleInspector: React.FC<SubtitleInspectorProps> = React.memo(({ width = 320 }) => (
  <aside
    style={{ width }}
    className="shrink-0 border-l border-gatefold-line bg-gatefold-panel-strong flex flex-col h-full text-xs select-none"
  >
    <SubtitleInspectorBody />
  </aside>
));
