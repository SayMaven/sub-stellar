import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileText,
  Check,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Clock,
  Music2,
  ChevronRight,
  Database,
  Upload,
} from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import { aggregateLyricsSearch } from '../../services/lyrics/lyricsAggregator';
import { parseLrc } from '../../services/lyrics/lrcParser';
import type { LyricsCandidate } from '../../services/lyrics/types';

export const LyricsDrawer: React.FC = () => {
  const { track, setActiveTab, importLyrics } = useStudioStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(track.title || 'Stellar Night Flight');
  const [artist, setArtist] = useState(track.artist || 'Luna feat. Hatsune Miku');
  const [candidates, setCandidates] = useState<LyricsCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [manualText, setManualText] = useState(
    '[00:12.00] もう{何|なに}もいらない\n[00:17.00] あぁ{待|ま}ち{遠|とお}しいな\n[00:22.20] {星|ほし}{空|ぞら}の{下|した}で{歌|うた}おう'
  );

  // Auto-search on initial open if track has a title
  useEffect(() => {
    if (track.title && candidates.length === 0) {
      handleSearch();
    }
  }, []);

  const handleSearch = async () => {
    if (!title.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const results = await aggregateLyricsSearch({
        title: title.trim(),
        artist: artist.trim(),
        duration: track.duration,
      });

      setCandidates(results);
      if (results.length > 0) {
        setSelectedId(results[0].id);
      } else {
        setSelectedId(null);
      }
    } catch (err) {
      setSearchError('Failed to search lyrics providers. Please check your connection or use manual paste.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplyCandidate = (candidate: LyricsCandidate) => {
    const raw = candidate.syncedLyrics || candidate.plainLyrics;
    if (!raw) return;

    const parsedLines = parseLrc(raw, candidate.translationLyrics);
    if (parsedLines.length > 0) {
      importLyrics(parsedLines, {
        title: candidate.title,
        artist: candidate.artist,
        duration: candidate.duration > 0 ? candidate.duration : undefined,
      });
      setActiveTab('studio');
    }
  };

  const handleApplyManual = () => {
    if (!manualText.trim()) return;

    const parsedLines = parseLrc(manualText);
    if (parsedLines.length > 0) {
      importLyrics(parsedLines);
      setActiveTab('studio');
    }
  };

  const handleUploadSubtitleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      setManualText(content);
      const parsedLines = parseLrc(content);
      if (parsedLines.length > 0) {
        importLyrics(parsedLines);
        setActiveTab('studio');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selectedCandidate = candidates.find((c) => c.id === selectedId);

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gatefold-bg/30 select-none">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
            <FileText className="w-5 h-5 text-gatefold-accent" />
            <span>Multi-Source Synchronized Lyrics Fetcher</span>
          </h2>
          <p className="text-xs text-gatefold-text-3 mt-1">
            Concurrent fuzzy search across open databases (LRCLIB, NetEase YRC word-level timing, QQ Music) with auto-scored matching.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex gap-2 border-b border-gatefold-line pb-2">
          <button
            onClick={() => setMode('search')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              mode === 'search'
                ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40'
                : 'text-gatefold-text-3 hover:text-gatefold-text'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Online Database Search</span>
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              mode === 'manual'
                ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40'
                : 'text-gatefold-text-3 hover:text-gatefold-text'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Import / Paste .LRC or .SRT</span>
          </button>
        </div>

        {mode === 'search' ? (
          <>
            {/* Search Input Controls */}
            <div className="gatefold-card-strong p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-gatefold-text-3 uppercase block mb-1">
                    Song Title
                  </label>
                  <div className="relative">
                    <Music2 className="w-4 h-4 absolute left-3 top-2.5 text-gatefold-text-3" />
                    <input
                      type="text"
                      placeholder="e.g. Kick Back, Idol, Racing Into The Night"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-gatefold-surface border border-gatefold-line rounded-lg text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-gatefold-text-3 uppercase block mb-1">
                    Artist / Band
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-gatefold-text-3" />
                    <input
                      type="text"
                      placeholder="e.g. Kenshi Yonezu, YOASOBI, Luna"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-gatefold-surface border border-gatefold-line rounded-lg text-gatefold-text focus:border-gatefold-accent focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gatefold-line">
                <span className="text-[10px] text-gatefold-text-3 font-mono">
                  Duration filter: {track.duration > 0 ? `${Math.round(track.duration)}s tolerance (+-4s)` : 'Any'}
                </span>
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !title.trim()}
                  className="px-4 py-2 bg-gatefold-accent text-gatefold-bg font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSearching ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>{isSearching ? 'Querying Sources...' : 'Fetch Lyrics'}</span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {searchError && (
              <div className="gatefold-card p-4 border-rose-500/30 bg-rose-500/10 flex items-center justify-between text-xs text-rose-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{searchError}</span>
                </div>
                <button
                  onClick={handleSearch}
                  className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded text-[11px] font-medium"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Results Header */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-gatefold-text-3 uppercase tracking-wider font-mono">
                Candidate Matches ({candidates.length})
              </span>
              <span className="text-[10px] text-gatefold-text-3 font-mono">
                Ranked by Dice similarity & duration
              </span>
            </div>

            {/* Candidate List / Skeleton / Empty State */}
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
                    <div className="h-8 w-24 bg-gatefold-surface-2 rounded" />
                  </div>
                ))}
              </div>
            ) : candidates.length === 0 ? (
              <div className="gatefold-card p-8 flex flex-col items-center justify-center text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-gatefold-text-3" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-gatefold-text">
                    No lyrics candidates found
                  </h4>
                  <p className="text-xs text-gatefold-text-3 max-w-sm">
                    Try searching with alternate spelling, romaji, or paste your LRC subtitle file manually.
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
              <div className="space-y-2">
                {candidates.map((cand) => {
                  const isSelected = selectedId === cand.id;
                  const matchPct = Math.round(cand.similarity * 100);

                  return (
                    <div
                      key={cand.id}
                      onClick={() => setSelectedId(cand.id)}
                      className={`gatefold-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-gatefold-accent bg-gatefold-accent/10'
                          : 'hover:border-gatefold-line-2'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-semibold text-gatefold-text">{cand.title}</h4>
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-gatefold-surface-2 text-gatefold-accent border border-gatefold-line">
                            {cand.source}
                          </span>
                          {cand.isWordSynced && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Word-Sync</span>
                            </span>
                          )}
                          {cand.hasTranslation && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                              Translation
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gatefold-text-3">
                          {cand.artist} {cand.album ? `• ${cand.album}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <span
                            className={`text-xs font-bold font-mono ${
                              matchPct >= 90
                                ? 'text-emerald-400'
                                : matchPct >= 75
                                ? 'text-cyan-400'
                                : 'text-gatefold-text-3'
                            }`}
                          >
                            {matchPct}% Match
                          </span>
                          {cand.duration > 0 && (
                            <div className="text-[10px] text-gatefold-text-3 flex items-center gap-1 justify-end font-mono">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{Math.round(cand.duration)}s</span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyCandidate(cand);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-gatefold-accent text-gatefold-bg hover:opacity-90 font-semibold text-xs transition-all flex items-center gap-1.5"
                          title="Apply to Studio"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Apply</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Candidate Preview Pane */}
            {selectedCandidate && (selectedCandidate.syncedLyrics || selectedCandidate.plainLyrics) && (
              <div className="gatefold-card-strong p-4 space-y-2 border-t border-gatefold-line">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-semibold text-gatefold-text-3 uppercase tracking-wider font-mono">
                    Lyrics Preview ({selectedCandidate.title})
                  </span>
                  <button
                    onClick={() => handleApplyCandidate(selectedCandidate)}
                    className="text-xs text-gatefold-accent hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Load this lyric into Studio</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <pre className="max-h-40 overflow-y-auto text-[11px] font-mono text-gatefold-text-2 bg-gatefold-surface p-3 rounded-lg whitespace-pre-wrap">
                  {selectedCandidate.syncedLyrics || selectedCandidate.plainLyrics}
                </pre>
              </div>
            )}
          </>
        ) : (
          /* Manual Paste & File Upload Area */
          <div className="gatefold-card-strong p-5 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".lrc,.srt,.vtt,.txt"
              onChange={handleUploadSubtitleFile}
              className="hidden"
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gatefold-line">
              <div>
                <label className="block text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider mb-0.5">
                  Import or Paste .LRC / .SRT / Ruby Lyrics
                </label>
                <p className="text-[11px] text-gatefold-text-3">
                  Supports SubRip `.srt`, Standard `.lrc`, NetEase `.yrc`, and Markdown Ruby `&#123;Kanji|Ruby&#125;` with auto word segmentation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-lg bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-accent/40 text-gatefold-accent font-semibold text-xs flex items-center gap-1.5 shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Choose .LRC / .SRT File</span>
              </button>
            </div>
            <div>
              <textarea
                rows={10}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="[00:12.00] もう{何|なに}もいらない... or paste .SRT blocks here"
                className="w-full p-3 text-xs font-mono bg-gatefold-surface border border-gatefold-line rounded-lg text-gatefold-text focus:border-gatefold-accent focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gatefold-text-3 font-mono">
                {manualText.split(/\r?\n/).filter((l) => l.trim()).length} lines in buffer
              </span>
              <button
                onClick={handleApplyManual}
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
