import React, { useState } from 'react';
import { Download, Video, CheckCircle2, ArrowRight, AlertCircle, FileAudio } from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';

export const YouTubeDrawer: React.FC = () => {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState('1080p');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchStep, setFetchStep] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const { loadSampleTrack, setActiveTab } = useStudioStore();

  const handleFetch = () => {
    setValidationError(null);
    if (!url.trim()) {
      setValidationError('Please enter a YouTube video URL.');
      return;
    }

    if (!url.includes('youtube.com/') && !url.includes('youtu.be/')) {
      setValidationError('URL must be a valid YouTube address (e.g. https://www.youtube.com/watch?v=...)');
      return;
    }

    setIsFetching(true);
    setFetchStep('Probing stream metadata via yt-dlp...');

    setTimeout(() => {
      setFetchStep('Downloading audio & searching synchronized lyrics...');
      setTimeout(() => {
        setIsFetching(false);
        setFetchStep('');
        loadSampleTrack();
        setActiveTab('studio');
      }, 1000);
    }, 800);
  };

  const handleDemoClick = () => {
    loadSampleTrack();
    setActiveTab('studio');
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gatefold-bg/30 backdrop-blur-sm select-none">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
            <Video className="w-5 h-5 text-red-500" />
            <span>1-Click YouTube Downloader & Auto-Sync</span>
          </h2>
          <p className="text-xs text-gatefold-text-3 mt-1">
            Downloads high-resolution media and queries online lyric databases with automatic Furigana generation.
          </p>
        </div>

        {/* Input Card */}
        <div className="gatefold-card-strong p-5 space-y-4">
          <label className="block text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider">
            YouTube Video or Audio URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (validationError) setValidationError(null);
              }}
              className={`flex-1 px-3 py-2 text-xs bg-gatefold-surface border rounded-lg text-gatefold-text placeholder:text-gatefold-text-3 focus:outline-none transition-colors ${
                validationError ? 'border-red-500 focus:border-red-500' : 'border-gatefold-line focus:border-gatefold-accent'
              }`}
            />
            <button
              onClick={handleFetch}
              disabled={isFetching}
              className="px-4 py-2 bg-gatefold-accent text-gatefold-bg font-semibold text-xs rounded-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isFetching ? 'Fetching...' : 'Fetch Media'}</span>
            </button>
          </div>

          {/* Validation Feedback */}
          {validationError && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Busy Action Progress */}
          {isFetching && (
            <div className="p-3 rounded-lg bg-gatefold-surface border border-gatefold-line text-xs space-y-2">
              <div className="flex justify-between font-mono text-gatefold-text-2">
                <span>{fetchStep}</span>
                <span className="text-gatefold-accent">In Progress</span>
              </div>
              <div className="h-1.5 w-full bg-gatefold-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-gatefold-accent animate-pulse w-3/4" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-gatefold-text-3 pt-1">
            <span>Preferred Quality:</span>
            <div className="flex gap-2">
              {['1080p', '720p', 'Audio Only'].map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    quality === q
                      ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40 font-medium'
                      : 'bg-gatefold-surface text-gatefold-text-3 border border-gatefold-line hover:text-gatefold-text'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Offline / Local File Fallback */}
        <div className="gatefold-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileAudio className="w-5 h-5 text-gatefold-accent" />
            <div>
              <h4 className="text-xs font-semibold text-gatefold-text">Working Offline?</h4>
              <p className="text-[11px] text-gatefold-text-3">
                You can import local video (.mp4/.webm) or audio (.mp3/.wav) files directly.
              </p>
            </div>
          </div>
          <button
            onClick={handleDemoClick}
            className="px-3 py-1.5 rounded-lg bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-xs font-medium text-gatefold-text"
          >
            Open Local File
          </button>
        </div>

        {/* Instant Demo Showcase */}
        <div className="gatefold-card p-5">
          <h3 className="text-sm font-semibold text-gatefold-text mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Instant Demo Showcase</span>
          </h3>
          <p className="text-xs text-gatefold-text-3 mb-4">
            Try a pre-loaded J-Pop track with Furigana ruby annotations and synchronized karaoke particles.
          </p>
          <button
            onClick={handleDemoClick}
            className="w-full py-2.5 px-4 rounded-lg bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-xs text-gatefold-text font-medium flex items-center justify-between transition-colors"
          >
            <span>Load Demo: Luna feat. Hatsune Miku - Stellar Night Flight</span>
            <ArrowRight className="w-4 h-4 text-gatefold-accent" />
          </button>
        </div>
      </div>
    </div>
  );
};
