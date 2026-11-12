import React, { useState, useEffect } from 'react';
import { AlertTriangle, Save, Trash2, X, Loader2 } from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import { saveProjectToDisk } from '../../services/mediaCache';

interface PendingPrompt {
  actionDescription: string;
  resolve: (allowed: boolean) => void;
}

type PromptListener = (prompt: PendingPrompt | null) => void;
let activeListener: PromptListener | null = null;
let currentPrompt: PendingPrompt | null = null;

/**
 * Checks whether the current project has unsaved edits.
 * If dirty, opens the Gatefold UnsavedChangesModal and resolves true ONLY if the user
 * chooses to Save & Continue (and the save completes) or Discard Changes.
 */
export function confirmBeforeDiscardingProject(actionDescription: string): Promise<boolean> {
  const state = useStudioStore.getState();
  if (!state.hasUnsavedChanges) {
    return Promise.resolve(true);
  }

  // Fallback for headless tests or if host isn't mounted
  if (!activeListener) {
    return Promise.resolve(true);
  }

  // Cancel any earlier superseded prompt safely
  if (currentPrompt) {
    currentPrompt.resolve(false);
    currentPrompt = null;
  }

  return new Promise<boolean>((resolve) => {
    currentPrompt = { actionDescription, resolve };
    activeListener?.(currentPrompt);
  });
}

export const UnsavedChangesHost: React.FC = () => {
  const [prompt, setPrompt] = useState<PendingPrompt | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trackTitle = useStudioStore((s) => s.track.title);
  const linesCount = useStudioStore((s) => s.lines.length);
  const projectFilePath = useStudioStore((s) => s.projectFilePath);

  useEffect(() => {
    activeListener = (nextPrompt) => {
      setErrorMsg(null);
      setIsSaving(false);
      setPrompt(nextPrompt);
    };
    return () => {
      activeListener = null;
    };
  }, []);

  const finishPrompt = (allowed: boolean) => {
    if (currentPrompt && currentPrompt === prompt) {
      currentPrompt = null;
    }
    const target = prompt;
    setPrompt(null);
    setErrorMsg(null);
    setIsSaving(false);
    target?.resolve(allowed);
  };

  useEffect(() => {
    if (!prompt) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        e.preventDefault();
        finishPrompt(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!prompt) return null;

  const handleSaveAndContinue = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const latest = useStudioStore.getState();
      const json = latest.exportProjectJson();
      latest.saveToLocalStorage();
      const slug =
        (latest.track.title || 'substellar_project')
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_') || 'substellar_project';

      const res = await saveProjectToDisk({
        json,
        defaultFilename: `${slug}.substellar`,
        existingPath: latest.projectFilePath,
        forceSaveAs: false,
      });

      if (res.saved && res.path) {
        latest.markProjectSaved(res.path);
        latest.saveToLocalStorage();
        window.dispatchEvent(
          new CustomEvent('substellar:project-saved', { detail: { path: res.path } })
        );
        finishPrompt(true);
      } else {
        // User cancelled the OS Save File dialog — keep active project safe
        finishPrompt(false);
      }
    } catch (err) {
      setIsSaving(false);
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan proyek.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          finishPrompt(false);
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-modal-title"
        className="w-full max-w-md rounded-2xl bg-[#161920] border border-gatefold-line-2 shadow-2xl shadow-black/90 overflow-hidden animate-in fade-in duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gatefold-line bg-[#12141a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 id="unsaved-modal-title" className="text-sm font-semibold text-gatefold-text">
                Proyek Belum Disimpan
              </h2>
              <p className="text-[11px] text-gatefold-text-3">
                Perubahan terbaru belum disimpan ke berkas `.substellar`
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => finishPrompt(false)}
            className="p-1.5 rounded-lg text-gatefold-text-3 hover:text-gatefold-text hover:bg-gatefold-hover disabled:opacity-40"
            title="Batal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 text-xs leading-relaxed text-gatefold-text-2">
          <p>
            Anda memiliki perubahan yang belum disimpan pada{' '}
            <strong className="text-gatefold-text">
              {trackTitle || 'Untitled Project'}
            </strong>{' '}
            ({linesCount} baris lirik).
          </p>
          <p className="text-gatefold-text-3">
            Apakah Anda ingin menyimpan proyek sebelum{' '}
            <span className="text-gatefold-text font-medium">{prompt.actionDescription}</span>?
          </p>

          {projectFilePath && (
            <div className="px-3 py-2 rounded-lg bg-gatefold-surface border border-gatefold-line font-mono text-[10px] text-gatefold-text-3 truncate">
              Target: {projectFilePath}
            </div>
          )}

          {errorMsg && (
            <div className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-[11px]">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-3.5 border-t border-gatefold-line bg-[#12141a] flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => finishPrompt(false)}
            className="px-3 py-1.5 rounded-lg border border-gatefold-line bg-gatefold-surface hover:bg-gatefold-hover text-xs font-medium text-gatefold-text-2 hover:text-gatefold-text transition-colors disabled:opacity-40"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => finishPrompt(true)}
            className="px-3 py-1.5 rounded-lg border border-red-500/35 bg-red-500/15 hover:bg-red-500/25 text-xs font-medium text-red-300 flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Abaikan Perubahan</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSaveAndContinue()}
            className="px-3.5 py-1.5 rounded-lg bg-gatefold-accent hover:opacity-90 text-xs font-semibold text-gatefold-bg flex items-center gap-1.5 transition-opacity disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? 'Menyimpan...' : 'Simpan & Lanjutkan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

