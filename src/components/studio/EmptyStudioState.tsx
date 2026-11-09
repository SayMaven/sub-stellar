import React from 'react';
import { UploadCloud, Sparkles, Video, FileText } from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';

export const EmptyStudioState: React.FC = () => {
  const { loadSampleTrack, setActiveTab } = useStudioStore();

  return (
    <div className="w-full h-full flex items-center justify-center p-6 select-none">
      <div className="max-w-md w-full gatefold-card-strong p-8 flex flex-col items-center text-center space-y-6 border-dashed border-2 border-gatefold-line hover:border-gatefold-accent/50 transition-colors">
        {/* Icon Header */}
        <div className="w-14 h-14 rounded-2xl bg-gatefold-accent/15 border border-gatefold-accent/30 text-gatefold-accent flex items-center justify-center">
          <UploadCloud className="w-7 h-7" />
        </div>

        {/* Text Explanations */}
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-gatefold-text">
            No Media or Subtitle Loaded
          </h3>
          <p className="text-xs text-gatefold-text-3 leading-relaxed">
            Drag & drop an audio/video file here, import synchronized lyrics, or explore with a pre-configured showcase.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2 pt-2">
          <button
            onClick={loadSampleTrack}
            className="w-full py-2.5 px-4 rounded-lg bg-gatefold-accent text-gatefold-bg font-semibold text-xs hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_var(--glow)]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load J-Pop Showcase (Furigana & Particles)</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab('youtube')}
              className="py-2 px-3 rounded-lg bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-xs font-medium text-gatefold-text transition-colors flex items-center justify-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5 text-red-400" />
              <span>YouTube URL</span>
            </button>

            <button
              onClick={() => setActiveTab('lyrics')}
              className="py-2 px-3 rounded-lg bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-xs font-medium text-gatefold-text transition-colors flex items-center justify-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-gatefold-accent" />
              <span>Search Lyrics</span>
            </button>
          </div>
        </div>

        {/* Format notes */}
        <div className="text-[10px] text-gatefold-text-3 font-mono pt-2 border-t border-gatefold-line w-full flex items-center justify-center gap-3">
          <span>Supported: MP4, WebM, MP3, WAV, LRC, ASS</span>
        </div>
      </div>
    </div>
  );
};
