import React, { useState } from 'react';
import { Search, FileText, Check, Sparkles } from 'lucide-react';
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

const SAMPLE_CANDIDATES: Candidate[] = [
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
  const { setActiveTab } = useStudioStore();

  const handleApply = () => {
    setActiveTab('studio');
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gatefold-bg/30 backdrop-blur-sm select-none">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
            <FileText className="w-6 h-6 text-gatefold-accent" />
            <span>Multi-Source Synchronized Lyrics Database</span>
          </h2>
          <p className="text-sm text-gatefold-text-3 mt-1">
            Search synchronized lyrics across LRCLIB, NetEase, QQ Music, and Kugou with auto-generated Furigana.
          </p>
        </div>

        {/* Search Bar */}
        <div className="gatefold-card-strong p-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gatefold-text-3" />
            <input
              type="text"
              placeholder="Search by title, artist, or album..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gatefold-surface border border-gatefold-line rounded-lg text-gatefold-text placeholder:text-gatefold-text-3 focus:border-gatefold-accent focus:outline-none"
            />
          </div>
          <button className="px-4 py-2 bg-gatefold-accent text-gatefold-bg font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity">
            Search
          </button>
        </div>

        {/* Results List */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-gatefold-text-3 uppercase tracking-wider">
            Match Candidates ({SAMPLE_CANDIDATES.length})
          </span>

          {SAMPLE_CANDIDATES.map((cand) => {
            const isSelected = selectedId === cand.id;
            return (
              <div
                key={cand.id}
                onClick={() => setSelectedId(cand.id)}
                className={`gatefold-card p-4 flex items-center justify-between cursor-pointer transition-all ${
                  isSelected ? 'border-gatefold-accent bg-gatefold-accent/10' : 'hover:border-gatefold-line-2'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-gatefold-text">{cand.title}</h4>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gatefold-surface-2 text-gatefold-accent border border-gatefold-line">
                      {cand.source}
                    </span>
                  </div>
                  <p className="text-xs text-gatefold-text-3">{cand.artist}</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      {cand.score}% Match
                    </span>
                    <div className="text-[10px] text-gatefold-text-3 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-gatefold-accent" />
                      <span>Furigana Ready</span>
                    </div>
                  </div>

                  <button
                    onClick={handleApply}
                    className="p-2 rounded-lg bg-gatefold-surface-2 hover:bg-gatefold-accent hover:text-gatefold-bg text-gatefold-text transition-all"
                    title="Apply to Studio"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

