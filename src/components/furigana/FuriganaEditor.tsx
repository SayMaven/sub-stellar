import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, AlertTriangle, X, Scissors, Merge, Eraser, ChevronRight } from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import {
  containsKanji,
  isKanjiChar,
  markdownToSegments,
  segmentsToReading,
  stripRuby,
  suggestSplit,
  type FuriganaSegment,
} from '../../engine/text/furiganaAlign';
import type { SubtitleLine } from '../../types';

interface FuriganaEditorProps {
  line: SubtitleLine;
}

function isKanjiSegment(seg: FuriganaSegment | undefined): boolean {
  if (!seg || !seg.base) return false;
  for (const ch of seg.base) {
    if (!isKanjiChar(ch)) return false;
  }
  return true;
}

const inputClass =
  'w-full px-2.5 py-1.5 bg-gatefold-surface border border-gatefold-line rounded text-xs text-gatefold-text focus:border-gatefold-accent focus:outline-none';
const smallButton =
  'px-2 py-1 rounded border border-gatefold-line bg-gatefold-surface-2 hover:bg-gatefold-hover text-[11px] text-gatefold-text flex items-center gap-1 disabled:opacity-40';

const FuriganaEditorInner: React.FC<FuriganaEditorProps> = ({ line }) => {
  const updateLinePlainText = useStudioStore((s) => s.updateLinePlainText);
  const updateLineText = useStudioStore((s) => s.updateLineText);
  const setLineReading = useStudioStore((s) => s.setLineReading);
  const editLineFurigana = useStudioStore((s) => s.editLineFurigana);
  const autoFuriganaLine = useStudioStore((s) => s.autoFuriganaLine);

  const plain = useMemo(() => stripRuby(line.text), [line.text]);
  const segments = useMemo(() => markdownToSegments(line.text), [line.text]);
  const derivedReading = useMemo(() => segmentsToReading(segments), [segments]);
  const showReading = containsKanji(plain);

  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [rubyDraft, setRubyDraft] = useState('');
  const [splitDraft, setSplitDraft] = useState<string[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(null);
    setError(null);
    setEditIdx(null);
    setSplitDraft(null);
  }, [line.id]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const editSegment = editIdx !== null ? segments[editIdx] : undefined;
  useEffect(() => {
    if (editSegment) {
      setRubyDraft(editSegment.ruby ?? '');
      setSplitDraft(null);
    }
  }, [editIdx, editSegment?.base, editSegment?.ruby]);

  const handleReadingChange = (value: string) => {
    setDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const res = setLineReading(line.id, value);
      setError(res.ok ? null : (res.message ?? 'Bacaan tidak cocok dengan teks.'));
    }, 250);
  };

  const handleAuto = async () => {
    setBusy(true);
    setError(null);
    const res = await autoFuriganaLine(line.id);
    setBusy(false);
    setDraft(null);
    if (!res.ok) setError(res.message ?? 'Auto furigana gagal.');
  };

  const closePanel = () => {
    setEditIdx(null);
    setSplitDraft(null);
  };

  const applyRuby = () => {
    if (editIdx === null) return;
    if ((editSegment?.ruby ?? '') === rubyDraft.trim()) return;
    editLineFurigana(line.id, { type: 'setRuby', index: editIdx, ruby: rubyDraft });
  };

  const prevMergeable =
    editIdx !== null &&
    editIdx > 0 &&
    isKanjiSegment(segments[editIdx - 1]) &&
    isKanjiSegment(editSegment) &&
    segments[editIdx - 1].runId === editSegment?.runId;
  const nextMergeable =
    editIdx !== null &&
    isKanjiSegment(segments[editIdx + 1]) &&
    isKanjiSegment(editSegment) &&
    segments[editIdx + 1].runId === editSegment?.runId;
  const canSplit = editSegment ? Array.from(editSegment.base).length > 1 && isKanjiSegment(editSegment) : false;

  return (
    <div className="space-y-2.5">
      {/* Plain text (no braces) */}
      <div className="space-y-1.5">
        <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold">
          Subtitle Text
        </span>
        <textarea
          rows={2}
          value={plain}
          onChange={(e) => updateLinePlainText(line.id, e.target.value)}
          placeholder="Ketik teks lirik di sini (contoh: 星空の下で歌おう atau kamu dan aku)..."
          className={`${inputClass} font-mono resize-none`}
        />
      </div>

      {showReading && (
        <>
          {/* Reading field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold">
                Reading (Hiragana)
              </span>
              <button
                type="button"
                onClick={() => void handleAuto()}
                disabled={busy}
                title="Isi bacaan otomatis memakai Kuromoji (offline)"
                className="px-2 py-0.5 rounded border border-gatefold-line bg-gatefold-surface-2 hover:bg-gatefold-hover text-[11px] font-mono text-gatefold-text-2 hover:text-gatefold-text transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                {busy && <Loader2 className="w-3 h-3 animate-spin text-gatefold-accent" />}
                <span>{busy ? 'Menganalisis…' : 'Auto'}</span>
              </button>
            </div>
            <input
              type="text"
              value={draft ?? derivedReading}
              onChange={(e) => handleReadingChange(e.target.value)}
              onBlur={() => {
                if (debounceRef.current) {
                  clearTimeout(debounceRef.current);
                  debounceRef.current = null;
                  if (draft !== null) {
                    const res = setLineReading(line.id, draft);
                    setError(res.ok ? null : (res.message ?? null));
                    if (res.ok) setDraft(null);
                    return;
                  }
                }
                if (!error) setDraft(null);
              }}
              placeholder="ほしぞらのしたでうたおう  (gunakan / untuk memisah per kanji: ほし/ぞら)"
              className={`${inputClass} font-mono`}
            />
            {error && (
              <div className="flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Click-to-edit preview */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-mono text-gatefold-text-3 font-semibold">
              Preview (klik kanji untuk koreksi)
            </span>
            <div className="p-2 rounded-lg bg-gatefold-surface border border-gatefold-line flex flex-wrap items-end gap-x-0.5 gap-y-1 min-h-[48px]">
              {segments.map((seg, i) => {
                const clickable = isKanjiSegment(seg);
                const selected = editIdx === i;
                const content = (
                  <>
                    <span
                      className={`text-[10px] leading-none mb-0.5 h-3 ${
                        seg.ruby ? 'text-gatefold-accent font-semibold' : 'opacity-0'
                      }`}
                    >
                      {seg.ruby || '-'}
                    </span>
                    <span className="text-sm font-bold text-gatefold-text leading-none whitespace-pre">
                      {seg.base}
                    </span>
                  </>
                );
                return clickable ? (
                  <button
                    key={i}
                    type="button"
                    onClick={() => (selected ? closePanel() : setEditIdx(i))}
                    className={`flex flex-col items-center px-1 py-0.5 rounded border transition-colors ${
                      selected
                        ? 'border-gatefold-accent bg-gatefold-accent/15'
                        : seg.ruby
                        ? 'border-transparent hover:border-gatefold-line-2 hover:bg-gatefold-hover'
                        : 'border-dashed border-amber-500/40 hover:bg-gatefold-hover'
                    }`}
                    title={seg.ruby ? 'Klik untuk koreksi furigana' : 'Belum ada furigana, klik untuk mengisi'}
                  >
                    {content}
                  </button>
                ) : (
                  <span key={i} className="flex flex-col items-center px-0.5 py-0.5">
                    {content}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Segment correction panel */}
          {editIdx !== null && editSegment && (
            <div className="p-2.5 rounded-lg border border-gatefold-accent/40 bg-gatefold-surface-2/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gatefold-text">
                  {editSegment.base}
                  {editSegment.ruby ? ` (${editSegment.ruby})` : ''}
                </span>
                <button
                  type="button"
                  onClick={closePanel}
                  className="p-0.5 rounded hover:bg-gatefold-hover text-gatefold-text-3"
                  aria-label="Tutup"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {splitDraft === null ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-gatefold-text-3 block">
                      Bacaan
                    </label>
                    <input
                      type="text"
                      value={rubyDraft}
                      onChange={(e) => setRubyDraft(e.target.value)}
                      onBlur={applyRuby}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyRuby();
                        }
                      }}
                      placeholder="mis. きょう"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={!canSplit}
                      onClick={() => setSplitDraft(suggestSplit(editSegment.base, editSegment.ruby))}
                      className={smallButton}
                      title="Pecah menjadi furigana per kanji"
                    >
                      <Scissors className="w-3 h-3 text-gatefold-accent" />
                      <span>Pecah per kanji</span>
                    </button>
                    <button
                      type="button"
                      disabled={!prevMergeable}
                      onClick={() => {
                        editLineFurigana(line.id, { type: 'merge', index: (editIdx ?? 1) - 1 });
                        closePanel();
                      }}
                      className={smallButton}
                      title="Gabung dengan kanji di sebelah kiri"
                    >
                      <Merge className="w-3 h-3 text-gatefold-accent" />
                      <span>← Gabung</span>
                    </button>
                    <button
                      type="button"
                      disabled={!nextMergeable}
                      onClick={() => {
                        editLineFurigana(line.id, { type: 'merge', index: editIdx });
                        closePanel();
                      }}
                      className={smallButton}
                      title="Gabung dengan kanji di sebelah kanan"
                    >
                      <Merge className="w-3 h-3 text-gatefold-accent" />
                      <span>Gabung →</span>
                    </button>
                    <button
                      type="button"
                      disabled={!editSegment.ruby}
                      onClick={() => editLineFurigana(line.id, { type: 'removeRuby', index: editIdx })}
                      className={smallButton}
                      title="Hapus furigana pada kanji ini"
                    >
                      <Eraser className="w-3 h-3 text-red-400" />
                      <span>Hapus furigana</span>
                    </button>
                  </div>
                  {(prevMergeable || nextMergeable) && (
                    <p className="text-[10px] text-gatefold-text-3">
                      Menggabung mengosongkan bacaan jika salah satu sisi belum punya furigana.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Array.from(editSegment.base).map((ch, k) => (
                      <div key={k} className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-gatefold-text w-5 text-center">{ch}</span>
                        <input
                          type="text"
                          value={splitDraft[k] ?? ''}
                          onChange={(e) =>
                            setSplitDraft((prev) => {
                              const next = [...(prev ?? [])];
                              next[k] = e.target.value;
                              return next;
                            })
                          }
                          placeholder="bacaan"
                          className={`${inputClass} font-mono`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        editLineFurigana(line.id, {
                          type: 'split',
                          index: editIdx,
                          rubies: splitDraft,
                        });
                        closePanel();
                      }}
                      className="px-2.5 py-1 rounded bg-gatefold-accent text-gatefold-bg text-[11px] font-semibold flex items-center gap-1 hover:opacity-90"
                    >
                      <ChevronRight className="w-3 h-3" />
                      <span>Terapkan</span>
                    </button>
                    <button type="button" onClick={() => setSplitDraft(null)} className={smallButton}>
                      Batal
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Raw syntax (advanced) */}
      <details className="group">
        <summary className="cursor-pointer text-[10px] uppercase font-mono text-gatefold-text-3 hover:text-gatefold-text select-none">
          Raw syntax {'{Kanji|Ruby}'}
        </summary>
        <textarea
          rows={2}
          value={line.text}
          onChange={(e) => updateLineText(line.id, e.target.value)}
          className={`${inputClass} font-mono resize-none mt-1.5`}
        />
      </details>
    </div>
  );
};

export const FuriganaEditor = React.memo(FuriganaEditorInner);

