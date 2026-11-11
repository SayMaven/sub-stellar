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
import { generateAss, generateSrt } from '../../engine/text/SubtitleExporter';
import { getCanvasPixelDimensions } from '../../engine/layout/layoutMath';
import { parseLrc } from '../../services/lyrics/lrcParser';
import {
  saveProjectToDisk,
  saveExportTextToDisk,
  openProjectWithFilePicker,
} from '../../services/mediaCache';
import { tauriBridge } from '../../services/tauriBridge';
import { AutoFuriganaDialog } from '../furigana/AutoFuriganaDialog';
import type { AspectRatio, CanvasResolutionPreset } from '../../types';

type MenuCategory = 'file' | 'subtitle' | 'view' | 'export' | null;

export const Header: React.FC = () => {
  const mode = usePerfStore((s) => s.mode);
  const cycleQualityMode = usePerfStore((s) => s.cycleQualityMode);
  const toggleTelemetry = usePerfStore((s) => s.toggleTelemetry);
  const fps = usePerfStore((s) => s.metrics.fps);

  const setActiveTab = useStudioStore((s) => s.setActiveTab);
  const track = useStudioStore((s) => s.track);
  const lines = useStudioStore((s) => s.lines);
  const selectedLineId = useStudioStore((s) => s.selectedLineId);
  const style = useStudioStore((s) => s.style);
  const setStyle = useStudioStore((s) => s.setStyle);
  const aspectRatio = useStudioStore((s) => s.aspectRatio);
  const setAspectRatio = useStudioStore((s) => s.setAspectRatio);
  const canvasResolution = useStudioStore((s) => s.canvasResolution);
  const setCanvasResolution = useStudioStore((s) => s.setCanvasResolution);
  const setZoom = useStudioStore((s) => s.setZoom);
  const addLine = useStudioStore((s) => s.addLine);
  const duplicateLine = useStudioStore((s) => s.duplicateLine);
  const deleteLine = useStudioStore((s) => s.deleteLine);
  const setLines = useStudioStore((s) => s.setLines);
  const clearProject = useStudioStore((s) => s.clearProject);
  const loadSampleTrack = useStudioStore((s) => s.loadSampleTrack);
  const loadLocalMedia = useStudioStore((s) => s.loadLocalMedia);
  const loadLocalMediaFromPath = useStudioStore((s) => s.loadLocalMediaFromPath);
  const importLyrics = useStudioStore((s) => s.importLyrics);
  const importProjectJson = useStudioStore((s) => s.importProjectJson);
  const saveToLocalStorage = useStudioStore((s) => s.saveToLocalStorage);
  const projectFilePath = useStudioStore((s) => s.projectFilePath);
  const setProjectFilePath = useStudioStore((s) => s.setProjectFilePath);
  const setErrorMessage = useStudioStore((s) => s.setErrorMessage);

  const projectInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const subtitleFileInputRef = useRef<HTMLInputElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const [openMenu, setOpenMenu] = useState<MenuCategory>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [noticeToast, setNoticeToast] = useState<string | null>(null);
  const [furiganaDialogOpen, setFuriganaDialogOpen] = useState(false);

  useEffect(() => {
    let noticeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleNotice = (e: Event) => {
      const custom = e as CustomEvent<{ message?: string }>;
      setNoticeToast(custom.detail?.message || null);
      if (noticeTimer) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => setNoticeToast(null), 3600);
    };
    window.addEventListener('substellar:notice', handleNotice);
    return () => {
      window.removeEventListener('substellar:notice', handleNotice);
      if (noticeTimer) clearTimeout(noticeTimer);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleProjectSaved = (e: Event) => {
      const custom = e as CustomEvent<{ path?: string }>;
      const rawPath = custom.detail?.path || 'Saved';
      const baseName = rawPath.split(/[/\\]/).pop() || rawPath;
      setSavedToast(baseName);
      setTimeout(() => setSavedToast(null), 2400);
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('substellar:project-saved', handleProjectSaved);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('substellar:project-saved', handleProjectSaved);
    };
  }, []);

  const handleSaveProject = async (forceSaveAs = false) => {
    setOpenMenu(null);
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
        forceSaveAs,
      });
      if (res.saved && res.path) {
        setProjectFilePath(res.path);
        latest.saveToLocalStorage();
        const baseName = res.path.split(/[/\\]/).pop() || res.path;
        setSavedToast(baseName);
        setTimeout(() => setSavedToast(null), 2400);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save project.');
    }
  };

  const handleTriggerOpenProject = async () => {
    setOpenMenu(null);
    if (tauriBridge.isAvailable()) {
      try {
        const opened = await tauriBridge.openProjectDialog();
        if (opened) {
          importProjectJson(opened.contents);
          setProjectFilePath(opened.path);
          saveToLocalStorage();
          setActiveTab('studio');
        }
        return;
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to open project file.');
      }
    }
    const picked = await openProjectWithFilePicker();
    if (picked) {
      if (picked.contents) {
        try {
          importProjectJson(picked.contents);
          setProjectFilePath(picked.path);
          saveToLocalStorage();
          setActiveTab('studio');
        } catch (err) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Invalid .substellar project file.'
          );
        }
      }
      return;
    }
    projectInputRef.current?.click();
  };

  const handleOpenProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importProjectJson(String(reader.result || ''));
        setProjectFilePath(file.name);
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

  const handleTriggerOpenMedia = async () => {
    setOpenMenu(null);
    if (tauriBridge.isAvailable()) {
      try {
        const chosenPath = await tauriBridge.openMediaDialog();
        if (chosenPath) {
          await loadLocalMediaFromPath(chosenPath);
          saveToLocalStorage();
          setActiveTab('studio');
        }
        return;
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to open media file.');
      }
    }
    mediaInputRef.current?.click();
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

  const handleQuickExportAss = async () => {
    setOpenMenu(null);
    const slug =
      (track.title || 'substellar_project').toLowerCase().replace(/[^a-z0-9_-]/g, '_') ||
      'substellar_project';
    const dims = getCanvasPixelDimensions(aspectRatio, canvasResolution);
    const ass = generateAss(lines, style, track, dims);
    try {
      const res = await saveExportTextToDisk({
        content: ass,
        defaultFilename: `${slug}.ass`,
        ext: 'ass',
      });
      if (res.saved && res.path) {
        const baseName = res.path.split(/[/\\]/).pop() || res.path;
        setSavedToast(baseName);
        setTimeout(() => setSavedToast(null), 2800);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to export .ASS file.');
    }
  };

  const handleQuickExportSrt = async () => {
    setOpenMenu(null);
    const slug =
      (track.title || 'substellar_project').toLowerCase().replace(/[^a-z0-9_-]/g, '_') ||
      'substellar_project';
    const srt = generateSrt(lines);
    try {
      const res = await saveExportTextToDisk({
        content: srt,
        defaultFilename: `${slug}.srt`,
        ext: 'srt',
      });
      if (res.saved && res.path) {
        const baseName = res.path.split(/[/\\]/).pop() || res.path;
        setSavedToast(baseName);
        setTimeout(() => setSavedToast(null), 2800);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to export .SRT file.');
    }
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
      <AutoFuriganaDialog
        isOpen={furiganaDialogOpen}
        onClose={() => setFuriganaDialogOpen(false)}
      />
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
                  onClick={() => void handleTriggerOpenProject()}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Open Project (.substellar)...</span>
                  </span>
                </button>

                <button
                  onClick={() => void handleSaveProject(false)}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span className="flex items-center gap-2">
                    <Save className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Save Project</span>
                  </span>
                  <kbd className="text-[10px] font-mono text-gatefold-text-3">Ctrl+S</kbd>
                </button>

                <button
                  onClick={() => void handleSaveProject(true)}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text"
                >
                  <span className="flex items-center gap-2">
                    <Save className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Save Project As (.substellar)...</span>
                  </span>
                  <kbd className="text-[10px] font-mono text-gatefold-text-3">Ctrl+Shift+S</kbd>
                </button>

                <div className="my-1 border-t border-gatefold-line" />

                <button
                  onClick={() => void handleTriggerOpenMedia()}
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
                    setFuriganaDialogOpen(true);
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-gatefold-hover flex items-center justify-between text-left text-gatefold-text disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Auto Furigana — Semua Baris...</span>
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
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono max-w-[180px] truncate"
            title={projectFilePath || savedToast}
          >
            <Check className="w-3 h-3 shrink-0" />
            <span className="truncate">Saved: {savedToast}</span>
          </span>
        )}

        {/* Notice Badge (e.g. word timing re-split after furigana edit) */}
        {noticeToast && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-mono max-w-[260px] truncate"
            title={noticeToast}
          >
            <span className="truncate">{noticeToast}</span>
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
          <span className="text-[10px] opacity-75">({fps} FPS)</span>
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
