import React, { useState, useEffect } from 'react';
import { X, Check, Plus, Trash2, Languages, BookOpen } from 'lucide-react';
import {
  parseMarkdownRuby,
  serializeToMarkdownRuby,
} from '../../engine/text/RubyLayout';
import { useStudioStore } from '../../stores/useStudioStore';
import type { SubtitleLine, RubyToken } from '../../types';

interface RubyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  line: SubtitleLine;
}

interface EditableSegment {
  base: string;
  ruby: string;
  isRuby: boolean;
  duration: number;
}

export const RubyEditorModal: React.FC<RubyEditorModalProps> = ({
  isOpen,
  onClose,
  line,
}) => {
  const { setTokensForLine } = useStudioStore();
  const [segments, setSegments] = useState<EditableSegment[]>([]);

  useEffect(() => {
    if (line) {
      if (line.tokens && line.tokens.length > 0) {
        setSegments(
          line.tokens.map((t) => ({
            base: t.text,
            ruby: t.ruby || '',
            isRuby: Boolean(t.ruby),
            duration: Math.max(0.05, Math.round((t.endTime - t.startTime) * 100) / 100),
          }))
        );
      } else {
        const parsed = parseMarkdownRuby(line.text);
        const fallbackDur =
          Math.max(0.1, line.endTime - line.startTime) / Math.max(1, parsed.length);
        setSegments(
          parsed.map((p) => ({
            base: p.base,
            ruby: p.ruby || '',
            isRuby: Boolean(p.isRuby && p.ruby),
            duration: Math.round(fallbackDur * 100) / 100,
          }))
        );
      }
    }
  }, [line]);

  if (!isOpen || !line) return null;

  const handleUpdateSegment = (index: number, updates: Partial<EditableSegment>) => {
    setSegments((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleRemoveSegment = (index: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddSegment = () => {
    setSegments((prev) => [
      ...prev,
      { base: '新', ruby: 'しん', isRuby: true, duration: 0.6 },
    ]);
  };

  const serialized = serializeToMarkdownRuby(
    segments.map((s) => ({
      base: s.base,
      ruby: s.isRuby && s.ruby ? s.ruby : undefined,
      isRuby: Boolean(s.isRuby && s.ruby),
    }))
  );

  const handleSave = () => {
    let cursor = line.startTime;
    const builtTokens: RubyToken[] = segments.map((s) => {
      const dur = Math.max(0.05, s.duration || 0.5);
      const start = Math.round(cursor * 100) / 100;
      const end = Math.round((cursor + dur) * 100) / 100;
      cursor = end;
      return {
        text: s.base,
        ruby: s.isRuby && s.ruby ? s.ruby : undefined,
        startTime: start,
        endTime: end,
      };
    });
    setTokensForLine(line.id, builtTokens, serialized);
    onClose();
  };

  const totalDuration = segments.reduce((sum, s) => sum + (s.duration || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 select-none">
      <div className="w-full max-w-2xl bg-gatefold-surface border border-gatefold-line-2 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="h-12 px-5 border-b border-gatefold-line flex items-center justify-between bg-gatefold-panel">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gatefold-accent" />
            <h3 className="text-xs font-semibold text-gatefold-text">
              Furigana, Ruby & Word Duration Editor — {line.id}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gatefold-hover text-gatefold-text-3 hover:text-gatefold-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Preview Area */}
        <div className="p-4 bg-gatefold-bg/40 border-b border-gatefold-line space-y-3">
          <span className="text-[10px] font-mono text-gatefold-text-3 uppercase tracking-wider block">
            Live Preview & Word Durations
          </span>
          <div className="p-4 rounded-lg bg-gatefold-surface border border-gatefold-line flex items-end justify-center min-h-[76px] gap-2 overflow-x-auto">
            {segments.map((seg, i) => (
              <div key={i} className="flex flex-col items-center px-1">
                {seg.isRuby && seg.ruby ? (
                  <span className="text-[11px] font-semibold text-gatefold-accent leading-none mb-1">
                    {seg.ruby}
                  </span>
                ) : (
                  <span className="text-[11px] h-3 leading-none mb-1 opacity-0">-</span>
                )}
                <span className="text-base font-bold text-gatefold-text leading-none">
                  {seg.base}
                </span>
                <span className="text-[9px] font-mono text-gatefold-text-3 mt-1">
                  {seg.duration.toFixed(2)}s
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-gatefold-text-3 px-1">
            <span>Syntax:</span>
            <span className="text-gatefold-text-2 bg-gatefold-surface px-2 py-0.5 rounded border border-gatefold-line">
              {serialized || '(empty)'}
            </span>
          </div>
        </div>

        {/* Tokens Editor Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-semibold text-gatefold-text-3 uppercase tracking-wider font-mono">
              Word Segments ({segments.length})
            </span>
            <button
              onClick={handleAddSegment}
              className="px-2.5 py-1 bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line rounded text-[11px] text-gatefold-text flex items-center gap-1 font-medium transition-colors"
            >
              <Plus className="w-3 h-3 text-gatefold-accent" />
              <span>Add Segment</span>
            </button>
          </div>

          <div className="space-y-2">
            {segments.map((seg, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-gatefold-line bg-gatefold-surface-2/40 flex items-center gap-3"
              >
                {/* Base Text Input */}
                <div className="flex-1">
                  <label className="text-[9px] font-mono text-gatefold-text-3 block uppercase mb-0.5">
                    Base Text (Kanji / Word)
                  </label>
                  <input
                    type="text"
                    value={seg.base}
                    onChange={(e) => handleUpdateSegment(idx, { base: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                  />
                </div>

                {/* Ruby Text Input */}
                <div className="flex-1">
                  <label className="text-[9px] font-mono text-gatefold-text-3 block uppercase mb-0.5">
                    Ruby Reading (Furigana)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. なに, とお"
                    value={seg.ruby}
                    disabled={!seg.isRuby}
                    onChange={(e) =>
                      handleUpdateSegment(idx, {
                        ruby: e.target.value,
                        isRuby: e.target.value.trim().length > 0,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text focus:border-gatefold-accent focus:outline-none disabled:opacity-40"
                  />
                </div>

                {/* Word Duration Input */}
                <div className="w-24">
                  <label className="text-[9px] font-mono text-gatefold-text-3 block uppercase mb-0.5">
                    Duration (s)
                  </label>
                  <input
                    type="number"
                    min={0.05}
                    max={20}
                    step={0.05}
                    value={seg.duration}
                    onChange={(e) =>
                      handleUpdateSegment(idx, {
                        duration: Math.max(0.05, parseFloat(e.target.value) || 0.1),
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs font-mono bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                  />
                </div>

                {/* Furigana Toggle */}
                <div className="pt-3">
                  <button
                    onClick={() =>
                      handleUpdateSegment(idx, {
                        isRuby: !seg.isRuby,
                        ruby: !seg.isRuby ? seg.ruby || '' : '',
                      })
                    }
                    className={`p-1.5 rounded border transition-colors ${
                      seg.isRuby
                        ? 'bg-gatefold-accent/20 border-gatefold-accent/40 text-gatefold-accent'
                        : 'bg-gatefold-surface border-gatefold-line text-gatefold-text-3 hover:text-gatefold-text'
                    }`}
                    title={seg.isRuby ? 'Remove Furigana' : 'Enable Furigana'}
                  >
                    <Languages className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Delete Button */}
                <div className="pt-3">
                  <button
                    onClick={() => handleRemoveSegment(idx)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-gatefold-text-3 hover:text-red-400 transition-colors"
                    title="Delete Segment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-14 px-5 border-t border-gatefold-line flex items-center justify-between bg-gatefold-panel">
          <span className="text-[10px] text-gatefold-text-3 font-mono">
            Start: {line.startTime.toFixed(2)}s • Total: {totalDuration.toFixed(2)}s (End:{' '}
            {(line.startTime + totalDuration).toFixed(2)}s)
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gatefold-surface border border-gatefold-line text-xs font-semibold text-gatefold-text hover:bg-gatefold-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-gatefold-accent text-gatefold-bg text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save & Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
