import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Cpu,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  FolderOpen,
  FileCheck,
  ExternalLink,
  Video,
} from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import { generateAss, generateSrt, generateStyledBurninAss } from '../../engine/text/SubtitleExporter';
import { getCanvasPixelDimensions } from '../../engine/layout/layoutMath';
import {
  tauriBridge,
  type HardwareCapabilities,
  type ExportProgress,
} from '../../services/tauriBridge';
import {
  saveProjectToDisk,
  saveExportTextToDisk,
  openProjectWithFilePicker,
} from '../../services/mediaCache';
import { FFmpegExportPipeline } from '../../engine/export/FFmpegExportPipeline';
import { confirmBeforeDiscardingProject } from '../common/UnsavedChangesModal';
import type { CanvasResolutionPreset } from '../../types';

export const ExportDrawer: React.FC = () => {
  const lines = useStudioStore((s) => s.lines);
  const style = useStudioStore((s) => s.style);
  const track = useStudioStore((s) => s.track);
  const duration = useStudioStore((s) => s.duration);
  const aspectRatio = useStudioStore((s) => s.aspectRatio);
  const canvasResolution = useStudioStore((s) => s.canvasResolution);
  const setCanvasResolution = useStudioStore((s) => s.setCanvasResolution);
  const importProjectJson = useStudioStore((s) => s.importProjectJson);
  const saveToLocalStorage = useStudioStore((s) => s.saveToLocalStorage);
  const projectFilePath = useStudioStore((s) => s.projectFilePath);
  const setProjectFilePath = useStudioStore((s) => s.setProjectFilePath);
  const loadLocalMediaFromPath = useStudioStore((s) => s.loadLocalMediaFromPath);

  const [format, setFormat] = useState<'ass' | 'srt' | 'mp4' | 'webm' | 'prores'>('ass');
  const [mp4RenderMethod, setMp4RenderMethod] = useState<'canvas_pipe' | 'ass_burnin'>(
    'canvas_pipe'
  );
  const [fps, setFps] = useState<number>(60);
  const initialCachedCaps = tauriBridge.getCachedHardwareCapabilities();
  const [selectedEncoder, setSelectedEncoder] = useState<string>(
    initialCachedCaps?.primary_encoder || 'libx264'
  );
  const [hardwareCaps, setHardwareCaps] = useState<HardwareCapabilities | null>(initialCachedCaps);
  const [targetOutputPath, setTargetOutputPath] = useState<string>('');
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pipelineRef = useRef<FFmpegExportPipeline | null>(null);
  const burninSessionRef = useRef<string | null>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    tauriBridge
      .probeHardwareCapabilities()
      .then((caps) => {
        setHardwareCaps(caps);
        if (caps.primary_encoder) {
          setSelectedEncoder((prev) => (prev === 'libx264' ? caps.primary_encoder : prev));
        }
      })
      .catch(() => {});
  }, []);

  const targetDims = getCanvasPixelDimensions(aspectRatio, canvasResolution);

  const getFileExtension = (fmt: typeof format): 'ass' | 'srt' | 'mp4' | 'webm' | 'mov' => {
    if (fmt === 'ass') return 'ass';
    if (fmt === 'srt') return 'srt';
    if (fmt === 'webm') return 'webm';
    if (fmt === 'prores') return 'mov';
    return 'mp4';
  };

  const getDefaultExportFilename = (fmt: typeof format): string => {
    const baseName =
      (track.title || 'substellar_project').toLowerCase().replace(/[^a-z0-9_-]/g, '_') ||
      'substellar_project';
    const ext = getFileExtension(fmt);
    if (fmt === 'ass' || fmt === 'srt') {
      return `${baseName}.${ext}`;
    }
    return `${baseName}_${canvasResolution}.${ext}`;
  };

  // Keep default target filename synced when format or resolution changes (unless user picked an explicit path with matching extension)
  useEffect(() => {
    const ext = getFileExtension(format);
    if (!targetOutputPath) {
      // If we have a mediaFilePath or projectFilePath, default to its folder so the user immediately sees the full directory
      const refPath = track.mediaFilePath || projectFilePath;
      const defaultFile = getDefaultExportFilename(format);
      if (refPath && (refPath.includes('\\') || refPath.includes('/'))) {
        const sep = refPath.includes('\\') ? '\\' : '/';
        const dir = refPath.substring(0, refPath.lastIndexOf(sep));
        if (dir) {
          setTargetOutputPath(`${dir}${sep}${defaultFile}`);
          return;
        }
      }
      setTargetOutputPath(defaultFile);
      return;
    }

    // Update extension if user switched format tab
    const cleaned = targetOutputPath.replace(/\.(ass|srt|mp4|webm|mov)$/i, '');
    setTargetOutputPath(`${cleaned}.${ext}`);
  }, [format, canvasResolution, track.title, track.mediaFilePath, projectFilePath]);

  const handleBrowseOutputPath = async () => {
    const ext = getFileExtension(format);
    const defaultName =
      targetOutputPath.split(/[/\\]/).pop() || getDefaultExportFilename(format);
    if (tauriBridge.isAvailable()) {
      try {
        const chosen = await tauriBridge.exportSaveDialog(defaultName, ext);
        if (chosen) {
          setTargetOutputPath(chosen);
          setErrorMessage(null);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to open target save dialog.'
        );
      }
    }
  };

  const handlePickSourceVideoForRender = async () => {
    if (!tauriBridge.isAvailable()) return;
    try {
      const chosen = await tauriBridge.openMediaDialog();
      if (chosen) {
        await loadLocalMediaFromPath(chosen);
        saveToLocalStorage();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to select source video.');
    }
  };

  const handleSaveProject = async () => {
    const latest = useStudioStore.getState();
    const baseName =
      (latest.track.title || 'substellar_project').toLowerCase().replace(/[^a-z0-9_-]/g, '_') ||
      'substellar_project';
    const json = latest.exportProjectJson();
    latest.saveToLocalStorage();
    try {
      const res = await saveProjectToDisk({
        json,
        defaultFilename: `${baseName}.substellar`,
        existingPath: latest.projectFilePath,
        forceSaveAs: false,
      });
      if (res.saved && res.path) {
        latest.markProjectSaved(res.path);
        latest.saveToLocalStorage();
        setLastSavedPath(res.path);
        setExportSuccess(`Project saved to: ${res.path} (${lines.length} subtitle lines).`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save project.');
    }
  };

  const handleTriggerOpenProject = async () => {
    const allowed = await confirmBeforeDiscardingProject('membuka proyek lain');
    if (!allowed) return;
    if (tauriBridge.isAvailable()) {
      try {
        const opened = await tauriBridge.openProjectDialog();
        if (opened) {
          importProjectJson(opened.contents);
          setProjectFilePath(opened.path);
          saveToLocalStorage();
          setExportSuccess(`Loaded project file: ${opened.path}`);
          setErrorMessage(null);
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
          setExportSuccess(`Loaded project file: ${picked.path}`);
          setErrorMessage(null);
        } catch (err) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Failed to parse .substellar project file.'
          );
        }
      }
      return;
    }
    projectFileInputRef.current?.click();
  };

  const handleOpenProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importProjectJson(String(reader.result || ''));
        setProjectFilePath(file.name);
        saveToLocalStorage();
        setExportSuccess(`Loaded project file: ${file.name}`);
        setErrorMessage(null);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to parse .substellar project file.'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCancel = () => {
    if (pipelineRef.current) {
      pipelineRef.current.cancel();
    }
    if (burninSessionRef.current) {
      void tauriBridge.ffmpegCancelExport(burninSessionRef.current);
      burninSessionRef.current = null;
    }
    setIsExporting(false);
    setProgress(null);
    setErrorMessage('Export cancelled by user.');
  };

  const handleExport = async () => {
    const ext = getFileExtension(format);
    const defaultFilename = getDefaultExportFilename(format);

    setIsExporting(true);
    setExportSuccess(null);
    setErrorMessage(null);
    setProgress(null);

    try {
      if (format === 'ass' || format === 'srt') {
        const textContent =
          format === 'ass'
            ? generateAss(lines, style, track, targetDims)
            : generateSrt(lines);

        // Always confirm or use the selected path via saveExportTextToDisk
        let finalTargetPath: string | null = null;
        if (tauriBridge.isAvailable()) {
          finalTargetPath = await tauriBridge.exportSaveDialog(
            targetOutputPath.split(/[/\\]/).pop() || defaultFilename,
            ext
          );
          if (!finalTargetPath) {
            setIsExporting(false);
            return;
          }
          setTargetOutputPath(finalTargetPath);
        }

        const saved = await saveExportTextToDisk({
          content: textContent,
          defaultFilename,
          ext: format,
          targetPath: finalTargetPath,
        });

        if (saved.saved && saved.path) {
          setLastSavedPath(saved.path);
          setExportSuccess(
            format === 'ass'
              ? `Saved ${lines.length} subtitle lines (${targetDims.width}×${targetDims.height}) to: ${saved.path}`
              : `Saved ${lines.length} SRT subtitle lines to: ${saved.path}`
          );
        }
        setIsExporting(false);
        return;
      }

      // Video Render (.mp4, .webm, .mov)
      let outputPath = targetOutputPath.trim() || defaultFilename;
      if (tauriBridge.isAvailable()) {
        const chosen = await tauriBridge.exportSaveDialog(
          outputPath.split(/[/\\]/).pop() || defaultFilename,
          ext
        );
        if (!chosen) {
          setIsExporting(false);
          return;
        }
        outputPath = chosen;
        setTargetOutputPath(chosen);
      }

      const { width, height } = targetDims;

      // Fast Hardware ASS Burn-in mode (requires source video path on disk)
      if (format === 'mp4' && mp4RenderMethod === 'ass_burnin') {
        if (!track.mediaFilePath) {
          setErrorMessage(
            'Fast ASS Hardware Burn-in requires a local source video file on disk. Please select a local video file above or switch to "Full Canvas Overlay Pipe".'
          );
          setIsExporting(false);
          return;
        }
        const burninSessionId = `burnin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        burninSessionRef.current = burninSessionId;
        setProgress({
          session_id: burninSessionId,
          frames_written: 0,
          total_frames: Math.max(1, Math.round(Math.max(1, duration) * fps)),
          percentage: 0,
          fps: 0,
        });
        const assContent = generateStyledBurninAss(lines, style, track, targetDims);
        const tempAssPath = `${outputPath}.burnin_${burninSessionId}.ass`;
        await tauriBridge.writeProjectFile(tempAssPath, assContent);
        const unlisten = await tauriBridge.onAssBurninProgress((prog) => {
          if (prog.session_id === burninSessionId) {
            setProgress(prog);
          }
        });
        try {
          const burnResult = await tauriBridge.ffmpegExportAssBurnin(
            track.mediaFilePath,
            tempAssPath,
            outputPath,
            selectedEncoder,
            {
              sessionId: burninSessionId,
              durationSecs: Math.max(1, duration),
              fps,
              fontFamily: style.fontFamily,
            }
          );
          if (burnResult.success) {
            const sizeMb = (burnResult.file_size_bytes / (1024 * 1024)).toFixed(2);
            setLastSavedPath(burnResult.output_path);
            setExportSuccess(
              `Hardware ASS Burn-in completed in ${burnResult.elapsed_seconds.toFixed(1)}s (${sizeMb} MB) -> ${burnResult.output_path}`
            );
          } else {
            setErrorMessage(burnResult.error_message || 'Hardware ASS burn-in failed.');
          }
        } finally {
          unlisten();
          burninSessionRef.current = null;
        }
        setIsExporting(false);
        return;
      }

      const mode =
        format === 'webm' ? 'webm_alpha' : format === 'prores' ? 'prores_alpha' : 'mp4_burnin';

      const pipeline = new FFmpegExportPipeline();
      pipelineRef.current = pipeline;

      const result = await pipeline.runExport({
        outputPath,
        mode,
        encoder: selectedEncoder,
        width,
        height,
        fps,
        duration: Math.max(1, duration),
        audioSourcePath: track.mediaFilePath,
        lines,
        style: {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          primaryColor: style.fillColor,
          wordActiveColor: style.wordActiveColor,
          outlineColor: style.innerStrokeColor,
          secondaryOutlineColor: style.outerStrokeColor,
          outlineThickness: style.outerStrokeWidth,
          innerStrokeWidth: style.innerStrokeWidth,
          fillGradientEnabled: style.fillGradientEnabled,
          fillGradientEndColor: style.fillGradientEndColor,
          glowColor: style.glowColor,
          glowBlur: style.glowBlur,
          rubyFillColor: style.rubyFillColor,
          rubyActiveColor: style.rubyActiveColor,
          translationFillColor: style.translationFillColor,
          rubySizeRatio: style.rubyScale,
          wordTransitionMs: style.wordTransitionMs,
          wordAnimStyle: style.wordAnimStyle,
          verticalPosition: style.verticalPosition,
          xOffset: style.xOffset,
          yOffset: style.yOffset,
          particleEnabled: style.particleEnabled,
          particlePreset: style.particlePreset,
          particleBurstCount: style.particleBurstCount,
          particleSpeed: style.particleSpeed,
          particleGravity: style.particleGravity,
          particleSize: style.particleSize,
          particleLifetime: style.particleLifetime,
          particleColorMode: style.particleColorMode,
        },
        onProgress: (prog) => {
          setProgress(prog);
        },
      });

      if (result.success) {
        const sizeMb = (result.file_size_bytes / (1024 * 1024)).toFixed(2);
        setLastSavedPath(result.output_path);
        setExportSuccess(
          `Video render completed in ${result.elapsed_seconds.toFixed(1)}s (${sizeMb} MB) -> ${result.output_path}`
        );
      } else {
        setErrorMessage(result.error_message || 'Video export failed.');
      }
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsExporting(false);
      setProgress(null);
      pipelineRef.current = null;
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-gatefold-bg/30 select-none">
      <div className="w-full max-w-[1720px] mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
            <Film className="w-5 h-5 text-gatefold-accent" />
            <span>Project Save & Export Center</span>
          </h2>
          <p className="text-xs text-gatefold-text-3 mt-1">
            Save or restore `.substellar` project files, or export subtitles & rendered video with hardware acceleration.
          </p>
        </div>

        {/* Top 2-Column Banner: Project File Save/Open + Hardware Acceleration Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Project File Save / Open Card */}
          <div className="gatefold-card-strong p-4 flex flex-col justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-gatefold-text">
                SubStellar Project File (.substellar)
              </h4>
              <p className="text-[11px] text-gatefold-text-3 mt-0.5">
                Preserves all subtitle lines, translations, per-word vocal timings, ruby tags, and canvas resolution ({aspectRatio} • {canvasResolution}).
              </p>
              {projectFilePath && (
                <div className="text-[10px] font-mono text-gatefold-accent mt-1 truncate">
                  Active project: {projectFilePath}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-2 border-t border-gatefold-line">
              <input
                ref={projectFileInputRef}
                type="file"
                accept=".substellar,.json,application/json"
                onChange={handleOpenProject}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => void handleTriggerOpenProject()}
                className="px-3 py-2 rounded-lg bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-xs font-semibold text-gatefold-text flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5 text-gatefold-accent" />
                <span>Open Project</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSaveProject()}
                className="px-3 py-2 rounded-lg bg-gatefold-accent text-gatefold-bg text-xs font-semibold hover:opacity-90 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Project As...</span>
              </button>
            </div>
          </div>

          {/* Real Hardware Probing Card */}
          <div className="gatefold-card p-4 flex flex-col justify-between border-emerald-500/30 bg-emerald-500/5 gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Cpu className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-gatefold-text flex items-center gap-2">
                    <span>Hardware Acceleration</span>
                    {hardwareCaps?.gpu_accelerated && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40">
                        GPU ACTIVE
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-gatefold-text-3 font-mono mt-0.5">
                    Primary:{' '}
                    <span className="text-emerald-400 font-semibold">
                      {hardwareCaps?.primary_encoder || 'libx264 (CPU)'}
                    </span>{' '}
                    • Codecs: {hardwareCaps?.available_encoders.join(', ') || 'libx264'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                {hardwareCaps?.ffmpeg_found ? 'FFMPEG ONLINE' : 'READY'}
              </span>
            </div>
            <div className="text-[10px] text-gatefold-text-3 font-mono pt-2 border-t border-emerald-500/20 flex justify-between items-center">
              <span>VP9 Alpha: {hardwareCaps?.supports_alpha_webm ? 'Supported' : 'No'}</span>
              <span>ProRes 4444 Alpha: {hardwareCaps?.supports_alpha_prores ? 'Supported' : 'No'}</span>
            </div>
          </div>
        </div>

        {/* Main 2-Column Responsive Studio Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Format & Parameters */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-5">
            {/* Format Selector */}
            <div className="gatefold-card-strong p-5 space-y-4">
              <label className="block text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider font-mono">
                Export Target Format
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
                {[
                  { id: 'ass', name: 'ASS Vector', desc: 'Full Furigana & \\k timing' },
                  { id: 'srt', name: 'SubRip (SRT)', desc: 'Universal text subtitles' },
                  { id: 'mp4', name: 'MP4 Video', desc: 'Hardware Burn-in' },
                  { id: 'webm', name: 'WebM Alpha', desc: 'VP9 Transparent Overlay' },
                  { id: 'prores', name: 'ProRes 4444', desc: 'Pro Studio Alpha MOV' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id as 'ass' | 'srt' | 'mp4' | 'webm' | 'prores')}
                    className={`p-3 rounded-lg text-left transition-all border ${
                      format === f.id
                        ? 'bg-gatefold-accent/15 border-gatefold-accent text-gatefold-accent'
                        : 'bg-gatefold-surface border-gatefold-line text-gatefold-text hover:border-gatefold-line-2'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>{f.name}</span>
                      {format === f.id && <CheckCircle2 className="w-3.5 h-3.5 text-gatefold-accent" />}
                    </div>
                    <div className="text-[10px] text-gatefold-text-3 mt-1 leading-snug">{f.desc}</div>
                  </button>
                ))}
              </div>

              {/* Target Output Location & Info */}
              <div className="p-3.5 rounded-lg bg-gatefold-surface border border-gatefold-line space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] font-mono text-gatefold-text-2 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Target Output File & Location (.{getFileExtension(format)})</span>
                  </label>
                  <span className="text-[10px] font-mono text-gatefold-text-3">
                    {lines.length} subtitle lines • {targetDims.width}×{targetDims.height}px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={targetOutputPath}
                    onChange={(e) => setTargetOutputPath(e.target.value)}
                    placeholder={getDefaultExportFilename(format)}
                    className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-gatefold-bg border border-gatefold-line rounded text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                  />
                  {tauriBridge.isAvailable() && (
                    <button
                      type="button"
                      onClick={() => void handleBrowseOutputPath()}
                      className="px-3 py-1.5 rounded bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-xs font-semibold text-gatefold-accent flex items-center gap-1.5 shrink-0"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Browse...</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-gatefold-text-3 leading-relaxed">
                  Saat tombol Export ditekan, dialog penyimpanan akan mengonfirmasi lokasi file hasil ekspor Anda.
                </p>
              </div>

              {/* Source Video & Render Pipeline Info (when rendering video) */}
              {(format === 'mp4' || format === 'webm' || format === 'prores') && (
                <div className="p-3.5 rounded-lg bg-gatefold-surface border border-gatefold-line space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono uppercase text-gatefold-text-2 flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-gatefold-accent" />
                        <span>Source Video / Audio Input for Render</span>
                      </div>
                      <div className="text-xs font-mono text-gatefold-text mt-1 truncate">
                        {track.mediaFilePath ? (
                          <span className="text-emerald-400">{track.mediaFilePath}</span>
                        ) : (
                          <span className="text-amber-300">
                            No disk file path linked ({track.title}) — subtitles will render on transparent or studio canvas background.
                          </span>
                        )}
                      </div>
                    </div>
                    {tauriBridge.isAvailable() && (
                      <button
                        type="button"
                        onClick={() => void handlePickSourceVideoForRender()}
                        className="px-2.5 py-1.5 rounded bg-gatefold-bg hover:bg-gatefold-hover border border-gatefold-line text-[11px] font-semibold text-gatefold-text shrink-0"
                      >
                        Select Source Video...
                      </button>
                    )}
                  </div>

                  {format === 'mp4' && (
                    <div className="pt-2 border-t border-gatefold-line space-y-1.5">
                      <label className="text-[10px] font-mono text-gatefold-text-3 block uppercase">
                        MP4 Subtitle Render Pipeline
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMp4RenderMethod('canvas_pipe')}
                          className={`p-2.5 rounded border text-left transition-colors ${
                            mp4RenderMethod === 'canvas_pipe'
                              ? 'bg-gatefold-accent/15 border-gatefold-accent text-gatefold-accent'
                              : 'bg-gatefold-bg border-gatefold-line text-gatefold-text-2 hover:text-gatefold-text'
                          }`}
                        >
                          <div className="text-xs font-semibold">
                            Full Canvas Overlay Pipe (Recommended)
                          </div>
                          <div className="text-[10px] text-gatefold-text-3 mt-0.5">
                            Renders exact SubStellar vocal animations, Furigana & double-stroke onto source video + audio.
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMp4RenderMethod('ass_burnin')}
                          className={`p-2.5 rounded border text-left transition-colors ${
                            mp4RenderMethod === 'ass_burnin'
                              ? 'bg-gatefold-accent/15 border-gatefold-accent text-gatefold-accent'
                              : 'bg-gatefold-bg border-gatefold-line text-gatefold-text-2 hover:text-gatefold-text'
                          }`}
                        >
                          <div className="text-xs font-semibold">
                            Fast Hardware ASS Burn-in (Direct FFmpeg + GPU)
                          </div>
                          <div className="text-[10px] text-gatefold-text-3 mt-0.5">
                            Ultra-fast GPU hardware encode with multi-layer SubStellar Furigana, glow, double-stroke & karaoke flow.
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Canvas & Export Resolution Specifications */}
              <div className="space-y-3 pt-3 border-t border-gatefold-line">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-gatefold-text-3 block uppercase mb-1">
                      Canvas & Output Resolution ({aspectRatio})
                    </label>
                    <select
                      value={canvasResolution}
                      onChange={(e) => setCanvasResolution(e.target.value as CanvasResolutionPreset)}
                      className="w-full px-2.5 py-1.5 text-xs bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                    >
                      <option value="720p">720p HD (Low-End Fast)</option>
                      <option value="1080p">1080p Full HD</option>
                      <option value="1440p">1440p 2K QHD</option>
                      <option value="4k">4K Ultra HD</option>
                    </select>
                    <span className="text-[10px] font-mono text-gatefold-accent mt-1 block">
                      Dimensions: {targetDims.width}×{targetDims.height} px
                    </span>
                  </div>

                  {(format === 'mp4' || format === 'webm' || format === 'prores') && (
                    <>
                      <div>
                        <label className="text-[10px] font-mono text-gatefold-text-3 block uppercase mb-1">
                          Framerate
                        </label>
                        <select
                          value={fps}
                          onChange={(e) => setFps(parseInt(e.target.value, 10))}
                          className="w-full px-2.5 py-1.5 text-xs bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                        >
                          <option value={60}>60 FPS (Ultra smooth motion)</option>
                          <option value={30}>30 FPS (Standard video)</option>
                          <option value={24}>24 FPS (Cinematic standard)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-mono text-gatefold-text-3 block uppercase mb-1">
                          Video Encoder
                        </label>
                        <select
                          value={selectedEncoder}
                          onChange={(e) => setSelectedEncoder(e.target.value)}
                          disabled={format !== 'mp4'}
                          className="w-full px-2.5 py-1.5 text-xs bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text focus:border-gatefold-accent focus:outline-none disabled:opacity-50"
                        >
                          {format === 'webm' ? (
                            <option value="libvpx-vp9">libvpx-vp9 (CPU Alpha YUVA420p)</option>
                          ) : format === 'prores' ? (
                            <option value="prores_ks">prores_ks (CPU Alpha 4444)</option>
                          ) : (
                            (hardwareCaps?.available_encoders || ['libx264']).map((enc) => (
                              <option key={enc} value={enc}>
                                {enc === 'h264_nvenc'
                                  ? 'NVIDIA NVENC (Hardware)'
                                  : enc === 'h264_qsv'
                                  ? 'Intel QuickSync (Hardware)'
                                  : enc === 'h264_amf'
                                  ? 'AMD AMF (Hardware)'
                                  : enc === 'h264_videotoolbox'
                                  ? 'Apple VideoToolbox (Hardware)'
                                  : 'libx264 (CPU Software Fallback)'}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Specifications, Live Pipeline Summary & Actions */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5">
            {/* Summary Card */}
            <div className="gatefold-card-strong p-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-gatefold-text flex items-center justify-between">
                <span>Export Specifications</span>
                <span className="text-[10px] text-gatefold-accent">
                  {format.toUpperCase()}
                </span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-gatefold-line">
                  <span className="text-gatefold-text-3">Subtitle Lines</span>
                  <span className="font-mono text-gatefold-text">{lines.length} lines</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gatefold-line">
                  <span className="text-gatefold-text-3">Canvas Dimensions</span>
                  <span className="font-mono text-gatefold-text">{targetDims.width} × {targetDims.height}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gatefold-line">
                  <span className="text-gatefold-text-3">Aspect Ratio</span>
                  <span className="font-mono text-gatefold-text">{aspectRatio}</span>
                </div>
                {(format === 'mp4' || format === 'webm' || format === 'prores') && (
                  <>
                    <div className="flex justify-between py-1 border-b border-gatefold-line">
                      <span className="text-gatefold-text-3">Framerate</span>
                      <span className="font-mono text-gatefold-text">{fps} FPS</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gatefold-line">
                      <span className="text-gatefold-text-3">Hardware Encoder</span>
                      <span className="font-mono text-emerald-400 font-semibold">{selectedEncoder}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-gatefold-text-3">Track Title</span>
                  <span className="font-mono text-gatefold-text truncate max-w-[180px]">{track.title || 'Untitled'}</span>
                </div>
              </div>

              {/* Live Render Progress */}
              {isExporting && progress && (
                <div className="p-4 rounded-lg bg-gatefold-surface border border-gatefold-line space-y-2.5">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-gatefold-text flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gatefold-accent" />
                      <span>
                        Frame {progress.frames_written} / {progress.total_frames}
                      </span>
                    </span>
                    <span className="text-gatefold-accent font-semibold">
                      {progress.percentage.toFixed(1)}% ({progress.fps.toFixed(1)} FPS)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gatefold-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gatefold-accent transition-all duration-150"
                      style={{ width: `${Math.min(100, progress.percentage)}%` }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-[11px] font-medium"
                    >
                      Cancel Render
                    </button>
                  </div>
                </div>
              )}

              {/* Error Feedback */}
              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Success Feedback & Saved Location Info */}
              {exportSuccess && (
                <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2 text-xs text-emerald-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-semibold text-emerald-200">{exportSuccess}</div>
                        {lastSavedPath && (
                          <div className="text-[11px] font-mono text-emerald-300/90 mt-1 break-all flex items-center gap-1.5">
                            <FileCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>Lokasi File: {lastSavedPath}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {lastSavedPath && tauriBridge.isAvailable() && (
                      <button
                        type="button"
                        onClick={() => void tauriBridge.revealInExplorer(lastSavedPath)}
                        className="px-2.5 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-[11px] font-semibold flex items-center gap-1.5 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Folder</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Export Trigger Button */}
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={isExporting || lines.length === 0}
                className="w-full py-3 px-4 bg-gatefold-accent text-gatefold-bg font-semibold text-xs rounded-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Rendering / Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>
                      {format === 'ass' || format === 'srt'
                        ? `Save & Export .${format.toUpperCase()} Subtitle File...`
                        : `Choose Save Location & Render Video (${format.toUpperCase()} • ${targetDims.width}×${targetDims.height})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
