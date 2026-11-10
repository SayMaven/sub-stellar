import React, { useRef, useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Activity,
  Zap,
  Minus,
  Square,
  X,
  Save,
  FolderOpen,
  Film,
  Check,
  FilePlus,
  FileVideo,
  Download,
  Plus,
  Copy,
  Trash2,
  FileText,
  Eye,
  Monitor,
} from 'lucide-react';
import { usePerfStore } from '../../stores/usePerfStore';
import { useStudioStore } from '../../stores/useStudioStore';
import { downloadFile, generateAss, generateSrt } from '../../engine/text/SubtitleExporter';
import { getCanvasPixelDimensions } from '../../engine/layout/layoutMath';
import { parseLrc } from '../../services/lyrics/lrcParser';
import type { AspectRatio, CanvasResolutionPreset } from '../../types';

type MenuCategory = 'file' | 'subtitle' | 'view' | 'export' | null;

export const Header: React.FC = () => {
  const { mode, cycleQualityMode, toggleTelemetry, metrics } = usePerfStore();
  const {
    setActiveTab,
    track,
    lines,
    selectedLineId,
    style,
    setStyle,
    aspectRatio,
    setAspectRatio,
    canvasResolution,
    setCanvasResolution,
    setZoom,
    addLine,
    duplicateLine,
    deleteLine,
    setLines,
    clearProject,
    loadSampleTrack,
    loadLocalMedia,
    importLyrics,
    exportProjectJson,
    importProjectJson,
    saveToLocalStorage,
    setErrorMessage,
  } = useStudioStore();

  const projectInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const subtitleFileInputRef = useRef<HTMLInputElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const [openMenu, setOpenMenu] = useState<MenuCategory>(null);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSaveProject = () => {
    try {
      const json = exportProjectJson();
      saveToLocalStorage();
      const slug = (track.title || 'substellar_project')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');
      downloadFile(`${slug}.substellar`, json, 'application/json;charset=utf-8');
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 1800);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save project.');
    }
    setOpenMenu(null);
  };

  const handleOpenProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importProjectJson(String(reader.result || ''));
        saveToLocalStorage();
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Invalid .substellar project file.'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportMediaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadLocalMedia(file);
    setActiveTab('studio');
    e.target.value = '';
  };

  const handleImportSubtitleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result || '');
        const parsed = parseLrc(raw);
        if (parsed.length > 0) {
          importLyrics(parsed);
          saveToLocalStorage();
          setActiveTab('studio');
        } else {
          setErrorMessage('No subtitle lines found in the selected file.');
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to parse subtitle file.'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleQuickExportAss = () => {
    const slug = (track.title || 'substellar_project')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const dims = getCanvasPixelDimensions(aspectRatio, canvasResolution);
    const ass = generateAss(lines, style, track, dims);
    downloadFile(`${slug}.ass`, ass, 'text/plain;charset=utf-8');
    setOpenMenu(null);
  };

  const handleQuickExportSrt = () => {
    const slug = (track.title || 'substellar_project')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const srt = generateSrt(lines);
    downloadFile(`${slug}.srt`, srt, 'text/plain;charset=utf-8');
    setOpenMenu(null);
  };

  const getQualityBadgeColor = () => {
    switch (mode) {
      case 'low':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'balanced':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'ultra':
        return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
    }
  };

  const toggleMenu = (cat: Exclude<MenuCategory, null>) => {
    setOpenMenu((prev) => (prev === cat ? null : cat));
  };

  const hoverMenu = (cat: Exclude<MenuCategory, null>) => {
    if (openMenu !== null) {
      setOpenMenu(cat);
    }
  };

  return (
    <header className="h-10 shrink-0 w-full px-3 flex items-center justify-between border-b border-gatefold-line bg-gatefold-panel-strong z-50 select-none">
      {/* Hidden File Inputs */}
      <input
        ref={projectInputRef}
        type="file"
        accept=".substellar,.json,application/json"
        onChange={handleOpenProjectFile}
        className="hidden"
      />
      <input
        ref={mediaInputRef}
        type="file"
        accept="video/*,audio/*,.mp4,.webm,.mkv,.mov,.mp3,.wav,.flac,.ogg,.m4a"
        onChange={handleImportMediaFile}
        className="hidden"
      />
      <input
        ref={subtitleFileInputRef}
        type="file"
        accept=".lrc,.srt,.vtt,.txt"
        onChange={handleImportSubtitleFile}
        className="hidden"
      />

      {/* Left: Brand & Application Menu Bar (File, Subtitle, View, Export) */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          onClick={() => setActiveTab('studio')}
          className="flex items-center gap-2 cursor-pointer pr-2 border-r border-gatefold-line shrink-0"
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gatefold-accent/20 border border-gatefold-accent/40 text-gatefold-accent">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-xs tracking-wide text-gatefold-text">
            SubStellar
          </span>
        </div>

        {/* Classic Editor Top Menu Bar */}
        <div ref={menuContainerRef} className="flex items-center gap-0.5 relative">
          {/* FILE MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('file')}
              onMouseEnter={() => hoverMenu('file')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                openMenu === 'file'
                  ? 'bg-gatefold-accent/20 text-gatefold-accent'
                  : 'text-gatefold-text-2 hover:text-gatefold-text hover:bg-gatefold-hover'
              }`}
            >
              File
            </button>
            {openMenu === 'file' && (
              <div className="absolute left-0 top-full mt-1 w-60 rounded-lg bg-gatefold-surface border border-gatefold-line-2 shadow-xl py-1.5 z-50 text-xs">
                <button
                  onClick={() => {
                    clearProject();
                    setActiveTab('studio');
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span className="flex items-center gap-2">
                    <FilePlus className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>New Empty Project</span>
                  </span>
                </button>

                <button
                  onClick={() => {
                    projectInputRef.current?.click();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Open Project (.substellar)...</span>
                  </span>
                </button>

                <button
                  onClick={handleSaveProject}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span className="flex items-center gap-2">
                    <Save className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Save Project (.substellar)</span>
                  </span>
                  <kbd className="text-[10px] font-mono text-gatefold-text-3">Ctrl+S</kbd>
                </button>

                <div className="my-1 border-t border-gatefold-line" />

                <button
                  onClick={() => {
                    mediaInputRef.current?.click();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span className="flex items-center gap-2">
                    <FileVideo className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Import Local Video / Audio...</span>
                  </span>
                </button>

                <button
                  onClick={() => {
                    subtitleFileInputRef.current?.click();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Import Subtitle File (.lrc, .srt)...</span>
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('youtube');
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Fetch Video from YouTube...</span>
                  </span>
                  <kbd className="text-[10px] font-mono text-gatefold-text-3">Ctrl+K</kbd>
                </button>

                <div className="my-1 border-t border-gatefold-line" />

                <button
                  onClick={() => {
                    loadSampleTrack();
                    setActiveTab('studio');
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text-2"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Load J-Pop Demo Showcase</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* SUBTITLE MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('subtitle')}
              onMouseEnter={() => hoverMenu('subtitle')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                openMenu === 'subtitle'
                  ? 'bg-gatefold-accent/20 text-gatefold-accent'
                  : 'text-gatefold-text-2 hover:text-gatefold-text hover:bg-gatefold-hover'
              }`}
            >
              Subtitle
            </button>
            {openMenu === 'subtitle' && (
              <div className="absolute left-0 top-full mt-1 w-60 rounded-lg bg-gatefold-surface border border-gatefold-line-2 shadow-xl py-1.5 z-50 text-xs">
                <button
                  onClick={() => {
                    addLine();
                    setActiveTab('studio');
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Add New Line at Playhead</span>
                  </span>
                  <kbd className="text-[10px] font-mono text-gatefold-text-3">Ctrl+N</kbd>
                </button>

                <button
                  disabled={!selectedLineId}
                  onClick={() => {
                    if (selectedLineId) duplicateLine(selectedLineId);
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Duplicate Selected Line</span>
                  </span>
                </button>

                <button
                  disabled={!selectedLineId}
                  onClick={() => {
                    if (selectedLineId) deleteLine(selectedLineId);
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-red-300 disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Delete Selected Line</span>
                  </span>
                  <kbd className="text-[10px] font-mono text-gatefold-text-3">Del</kbd>
                </button>

                <div className="my-1 border-t border-gatefold-line" />

                <button
                  onClick={() => {
                    subtitleFileInputRef.current?.click();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Import Subtitle File (.lrc, .srt)...</span>
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('lyrics');
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Search Synced Lyrics Database...</span>
                  </span>
                </button>

                <button
                  disabled={lines.length === 0}
                  onClick={() => {
                    setLines([]);
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text-3 hover:text-red-300 disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Subtitle Lines</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* VIEW MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('view')}
              onMouseEnter={() => hoverMenu('view')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                openMenu === 'view'
                  ? 'bg-gatefold-accent/20 text-gatefold-accent'
                  : 'text-gatefold-text-2 hover:text-gatefold-text hover:bg-gatefold-hover'
              }`}
            >
              View
            </button>
            {openMenu === 'view' && (
              <div className="absolute left-0 top-full mt-1 w-60 rounded-lg bg-gatefold-surface border border-gatefold-line-2 shadow-xl py-1.5 z-50 text-xs">
                <div className="px-3 py-1 text-[10px] font-mono uppercase text-gatefold-text-3">
                  Aspect Ratio
                </div>
                <div className="px-3 pb-1.5 grid grid-cols-4 gap-1">
                  {(['16:9', '9:16', '1:1', '4:3'] as AspectRatio[]).map((ar) => (
                    <button
                      key={ar}
                      onClick={() => {
                        setAspectRatio(ar);
                        setOpenMenu(null);
                      }}
                      className={`py-1 rounded font-mono text-[11px] border ${
                        aspectRatio === ar
                          ? 'border-gatefold-accent bg-gatefold-accent/20 text-gatefold-accent'
                          : 'border-gatefold-line bg-gatefold-bg text-gatefold-text-3 hover:text-gatefold-text'
                      }`}
                    >
                      {ar}
                    </button>
                  ))}
                </div>

                <div className="my-1 border-t border-gatefold-line" />
                <div className="px-3 py-1 text-[10px] font-mono uppercase text-gatefold-text-3">
                  Canvas Resolution
                </div>
                {(['720p', '1080p', '1440p', '4k'] as CanvasResolutionPreset[]).map((res) => (
                  <button
                    key={res}
                    onClick={() => {
                      setCanvasResolution(res);
                      setOpenMenu(null);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                  >
                    <span className="flex items-center gap-2">
                      <Monitor className="w-3.5 h-3.5 text-gatefold-accent" />
                      <span className="uppercase font-mono">{res}</span>
                    </span>
                    {canvasResolution === res && (
                      <Check className="w-3.5 h-3.5 text-gatefold-accent" />
                    )}
                  </button>
                ))}

                <div className="my-1 border-t border-gatefold-line" />

                <button
                  onClick={() => {
                    setStyle({ showSafeGuides: !style.showSafeGuides });
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Broadcast Safe Guides</span>
                  </span>
                  {style.showSafeGuides && (
                    <Check className="w-3.5 h-3.5 text-gatefold-accent" />
                  )}
                </button>

                <button
                  onClick={() => {
                    setZoom(100);
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span>Reset Stage Zoom (100%)</span>
                </button>

                <button
                  onClick={() => {
                    toggleTelemetry();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span>Toggle Performance Telemetry</span>
                  <kbd className="text-[10px] font-mono text-gatefold-text-3">Ctrl+Shift+D</kbd>
                </button>
              </div>
            )}
          </div>

          {/* EXPORT MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('export')}
              onMouseEnter={() => hoverMenu('export')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                openMenu === 'export'
                  ? 'bg-gatefold-accent/20 text-gatefold-accent'
                  : 'text-gatefold-text-2 hover:text-gatefold-text hover:bg-gatefold-hover'
              }`}
            >
              Export
            </button>
            {openMenu === 'export' && (
              <div className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-gatefold-surface border border-gatefold-line-2 shadow-xl py-1.5 z-50 text-xs">
                <button
                  disabled={lines.length === 0}
                  onClick={handleQuickExportAss}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Export .ASS (Furigana & Karaoke)</span>
                  </span>
                </button>

                <button
                  disabled={lines.length === 0}
                  onClick={handleQuickExportSrt}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Export .SRT (Plain Subtitles)</span>
                  </span>
                </button>

                <div className="my-1 border-t border-gatefold-line" />

                <button
                  onClick={() => {
                    setActiveTab('export');
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-accent font-medium"
                >
                  <span className="flex items-center gap-2">
                    <Film className="w-3.5 h-3.5" />
                    <span>Render Video (MP4 / WebM / ProRes)...</span>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Saved Feedback Badge */}
        {savedToast && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
            <Check className="w-3 h-3" />
            Saved
          </span>
        )}

        {/* Active Track Indicator */}
        <div
          className="hidden xl:flex items-center gap-1.5 min-w-0 max-w-[220px] pl-2 border-l border-gatefold-line text-xs"
          title={`${track.title} - ${track.artist}`}
        >
          <span className="truncate text-gatefold-text">{track.title}</span>
          <span className="truncate text-gatefold-text-3">{track.artist}</span>
        </div>
      </div>

      {/* Quick Search / Paste URL Bar */}
      <div className="flex-1 max-w-sm mx-3">
        <div
          onClick={() => setActiveTab('youtube')}
          className="relative flex items-center h-7 px-2.5 rounded-md bg-gatefold-surface border border-gatefold-line hover:border-gatefold-line-2 cursor-pointer transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-gatefold-text-3 mr-2" />
          <span className="text-xs text-gatefold-text-3 flex-1 truncate">
            Quick search or paste YouTube link...
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-gatefold-text-3 bg-gatefold-surface-2 border border-gatefold-line rounded">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={cycleQualityMode}
          title="Toggle Hardware Quality Profile (Ctrl+Q)"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition-colors ${getQualityBadgeColor()}`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="uppercase">{mode}</span>
          <span className="text-[10px] opacity-75">({metrics.fps} FPS)</span>
        </button>

        <button
          onClick={toggleTelemetry}
          title="Toggle Diagnostics & Telemetry (Ctrl+Shift+D)"
          className="p-1.5 rounded-md text-gatefold-text-3 hover:text-gatefold-text hover:bg-gatefold-hover border border-transparent hover:border-gatefold-line transition-colors"
          aria-label="Diagnostics"
        >
          <Activity className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-gatefold-line mx-1" />

        <div className="flex items-center gap-1 text-gatefold-text-3">
          <button
            className="p-1.5 rounded hover:bg-gatefold-hover hover:text-gatefold-text transition-colors"
            aria-label="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-gatefold-hover hover:text-gatefold-text transition-colors"
            aria-label="Maximize"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
