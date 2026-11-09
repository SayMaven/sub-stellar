import React, { useState } from 'react';
import { Download, Video, CheckCircle2, ArrowRight } from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';

export const YouTubeDrawer: React.FC = () => {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState('1080p');
  const [isFetching, setIsFetching] = useState(false);
  const { loadSampleTrack, setActiveTab } = useStudioStore();

  const handleFetch = () => {
    if (!url.trim()) return;
    setIsFetching(true);
    setTimeout(() => {
      setIsFetching(false);
      loadSampleTrack();
      setActiveTab('studio');
    }, 1200);
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
            <Video className="w-6 h-6 text-red-500" />
            <span>1-Click YouTube Downloader & Auto-Sync</span>
          </h2>
          <p className="text-sm text-gatefold-text-3 mt-1">
            Download high-resolution video/audio and automatically sync synchronized lyrics with Furigana.
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
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 px-3 py-2 text-sm bg-gatefold-surface border border-gatefold-line rounded-lg text-gatefold-text placeholder:text-gatefold-text-3 focus:border-gatefold-accent focus:outline-none"
            />
            <button
              onClick={handleFetch}
              disabled={isFetching}
              className="px-4 py-2 bg-gatefold-accent text-gatefold-bg font-semibold text-sm rounded-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isFetching ? 'Fetching...' : 'Fetch'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-gatefold-text-3 pt-2">
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
            className="w-full py-2.5 px-4 rounded-lg bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-sm text-gatefold-text font-medium flex items-center justify-between transition-colors"
          >
            <span>Load Demo: Luna feat. Hatsune Miku - Stellar Night Flight</span>
            <ArrowRight className="w-4 h-4 text-gatefold-accent" />
          </button>
        </div>
      </div>
    </div>
  );
};
