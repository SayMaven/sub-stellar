import React, { useState, useEffect } from 'react';
import { X, Check, Plus, Trash2, Sparkles, BookOpen } from 'lucide-react';
import {
  parseMarkdownRuby,
  serializeToMarkdownRuby,
  type ParsedRubyToken,
} from '../../engine/text/RubyLayout';
import { useStudioStore } from '../../stores/useStudioStore';
import type { SubtitleLine } from '../../types';

interface RubyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  line: SubtitleLine;
}

export const RubyEditorModal: React.FC<RubyEditorModalProps> = ({
  isOpen,
  onClose,
  line,
}) => {
  const { updateLineText } = useStudioStore();
  const [tokens, setTokens] = useState<ParsedRubyToken[]>([]);

  useEffect(() => {
    if (line) {
      setTokens(parseMarkdownRuby(line.text));
    }
  }, [line]);

  if (!isOpen || !line) return null;

  const handleUpdateToken = (index: number, updates: Partial<ParsedRubyToken>) => {
    setTokens((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleRemoveToken = (index: number) => {
    setTokens((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddToken = () => {
    setTokens((prev) => [...prev, { base: '新', ruby: 'しん', isRuby: true }]);
  };

  const serialized = serializeToMarkdownRuby(tokens);

  const handleSave = () => {
    updateLineText(line.id, serialized);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
      <div className="w-full max-w-xl bg-gatefold-surface border border-gatefold-line-2 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="h-12 px-5 border-b border-gatefold-line flex items-center justify-between bg-gatefold-panel">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gatefold-accent" />
            <h3 className="text-xs font-semibold text-gatefold-text">
              Furigana & Ruby Editor — Line {line.id}
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
            Live Preview
          </span>
          <div className="p-4 rounded-lg bg-gatefold-surface border border-gatefold-line flex items-end justify-center min-h-[72px] gap-1 overflow-x-auto">
            {tokens.map((token, i) => (
              <div key={i} className="flex flex-col items-center">
                {token.isRuby && token.ruby ? (
                  <span className="text-[11px] font-semibold text-gatefold-accent leading-none mb-1">
                    {token.ruby}
                  </span>
                ) : (
                  <span className="text-[11px] h-3 leading-none mb-1 opacity-0">-</span>
                )}
                <span className="text-base font-bold text-gatefold-text leading-none">
                  {token.base}
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
              Word Segments ({tokens.length})
            </span>
            <button
              onClick={handleAddToken}
              className="px-2.5 py-1 bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line rounded text-[11px] text-gatefold-text flex items-center gap-1 font-medium transition-colors"
            >
              <Plus className="w-3 h-3 text-gatefold-accent" />
              <span>Add Segment</span>
            </button>
          </div>

          <div className="space-y-2">
            {tokens.map((token, idx) => (
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
                    value={token.base}
                    onChange={(e) => handleUpdateToken(idx, { base: e.target.value })}
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
                    value={token.ruby || ''}
                    disabled={!token.isRuby}
                    onChange={(e) =>
                      handleUpdateToken(idx, {
                        ruby: e.target.value,
                        isRuby: e.target.value.trim().length > 0,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text focus:border-gatefold-accent focus:outline-none disabled:opacity-40"
                  />
                </div>

                {/* Furigana Toggle */}
                <div className="pt-3">
                  <button
                    onClick={() =>
                      handleUpdateToken(idx, {
                        isRuby: !token.isRuby,
                        ruby: !token.isRuby ? token.ruby || '' : '',
                      })
                    }
                    className={`p-1.5 rounded border transition-colors ${
                      token.isRuby
                        ? 'bg-gatefold-accent/20 border-gatefold-accent/40 text-gatefold-accent'
                        : 'bg-gatefold-surface border-gatefold-line text-gatefold-text-3 hover:text-gatefold-text'
                    }`}
                    title={token.isRuby ? 'Remove Furigana' : 'Enable Furigana'}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Delete Button */}
                <div className="pt-3">
                  <button
                    onClick={() => handleRemoveToken(idx)}
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
            Timing: {line.startTime.toFixed(2)}s - {line.endTime.toFixed(2)}s
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

