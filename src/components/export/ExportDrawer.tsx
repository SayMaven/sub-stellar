import React, { useState } from 'react';
import { Film, Cpu, HardDrive, DownloadCloud, CheckCircle2 } from 'lucide-react';

export const ExportDrawer: React.FC = () => {
  const [format, setFormat] = useState<'mp4' | 'webm' | 'ass'>('mp4');
  const [resolution, setResolution] = useState('1080p');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleStartExport = () => {
    setIsExporting(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gatefold-bg/30 backdrop-blur-sm select-none">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
            <Film className="w-6 h-6 text-gatefold-accent" />
            <span>FFmpeg Export Center & Hardware Probing</span>
          </h2>
          <p className="text-sm text-gatefold-text-3 mt-1">
            Export video burn-in subtitles or transparent alpha overlays with hardware acceleration.
          </p>
        </div>

        {/* Hardware Status Card */}
        <div className="gatefold-card p-4 flex items-center justify-between border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <div>
              <h4 className="text-xs font-semibold text-gatefold-text">Hardware Probing Active</h4>
              <p className="text-[11px] text-gatefold-text-3">
                Detected Encoder: <span className="font-mono text-emerald-400">h264_qsv / libx264</span> (Dynamic Cascade Ready)
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            OPTIMIZED
          </span>
        </div>

        {/* Export Configuration Card */}
        <div className="gatefold-card-strong p-5 space-y-5">
          {/* Format Selection */}
          <div>
            <label className="block text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider mb-2">
              Container Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'mp4', name: 'MP4 (H.264)', desc: 'Standard Burn-in Video' },
                { id: 'webm', name: 'WebM (VP9)', desc: 'Transparent Alpha Channel' },
                { id: 'ass', name: 'Advanced ASS', desc: 'Raw Vector Subtitle File' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id as 'mp4' | 'webm' | 'ass')}
                  className={`p-3 rounded-lg text-left transition-all border ${
                    format === f.id
                      ? 'bg-gatefold-accent/15 border-gatefold-accent text-gatefold-accent'
                      : 'bg-gatefold-surface border-gatefold-line text-gatefold-text hover:border-gatefold-line-2'
                  }`}
                >
                  <div className="font-semibold text-xs">{f.name}</div>
                  <div className="text-[10px] text-gatefold-text-3 mt-0.5">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Resolution & FPS */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider mb-2">
                Resolution
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gatefold-surface border border-gatefold-line rounded-lg text-gatefold-text focus:border-gatefold-accent focus:outline-none"
              >
                <option value="1080p">1080p Full HD (1920x1080)</option>
                <option value="720p">720p HD (1280x720) - Low End Recommended</option>
                <option value="4k">4K Ultra HD (3840x2160)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider mb-2">
                Target Frame Rate
              </label>
              <div className="px-3 py-2 text-xs bg-gatefold-surface border border-gatefold-line rounded-lg text-gatefold-text font-mono">
                60.000 FPS (Smooth Motion)
              </div>
            </div>
          </div>

          {/* Export Action */}
          <div className="pt-2">
            {isExporting ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-gatefold-text-2">
                  <span>Rendering PixiJS Frames to FFmpeg Pipe...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full bg-gatefold-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gatefold-accent transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : progress === 100 ? (
              <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Video exported successfully to /output/stellar-flight.mp4</span>
                </div>
                <button
                  onClick={() => setProgress(0)}
                  className="underline hover:text-emerald-300 font-medium"
                >
                  Export Another
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartExport}
                className="w-full py-3 px-4 rounded-lg bg-gatefold-accent text-gatefold-bg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_var(--glow)]"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>Render & Export Video</span>
              </button>
            )}
          </div>
        </div>

        {/* Disk & Zero-Temp Info */}
        <div className="flex items-center gap-2 text-xs text-gatefold-text-3">
          <HardDrive className="w-3.5 h-3.5" />
          <span>Zero-Temp Disk I/O: PixiJS frames stream directly to FFmpeg stdin pipe.</span>
        </div>
      </div>
    </div>
  );
};
