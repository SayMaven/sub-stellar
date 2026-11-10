import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Cpu,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import { generateAss, generateSrt, downloadFile } from '../../engine/text/SubtitleExporter';
import { tauriBridge, type HardwareCapabilities, type ExportProgress } from '../../services/tauriBridge';
import { FFmpegExportPipeline } from '../../engine/export/FFmpegExportPipeline';

export const ExportDrawer: React.FC = () => {
  const { lines, style, track, duration } = useStudioStore();

  const [format, setFormat] = useState<'ass' | 'srt' | 'mp4' | 'webm' | 'prores'>('ass');
  const [resolution, setResolution] = useState<'1080p' | '720p' | '4k'>('1080p');
  const [fps, setFps] = useState<number>(60);
  const [selectedEncoder, setSelectedEncoder] = useState<string>('libx264');
  const [hardwareCaps, setHardwareCaps] = useState<HardwareCapabilities | null>(null);
  
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pipelineRef = useRef<FFmpegExportPipeline | null>(null);

  useEffect(() => {
    tauriBridge.probeHardwareCapabilities().then((caps) => {
      setHardwareCaps(caps);
      if (caps.primary_encoder) {
        setSelectedEncoder(caps.primary_encoder);
      }
    }).catch(() => {});
  }, []);

  const handleCancel = () => {
    if (pipelineRef.current) {
      pipelineRef.current.cancel();
    }
    setIsExporting(false);
    setProgress(null);
    setErrorMessage('Export cancelled by user.');
  };

  const handleExport = async () => {
    const baseName = (track.title || 'substellar_project')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');

    setIsExporting(true);
    setExportSuccess(null);
    setErrorMessage(null);
    setProgress(null);

    try {
      if (format === 'ass') {
        const assText = generateAss(lines, style, track);
        downloadFile(`${baseName}.ass`, assText, 'text/plain;charset=utf-8');
        setExportSuccess(`Exported ${lines.length} lines to ${baseName}.ass with full Furigana styles & karaoke tags.`);
        setIsExporting(false);
        return;
      }

      if (format === 'srt') {
        const srtText = generateSrt(lines);
        downloadFile(`${baseName}.srt`, srtText, 'text/plain;charset=utf-8');
        setExportSuccess(`Exported ${lines.length} lines to ${baseName}.srt.`);
        setIsExporting(false);
        return;
      }

      // Video export modes: mp4, webm, prores
      const width = resolution === '4k' ? 3840 : resolution === '720p' ? 1280 : 1920;
      const height = resolution === '4k' ? 2160 : resolution === '720p' ? 720 : 1080;
      const ext = format === 'webm' ? 'webm' : format === 'prores' ? 'mov' : 'mp4';
      const outputPath = `${baseName}_export.${ext}`;

      const mode = format === 'webm' ? 'webm_alpha' : format === 'prores' ? 'prores_alpha' : 'mp4_burnin';

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
        lines,
        style: {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          primaryColor: style.fillColor,
          outlineColor: style.innerStrokeColor,
          secondaryOutlineColor: style.outerStrokeColor,
          outlineThickness: style.outerStrokeWidth,
          rubySizeRatio: style.rubyScale,
        },
        onProgress: (prog) => {
          setProgress(prog);
        },
      });

      if (result.success) {
        const sizeMb = (result.file_size_bytes / (1024 * 1024)).toFixed(2);
        setExportSuccess(
          `Render completed in ${result.elapsed_seconds.toFixed(1)}s (${sizeMb} MB) -> ${result.output_path}`
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
    <div className="flex-1 p-6 overflow-y-auto bg-gatefold-bg/30 backdrop-blur-sm select-none">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
            <Film className="w-5 h-5 text-gatefold-accent" />
            <span>Export Center & Hardware Pipeline</span>
          </h2>
          <p className="text-xs text-gatefold-text-3 mt-1">
            Zero-I/O frame memory pipe, GPU hardware auto-probing (NVENC/QSV/AMF), and professional alpha video overlays.
          </p>
        </div>

        {/* Real Hardware Probing Card */}
        <div className="gatefold-card p-4 flex items-center justify-between border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-emerald-400 shrink-0" />
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
                Primary: <span className="text-emerald-400 font-semibold">{hardwareCaps?.primary_encoder || 'libx264 (CPU)'}</span> • Available: {hardwareCaps?.available_encoders.join(', ') || 'libx264'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              {hardwareCaps?.ffmpeg_found ? 'FFMPEG ONLINE' : 'READY'}
            </span>
            <div className="text-[9px] text-gatefold-text-3 font-mono mt-1">
              VP9 Alpha: {hardwareCaps?.supports_alpha_webm ? 'Supported' : 'No'}
            </div>
          </div>
        </div>

        {/* Format Selector */}
        <div className="gatefold-card-strong p-5 space-y-4">
          <label className="block text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider font-mono">
            Export Target Format
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { id: 'ass', name: 'ASS Vector', desc: 'Full Furigana & \\k timing' },
              { id: 'srt', name: 'SubRip (SRT)', desc: 'Universal text subtitles' },
              { id: 'mp4', name: 'MP4 Video', desc: 'Hardware Burn-in' },
              { id: 'webm', name: 'WebM Alpha', desc: 'VP9 Transparent Overlay' },
              { id: 'prores', name: 'ProRes 4444', desc: 'Pro Studio Alpha MOV' },
            ].map((f) => (
              <button
                key={f.id}
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

          {/* Render Specifications (When Video Selected) */}
          {(format === 'mp4' || format === 'webm' || format === 'prores') && (
            <div className="space-y-3 pt-3 border-t border-gatefold-line">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-gatefold-text-3 block uppercase mb-1">
                    Resolution
                  </label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as '1080p' | '720p' | '4k')}
                    className="w-full px-2.5 py-1.5 text-xs bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                  >
                    <option value="1080p">1080p Full HD (1920x1080)</option>
                    <option value="720p">720p HD (1280x720) - Low-End</option>
                    <option value="4k">4K Ultra HD (3840x2160)</option>
                  </select>
                </div>

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
                      <option value="libvpx-vp9">libvpx-vp9 (Alpha YUVA420p)</option>
                    ) : format === 'prores' ? (
                      <option value="prores_ks">prores_ks (Apple 4444)</option>
                    ) : (
                      (hardwareCaps?.available_encoders || ['libx264']).map((enc) => (
                        <option key={enc} value={enc}>
                          {enc === 'h264_nvenc'
                            ? 'NVIDIA NVENC (h264_nvenc)'
                            : enc === 'h264_qsv'
                            ? 'Intel QuickSync (h264_qsv)'
                            : enc === 'h264_amf'
                            ? 'AMD AMF (h264_amf)'
                            : `${enc} (CPU)`}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Project Summary */}
          <div className="p-3 rounded-lg bg-gatefold-surface/60 border border-gatefold-line text-xs space-y-1.5">
            <div className="flex justify-between text-gatefold-text-3 font-mono text-[11px]">
              <span>Subtitle Events:</span>
              <span className="text-gatefold-text font-semibold">{lines.length} lines</span>
            </div>
            <div className="flex justify-between text-gatefold-text-3 font-mono text-[11px]">
              <span>Active Style:</span>
              <span className="text-gatefold-accent">{style.fontSize}px ({style.particlePreset} particles)</span>
            </div>
            <div className="flex justify-between text-gatefold-text-3 font-mono text-[11px]">
              <span>Duration:</span>
              <span className="text-gatefold-text font-medium">{duration.toFixed(2)}s</span>
            </div>
          </div>

          {/* Active Export Progress Bar */}
          {isExporting && progress && (
            <div className="p-4 rounded-lg bg-gatefold-surface border border-gatefold-accent/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-gatefold-accent flex items-center gap-1.5 font-semibold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Encoding Frame Pipeline...</span>
                </span>
                <span className="text-gatefold-text font-bold">{progress.percentage.toFixed(1)}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-gatefold-bg rounded-full overflow-hidden border border-gatefold-line">
                <div
                  className="h-full bg-gatefold-accent transition-all duration-150"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] font-mono text-gatefold-text-3">
                <span>
                  Frames: {progress.frames_written} / {progress.total_frames}
                </span>
                <span>Speed: {progress.fps.toFixed(1)} FPS</span>
              </div>

              <button
                onClick={handleCancel}
                className="w-full py-1.5 text-xs text-rose-400 border border-rose-500/30 rounded hover:bg-rose-500/10 transition-colors font-mono"
              >
                Cancel Export
              </button>
            </div>
          )}

          {/* Success Message */}
          {exportSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{exportSuccess}</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Export Action Button */}
          {!isExporting && (
            <div className="pt-2">
              <button
                onClick={handleExport}
                disabled={lines.length === 0}
                className="w-full py-2.5 px-4 bg-gatefold-accent text-gatefold-bg font-semibold text-xs rounded-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_var(--glow)] disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>
                  {format === 'ass'
                    ? 'Download Advanced ASS (.ass) Subtitles'
                    : format === 'srt'
                    ? 'Download Standard SRT (.srt) Subtitles'
                    : `Start Hardware Video Export (${format.toUpperCase()})`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
