import React, { useRef, useState } from 'react';
import { UploadCloud, Play, Video, FileText, HardDrive } from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import { parseLrc } from '../../services/lyrics/lrcParser';
import { tauriBridge } from '../../services/tauriBridge';

export const EmptyStudioState: React.FC = () => {
  const {
    loadSampleTrack,
    loadLocalMedia,
    loadLocalMediaFromPath,
    saveToLocalStorage,
    importLyrics,
    importProjectJson,
    setActiveTab,
  } = useStudioStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleChooseMediaClick = async () => {
    if (tauriBridge.isAvailable()) {
      try {
        const chosenPath = await tauriBridge.openMediaDialog();
        if (chosenPath) {
          await loadLocalMediaFromPath(chosenPath);
          saveToLocalStorage();
        }
        return;
      } catch {
        // fallback to input
      }
    }
    fileInputRef.current?.click();
  };

  const processSelectedFile = (file: File) => {
    const ext = file.name.toLowerCase();
    if (ext.endsWith('.substellar') || ext.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          importProjectJson(String(reader.result || ''));
        } catch {
          // ignore
        }
      };
      reader.readAsText(file);
      return;
    }
    if (
      ext.endsWith('.lrc') ||
      ext.endsWith('.srt') ||
      ext.endsWith('.vtt') ||
      ext.endsWith('.txt')
    ) {
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = parseLrc(String(reader.result || ''));
        if (parsed.length > 0) {
          importLyrics(parsed);
        }
      };
      reader.readAsText(file);
      return;
    }
    loadLocalMedia(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-6 select-none">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,.mp4,.webm,.mkv,.mov,.mp3,.wav,.ogg,.lrc,.srt,.substellar"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={subtitleInputRef}
        type="file"
        accept=".lrc,.srt,.vtt,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`max-w-md w-full gatefold-card-strong p-8 flex flex-col items-center text-center space-y-6 border-dashed border-2 transition-all ${
          isDragOver
            ? 'border-gatefold-accent bg-gatefold-accent/10 scale-[1.02]'
            : 'border-gatefold-line hover:border-gatefold-accent/50'
        }`}
      >
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
            Drag & drop an audio/video file here, pick from your computer, or explore with a pre-configured showcase.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2 pt-2">
          <button
            onClick={() => void handleChooseMediaClick()}
            className="w-full py-2.5 px-4 rounded-lg bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-xs font-semibold text-gatefold-text transition-all flex items-center justify-center gap-2"
          >
            <HardDrive className="w-4 h-4 text-gatefold-accent" />
            <span>Choose Local Video or Audio File</span>
          </button>

          <button
            onClick={loadSampleTrack}
            className="w-full py-2.5 px-4 rounded-lg bg-gatefold-accent text-gatefold-bg font-semibold text-xs hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Load J-Pop Showcase (Furigana & Particles)</span>
          </button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => subtitleInputRef.current?.click()}
              className="py-2 px-3 rounded-lg bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-xs font-medium text-gatefold-text transition-colors flex items-center justify-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-gatefold-accent" />
              <span>Import .LRC / .SRT</span>
            </button>

            <button
              onClick={() => setActiveTab('youtube')}
              className="py-2 px-3 rounded-lg bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-xs font-medium text-gatefold-text transition-colors flex items-center justify-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5 text-red-400" />
              <span>YouTube URL</span>
            </button>
          </div>
        </div>

        {/* Format notes */}
        <div className="text-[10px] text-gatefold-text-3 font-mono pt-2 border-t border-gatefold-line w-full flex items-center justify-center gap-3">
          <span>Supported: MP4, WebM, MP3, WAV, LRC, SRT, .substellar</span>
        </div>
      </div>
    </div>
  );
};
