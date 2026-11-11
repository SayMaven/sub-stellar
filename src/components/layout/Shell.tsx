import React, { Suspense, lazy, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MainStage } from '../studio/MainStage';
import { TelemetryOverlay } from '../common/TelemetryOverlay';
import { useStudioStore, AUTOSAVE_STORAGE_KEY } from '../../stores/useStudioStore';
import { usePerfStore } from '../../stores/usePerfStore';
import { isEditableTarget } from '../../engine/layout/layoutMath';
import { restoreCachedMediaFile, saveProjectToDisk } from '../../services/mediaCache';
import { tauriBridge } from '../../services/tauriBridge';

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
  const activeTab = useStudioStore((s) => s.activeTab);
  const togglePlay = useStudioStore((s) => s.togglePlay);
  const stepTime = useStudioStore((s) => s.stepTime);
  const setActiveTab = useStudioStore((s) => s.setActiveTab);
  const toggleLoop = useStudioStore((s) => s.toggleLoop);
  const selectedLineId = useStudioStore((s) => s.selectedLineId);
  const deleteLine = useStudioStore((s) => s.deleteLine);
  const addLine = useStudioStore((s) => s.addLine);
  const exportProjectJson = useStudioStore((s) => s.exportProjectJson);
  const importProjectJson = useStudioStore((s) => s.importProjectJson);
  const saveToLocalStorage = useStudioStore((s) => s.saveToLocalStorage);
  const setTrack = useStudioStore((s) => s.setTrack);
  const projectFilePath = useStudioStore((s) => s.projectFilePath);
  const setProjectFilePath = useStudioStore((s) => s.setProjectFilePath);
  const track = useStudioStore((s) => s.track);
  const lines = useStudioStore((s) => s.lines);
  const style = useStudioStore((s) => s.style);
  const aspectRatio = useStudioStore((s) => s.aspectRatio);
  const canvasResolution = useStudioStore((s) => s.canvasResolution);
  const cycleQualityMode = usePerfStore((s) => s.cycleQualityMode);
  const toggleTelemetry = usePerfStore((s) => s.toggleTelemetry);

  // Restore last auto-saved session + cached local video/audio on first mount
  useEffect(() => {
    let isMounted = true;

    async function restoreLastSession() {
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

      const currentTrack = useStudioStore.getState().track;

      // 1. If a native disk mediaFilePath exists (e.g. YouTube download or native file), restore via loadLocalMediaFromPath (with automatic Blob fallback)
      if (currentTrack.mediaFilePath && tauriBridge.isAvailable()) {
        try {
          await useStudioStore
            .getState()
            .loadLocalMediaFromPath(currentTrack.mediaFilePath, {
              preserveTimelineState: true,
            });
          return;
        } catch {
          // Fall through to IndexedDB cache
        }
      }

      // 2. If videoUrl/audioUrl was a blob: URL from the previous session (or missing), restore from IndexedDB
      const hasStaleBlob =
        Boolean(currentTrack.videoUrl?.startsWith('blob:')) ||
        Boolean(currentTrack.audioUrl?.startsWith('blob:')) ||
        (!currentTrack.videoUrl && !currentTrack.audioUrl && currentTrack.id.startsWith('local-'));

      if (hasStaleBlob) {
        const cached = await restoreCachedMediaFile();
        if (!isMounted) return;
        if (cached) {
          setTrack({
            videoUrl: cached.isVideo ? cached.url : undefined,
            audioUrl: !cached.isVideo ? cached.url : undefined,
          });
        } else {
          // Clear expired blob URL from previous session so <video> does not render a dead black frame
          setTrack({
            videoUrl: undefined,
            audioUrl: undefined,
          });
        }
      }
    }

    void restoreLastSession();

    return () => {
      isMounted = false;
    };
  }, [importProjectJson, setTrack]);

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
        const slug =
          (track.title || 'substellar_project').toLowerCase().replace(/[^a-z0-9_-]/g, '_') ||
          'substellar_project';
        void saveProjectToDisk({
          json,
          defaultFilename: `${slug}.substellar`,
          existingPath: projectFilePath,
          forceSaveAs: e.shiftKey,
        }).then((res) => {
          if (res.saved && res.path) {
            setProjectFilePath(res.path);
            window.dispatchEvent(
              new CustomEvent('substellar:project-saved', { detail: { path: res.path } })
            );
          }
        });
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
    projectFilePath,
    setProjectFilePath,
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
