import React, { useState } from 'react';
import { Search, FileText, Check, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';

interface Candidate {
  id: string;
  source: string;
  title: string;
  artist: string;
  score: number;
  hasSync: boolean;
  hasRomajiOrRuby: boolean;
}

const ALL_CANDIDATES: Candidate[] = [
  {
    id: 'lrclib-1',
    source: 'LRCLIB (Verified)',
    title: 'Stellar Night Flight',
    artist: 'Luna feat. Hatsune Miku',
    score: 98,
    hasSync: true,
    hasRomajiOrRuby: true,
  },
  {
    id: 'netease-1',
    source: 'NetEase Music (YRC Syllables)',
    title: 'Stellar Night Flight (Album Ver.)',
    artist: 'Luna',
    score: 92,
    hasSync: true,
    hasRomajiOrRuby: true,
  },
  {
    id: 'qq-1',
    source: 'QQ Music',
    title: 'Stellar Night Flight',
    artist: 'Luna & Hatsune Miku',
    score: 87,
    hasSync: true,
    hasRomajiOrRuby: false,
  },
];

export const LyricsDrawer: React.FC = () => {
  const [query, setQuery] = useState('Stellar Night Flight');
  const [selectedId, setSelectedId] = useState('lrclib-1');
  const [isSearching, setIsSearching] = useState(false);
  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [manualText, setManualText] = useState(
    'もう{何|なに}もいらない\nあぁ{待|ま}ち{遠|とお}しいな\n{星|ほし}{空|ぞら}の{下|した}で{歌|うた}おう'
  );

  const { setActiveTab, loadSampleTrack } = useStudioStore();

  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
    }, 600);
  };

  const handleApply = () => {
    loadSampleTrack();
    setActiveTab('studio');
  };

  const filteredCandidates = query.trim()
    ? ALL_CANDIDATES.filter(
        (c) =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.artist.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gatefold-bg/30 backdrop-blur-sm select-none">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
            <FileText className="w-5 h-5 text-gatefold-accent" />
            <span>Multi-Source Synchronized Lyrics Database</span>
          </h2>
          <p className="text-xs text-gatefold-text-3 mt-1">
            Search synchronized lyrics across LRCLIB, NetEase, QQ Music, and Kugou with auto-generated Furigana.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex gap-2 border-b border-gatefold-line pb-2">
          <button
            onClick={() => setMode('search')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              mode === 'search'
                ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40'
                : 'text-gatefold-text-3 hover:text-gatefold-text'
            }`}
          >
            Online Database Search
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              mode === 'manual'
                ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40'
                : 'text-gatefold-text-3 hover:text-gatefold-text'
            }`}
          >
            Manual LRC / Ruby Text Paste
          </button>
        </div>

        {mode === 'search' ? (
          <>
            {/* Search Bar */}
            <div className="gatefold-card-strong p-4 flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gatefold-text-3" />
                <input
                  type="text"
                  placeholder="Search by song title, artist, or album..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-gatefold-surface border border-gatefold-line rounded-lg text-gatefold-text placeholder:text-gatefold-text-3 focus:border-gatefold-accent focus:outline-none"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-4 py-2 bg-gatefold-accent text-gatefold-bg font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSearching && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSearching ? 'Searching...' : 'Search'}</span>
              </button>
            </div>

            {/* Results or Empty State */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-semibold text-gatefold-text-3 uppercase tracking-wider font-mono">
                  Search Results ({filteredCandidates.length})
                </span>
                <span className="text-[10px] text-gatefold-text-3 font-mono">
                  Sources: LRCLIB, NetEase YRC, QQ
                </span>
              </div>

              {isSearching ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="gatefold-card p-4 animate-pulse flex justify-between items-center"
                    >
                      <div className="space-y-2 w-1/2">
                        <div className="h-4 bg-gatefold-surface-2 rounded w-3/4" />
                        <div className="h-3 bg-gatefold-surface rounded w-1/2" />
                      </div>
                      <div className="h-8 w-20 bg-gatefold-surface-2 rounded" />
                    </div>
                  ))}
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="gatefold-card p-8 flex flex-col items-center justify-center text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-gatefold-text-3" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-gatefold-text">
                      No matching lyrics found
                    </h4>
                    <p className="text-xs text-gatefold-text-3">
                      Try searching with Romaji or Japanese Kanji, or switch to the manual paste tab.
                    </p>
                  </div>
                  <button
                    onClick={() => setMode('manual')}
                    className="px-3 py-1.5 rounded-lg bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-xs font-medium text-gatefold-text"
                  >
                    Paste Lyrics Manually
                  </button>
                </div>
              ) : (
                filteredCandidates.map((cand) => {
                  const isSelected = selectedId === cand.id;
                  return (
                    <div
                      key={cand.id}
                      onClick={() => setSelectedId(cand.id)}
                      className={`gatefold-card p-4 flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'border-gatefold-accent bg-gatefold-accent/10'
                          : 'hover:border-gatefold-line-2'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-gatefold-text">{cand.title}</h4>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-gatefold-surface-2 text-gatefold-accent border border-gatefold-line">
                            {cand.source}
                          </span>
                        </div>
                        <p className="text-[11px] text-gatefold-text-3">{cand.artist}</p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-xs font-bold text-emerald-400 font-mono">
                            {cand.score}% Match
                          </span>
                          <div className="text-[10px] text-gatefold-text-3 flex items-center gap-1 justify-end">
                            <Sparkles className="w-3 h-3 text-gatefold-accent" />
                            <span>Furigana Ready</span>
                          </div>
                        </div>

                        <button
                          onClick={handleApply}
                          className="px-3 py-1.5 rounded-lg bg-gatefold-surface-2 hover:bg-gatefold-accent hover:text-gatefold-bg text-gatefold-text font-semibold text-xs transition-all flex items-center gap-1.5"
                          title="Apply to Studio"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Apply</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* Manual Paste Area */
          <div className="gatefold-card-strong p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider mb-1">
                Paste LRC or Markdown Ruby Text
              </label>
              <p className="text-[11px] text-gatefold-text-3 mb-2">
                Use standard LRC timecodes `[00:12.50]` or Markdown Ruby format `&#123;Kanji|Ruby&#125;`.
              </p>
              <textarea
                rows={8}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                className="w-full p-3 text-xs font-mono bg-gatefold-surface border border-gatefold-line rounded-lg text-gatefold-text focus:border-gatefold-accent focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={handleApply}
                className="px-4 py-2 bg-gatefold-accent text-gatefold-bg font-semibold text-xs rounded-lg hover:opacity-90 transition-all flex items-center gap-2"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Parse & Commit to Studio</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
