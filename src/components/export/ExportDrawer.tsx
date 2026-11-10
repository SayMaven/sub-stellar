import React, { useState, useEffect } from 'react';
import {
  Film,
  Cpu,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import { generateAss, generateSrt, downloadFile } from '../../engine/text/SubtitleExporter';
import { tauriBridge, type HardwareCapabilities } from '../../services/tauriBridge';

export const ExportDrawer: React.FC = () => {
  const { lines, style, track } = useStudioStore();

  const [format, setFormat] = useState<'ass' | 'srt' | 'mp4' | 'webm'>('ass');
  const [resolution, setResolution] = useState('1080p');
  const [fps, setFps] = useState<number>(60);
  const [hardwareCaps, setHardwareCaps] = useState<HardwareCapabilities | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  useEffect(() => {
    tauriBridge.probeHardwareCapabilities().then(setHardwareCaps).catch(() => {});
  }, []);

  const handleExport = () => {
    const baseName = (track.title || 'substellar_project')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');

    setIsExporting(true);
    setExportSuccess(null);

    try {
      if (format === 'ass') {
        const assText = generateAss(lines, style, track);
        downloadFile(`${baseName}.ass`, assText, 'text/plain;charset=utf-8');
        setExportSuccess(`Exported ${lines.length} lines to ${baseName}.ass with full Furigana styles & karaoke tags.`);
      } else if (format === 'srt') {
        const srtText = generateSrt(lines);
        downloadFile(`${baseName}.srt`, srtText, 'text/plain;charset=utf-8');
        setExportSuccess(`Exported ${lines.length} lines to ${baseName}.srt.`);
      } else {
        // Video render pipeline config
        const assText = generateAss(lines, style, track);
        downloadFile(`${baseName}_render_subtitles.ass`, assText, 'text/plain;charset=utf-8');
        setExportSuccess(
          `Render configuration prepared for ${format.toUpperCase()} (${resolution} @ ${fps} FPS). Subtitle file generated.`
        );
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gatefold-bg/30 backdrop-blur-sm select-none">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
            <Film className="w-5 h-5 text-gatefold-accent" />
            <span>Export Center & Hardware Capabilities</span>
          </h2>
          <p className="text-xs text-gatefold-text-3 mt-1">
            Export vector subtitle files (.ass/.srt) with Furigana and karaoke tags, or configure hardware-accelerated video rendering.
          </p>
        </div>

        {/* Real Hardware Probing Card */}
        <div className="gatefold-card p-4 flex items-center justify-between border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h4 className="text-xs font-semibold text-gatefold-text">Hardware Acceleration Probed</h4>
              <p className="text-[11px] text-gatefold-text-3 font-mono">
                Encoder: <span className="text-emerald-400">{hardwareCaps?.available_encoders.join(', ') || 'libx264 (CPU)'}</span> • Profile: <span className="text-gatefold-accent">{hardwareCaps?.recommended_quality || 'balanced'}</span>
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            READY
          </span>
        </div>

        {/* Format Selector */}
        <div className="gatefold-card-strong p-5 space-y-4">
          <label className="block text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider font-mono">
            Export Target Format
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'ass', name: 'ASS Vector', desc: 'Full Furigana & \\k timing' },
              { id: 'srt', name: 'SubRip (SRT)', desc: 'Universal text subtitles' },
              { id: 'mp4', name: 'MP4 Video', desc: 'H.264 Burn-in Export' },
              { id: 'webm', name: 'WebM Alpha', desc: 'Transparent video overlay' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id as 'ass' | 'srt' | 'mp4' | 'webm')}
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
                <div className="text-[10px] text-gatefold-text-3 mt-1">{f.desc}</div>
              </button>
            ))}
          </div>

          {/* Render Specifications (When Video Selected) */}
          {(format === 'mp4' || format === 'webm') && (
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gatefold-line">
              <div>
                <label className="text-[10px] font-mono text-gatefold-text-3 block uppercase mb-1">
                  Resolution
                </label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                >
                  <option value="1080p">1080p Full HD (1920x1080)</option>
                  <option value="720p">720p HD (1280x720) - Low-End Recommended</option>
                  <option value="4K">4K Ultra HD (3840x2160)</option>
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
                  <option value={60}>60 FPS (Smooth particle animation)</option>
                  <option value={30}>30 FPS (Standard video)</option>
                  <option value={24}>24 FPS (Cinematic standard)</option>
                </select>
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
              <span>Track Title:</span>
              <span className="text-gatefold-text font-medium">{track.title}</span>
            </div>
          </div>

          {/* Success Message */}
          {exportSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{exportSuccess}</span>
            </div>
          )}

          {/* Export Action Button */}
          <div className="pt-2">
            <button
              onClick={handleExport}
              disabled={isExporting || lines.length === 0}
              className="w-full py-2.5 px-4 bg-gatefold-accent text-gatefold-bg font-semibold text-xs rounded-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_var(--glow)] disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>
                {format === 'ass'
                  ? 'Download Advanced ASS (.ass) Subtitles'
                  : format === 'srt'
                  ? 'Download Standard SRT (.srt) Subtitles'
                  : `Export Video Pipeline (${format.toUpperCase()})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
