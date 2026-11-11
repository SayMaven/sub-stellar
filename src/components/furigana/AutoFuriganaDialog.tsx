import React, { useMemo, useRef, useState } from 'react';
import { Sparkles, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useStudioStore, type AutoFuriganaAllResult } from '../../stores/useStudioStore';
import { containsKanji, hasFurigana, stripRuby } from '../../engine/text/furiganaAlign';

interface AutoFuriganaDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AutoFuriganaDialog: React.FC<AutoFuriganaDialogProps> = ({ isOpen, onClose }) => {
  const lines = useStudioStore((s) => s.lines);
  const autoFuriganaAll = useStudioStore((s) => s.autoFuriganaAll);

  const [overwrite, setOverwrite] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<AutoFuriganaAllResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signalRef = useRef({ cancelled: false });

  const counts = useMemo(() => {
    let kanjiLines = 0;
    let withFurigana = 0;
    for (const line of lines) {
      if (containsKanji(stripRuby(line.text))) {
        kanjiLines++;
        if (hasFurigana(line.text)) withFurigana++;
      }
    }
    return { kanjiLines, withFurigana };
  }, [lines]);

  if (!isOpen) return null;

  const targetCount = overwrite ? counts.kanjiLines : counts.kanjiLines - counts.withFurigana;

  const handleStart = async () => {
    signalRef.current = { cancelled: false };
    setRunning(true);
    setResult(null);
    setError(null);
    setProgress({ done: 0, total: targetCount });
    try {
      const res = await autoFuriganaAll({
        overwrite,
        signal: signalRef.current,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const handleClose = () => {
    if (running) signalRef.current.cancelled = true;
    setResult(null);
    setError(null);
    setProgress(null);
    onClose();
  };

  const percent = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 select-none">
      <div className="w-full max-w-md bg-gatefold-surface border border-gatefold-line-2 rounded-xl shadow-2xl overflow-hidden">
        <div className="h-12 px-5 border-b border-gatefold-line flex items-center justify-between bg-gatefold-panel">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gatefold-accent" />
            <h3 className="text-xs font-semibold text-gatefold-text">Auto Furigana — Semua Baris</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-gatefold-hover text-gatefold-text-3 hover:text-gatefold-text"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-gatefold-text-2">
          <p>
            Mengisi furigana otomatis (Kuromoji, offline) untuk baris yang berisi kanji. Hasilnya bisa
            dikoreksi per baris lewat kolom Reading.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center font-mono">
            <div className="p-2 rounded bg-gatefold-bg/50 border border-gatefold-line">
              <div className="text-base text-gatefold-text">{lines.length}</div>
              <div className="text-[10px] text-gatefold-text-3">total baris</div>
            </div>
            <div className="p-2 rounded bg-gatefold-bg/50 border border-gatefold-line">
              <div className="text-base text-gatefold-text">{counts.kanjiLines}</div>
              <div className="text-[10px] text-gatefold-text-3">berisi kanji</div>
            </div>
            <div className="p-2 rounded bg-gatefold-bg/50 border border-gatefold-line">
              <div className="text-base text-gatefold-accent">{targetCount}</div>
              <div className="text-[10px] text-gatefold-text-3">akan diproses</div>
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              disabled={running}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="mt-0.5 accent-[var(--gatefold-accent,#8fb4ff)]"
            />
            <span>
              <span className="text-gatefold-text font-medium">
                Timpa baris yang sudah ada furigana
              </span>
              <span className="block text-[11px] text-gatefold-text-3">
                Mati (default): baris yang sudah punya furigana ({counts.withFurigana}) dilewati agar
                koreksi manual tidak hilang.
              </span>
            </span>
          </label>

          <p className="text-[11px] text-gatefold-text-3">
            Jika segmentasi kata berubah, timing per kata baris itu dibagi rata ulang. Jalankan ini
            sebelum merapikan vocal timing.
          </p>

          {progress && (running || (result && !result.cancelled)) && (
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="flex items-center gap-1.5">
                  {running && <Loader2 className="w-3 h-3 animate-spin text-gatefold-accent" />}
                  <span>
                    {progress.done} / {progress.total}
                  </span>
                </span>
                <span className="text-gatefold-accent">{percent.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full bg-gatefold-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gatefold-accent transition-all duration-150"
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
              <span>
                {result.cancelled ? 'Dibatalkan. ' : 'Selesai. '}
                {result.processed} baris diberi furigana, {result.skipped} dilewati
                {result.failed > 0 ? `, ${result.failed} gagal` : ''}
                {result.timingReset > 0
                  ? `, timing ${result.timingReset} baris dibagi rata ulang`
                  : ''}
                .
              </span>
            </div>
          )}
        </div>

        <div className="h-14 px-5 border-t border-gatefold-line flex items-center justify-end gap-2 bg-gatefold-panel">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg bg-gatefold-surface border border-gatefold-line text-xs font-semibold text-gatefold-text hover:bg-gatefold-hover"
          >
            {running ? 'Batalkan' : 'Tutup'}
          </button>
          <button
            onClick={() => void handleStart()}
            disabled={running || targetCount === 0}
            className="px-4 py-2 rounded-lg bg-gatefold-accent text-gatefold-bg text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mulai</span>
          </button>
        </div>
      </div>
    </div>
  );
};

