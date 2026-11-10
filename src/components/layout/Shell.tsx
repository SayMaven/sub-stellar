import React, { Suspense, lazy, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MainStage } from '../studio/MainStage';
import { TelemetryOverlay } from '../common/TelemetryOverlay';
import { useStudioStore, AUTOSAVE_STORAGE_KEY } from '../../stores/useStudioStore';
import { usePerfStore } from '../../stores/usePerfStore';
import { isEditableTarget } from '../../engine/layout/layoutMath';
import { downloadFile } from '../../engine/text/SubtitleExporter';

const YouTubeDrawer = lazy(() =>
  import('../youtube/YouTubeDrawer').then((m) => ({ default: m.YouTubeDrawer }))
);
const LyricsDrawer = lazy(() =>
  import('../lyrics/LyricsDrawer').then((m) => ({ default: m.LyricsDrawer }))
);
const PresetsDrawer = lazy(() =>
  import('../presets/PresetsDrawer').then((m) => ({ default: m.PresetsDrawer }))
);
const ExportDrawer = lazy(() =>
  import('../export/ExportDrawer').then((m) => ({ default: m.ExportDrawer }))
);
const SettingsModal = lazy(() =>
  import('../settings/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);

export const Shell: React.FC = () => {
  const {
    activeTab,
    togglePlay,
    stepTime,
    setActiveTab,
    toggleLoop,
    selectedLineId,
    deleteLine,
    addLine,
    exportProjectJson,
    importProjectJson,
    saveToLocalStorage,
    track,
    lines,
    style,
    aspectRatio,
    canvasResolution,
  } = useStudioStore();
  const { cycleQualityMode, toggleTelemetry } = usePerfStore();

  // Restore last auto-saved session on first mount (if available)
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
        if (saved) {
          importProjectJson(saved);
        }
      }
    } catch {
      // Ignore corrupt auto-save
    }
  }, [importProjectJson]);

  // Debounced auto-save to localStorage whenever project state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      saveToLocalStorage();
    }, 500);
    return () => clearTimeout(timer);
  }, [lines, style, track, aspectRatio, canvasResolution, saveToLocalStorage]);

  // Keyboard shortcut controller
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const json = exportProjectJson();
        saveToLocalStorage();
        const slug = (track.title || 'substellar_project')
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_');
        downloadFile(`${slug}.substellar`, json, 'application/json;charset=utf-8');
        return;
      }

      // Ignore if user is typing in an editable control
      if (isEditableTarget(e.target)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        cycleQualityMode();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveTab('youtube');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        addLine();
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleTelemetry();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        toggleLoop();
      } else if (e.key === 'Delete' && selectedLineId && activeTab === 'studio') {
        e.preventDefault();
        deleteLine(selectedLineId);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepTime(e.shiftKey ? -1.0 : -0.1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepTime(e.shiftKey ? 1.0 : 0.1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlay,
    cycleQualityMode,
    setActiveTab,
    toggleTelemetry,
    stepTime,
    toggleLoop,
    selectedLineId,
    deleteLine,
    addLine,
    activeTab,
    exportProjectJson,
    saveToLocalStorage,
    track.title,
  ]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'studio':
        return <MainStage />;
      case 'youtube':
        return <YouTubeDrawer />;
      case 'lyrics':
        return <LyricsDrawer />;
      case 'presets':
        return <PresetsDrawer />;
      case 'export':
        return <ExportDrawer />;
      case 'settings':
        return <SettingsModal />;
      default:
        return <MainStage />;
    }
  };

  return (
    <div className="relative w-screen h-screen flex flex-col overflow-hidden bg-gatefold-bg text-gatefold-text">
      {/* Top Header (40px) */}
      <Header />

      {/* Middle Workspace: Collapsible Sidebar + Main Viewport / Drawer */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative z-10">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-0 flex overflow-hidden">
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center text-xs font-mono text-gatefold-text-3">
                Loading module...
              </div>
            }
          >
            {renderActiveView()}
          </Suspense>
        </main>
      </div>

      {/* Diagnostics / Telemetry Overlay */}
      <TelemetryOverlay />
    </div>
  );
};
