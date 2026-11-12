import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileText,
  Check,
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
import { parseLrcNative } from '../../services/lyrics/lrcParser';
import type { LyricsCandidate } from '../../services/lyrics/types';

export const LyricsDrawer: React.FC = () => {
  const track = useStudioStore((s) => s.track);
  const setActiveTab = useStudioStore((s) => s.setActiveTab);
  const importLyrics = useStudioStore((s) => s.importLyrics);
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
    } catch {
      setSearchError('Failed to search lyrics providers. Please check your connection or use manual paste.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplyCandidate = async (candidate: LyricsCandidate) => {
    const raw = candidate.syncedLyrics || candidate.plainLyrics;
    if (!raw) return;

    const parsedLines = await parseLrcNative(raw, candidate.translationLyrics);
    if (parsedLines.length > 0) {
      importLyrics(parsedLines, {
        title: candidate.title,
        artist: candidate.artist,
        duration: candidate.duration > 0 ? candidate.duration : undefined,
      });
      setActiveTab('studio');
    }
  };

  const handleApplyManual = async () => {
    if (!manualText.trim()) return;

    const parsedLines = await parseLrcNative(manualText);
    if (parsedLines.length > 0) {
      importLyrics(parsedLines);
      setActiveTab('studio');
    }
  };

  const handleUploadSubtitleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const content = String(reader.result || '');
      setManualText(content);
      const parsedLines = await parseLrcNative(content);
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
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-gatefold-bg/30 select-none">
      <div className="w-full max-w-[1720px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMode('search')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                mode === 'search'
                  ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40'
                  : 'bg-gatefold-surface border border-gatefold-line text-gatefold-text-3 hover:text-gatefold-text'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Online Database Search</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                mode === 'manual'
                  ? 'bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/40'
                  : 'bg-gatefold-surface border border-gatefold-line text-gatefold-text-3 hover:text-gatefold-text'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Import / Paste .LRC or .SRT</span>
            </button>
          </div>
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
                  Duration filter: {track.duration > 0 ? `${Math.round(track.duration)}s tolerance (±4s)` : 'Any'}
                </span>
                <button
                  type="button"
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
                  type="button"
                  onClick={handleSearch}
                  className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded text-[11px] font-medium"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Widescreen 2-Column Layout: Left = Candidate Cards, Right = Lyrics Full Preview (Balanced Heights) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Column: Candidate Matches List */}
              <div className="lg:col-span-5 flex flex-col h-[560px] space-y-3">
                <div className="flex justify-between items-center px-1 shrink-0">
                  <span className="text-[10px] font-semibold text-gatefold-text-3 uppercase tracking-wider font-mono">
                    Candidate Matches ({candidates.length})
                  </span>
                  <span className="text-[10px] text-gatefold-text-3 font-mono">
                    Ranked by similarity
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
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
                    <div className="gatefold-card h-full flex flex-col items-center justify-center text-center space-y-3 p-6">
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
                        type="button"
                        onClick={() => setMode('manual')}
                        className="px-3 py-1.5 rounded-lg bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-xs font-medium text-gatefold-text"
                      >
                        Paste Lyrics Manually
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 pr-1">
                      {candidates.map((cand) => {
                        const isSelected = selectedId === cand.id;
                        const matchPct = Math.round(cand.similarity * 100);

                        return (
                          <div
                            key={cand.id}
                            onClick={() => setSelectedId(cand.id)}
                            className={`gatefold-card p-3.5 flex flex-col gap-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-gatefold-accent bg-gatefold-accent/10 shadow-sm'
                                : 'hover:border-gatefold-line-2'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="text-xs font-semibold text-gatefold-text truncate">{cand.title}</h4>
                                <p className="text-[11px] text-gatefold-text-3 truncate mt-0.5">
                                  {cand.artist} {cand.album ? `• ${cand.album}` : ''}
                                </p>
                              </div>
                              <span
                                className={`text-xs font-bold font-mono shrink-0 ${
                                  matchPct >= 90
                                    ? 'text-emerald-400'
                                    : matchPct >= 75
                                    ? 'text-cyan-400'
                                    : 'text-gatefold-text-3'
                                }`}
                              >
                                {matchPct}% Match
                              </span>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-gatefold-line/60">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-gatefold-surface-2 text-gatefold-accent border border-gatefold-line">
                                  {cand.source}
                                </span>
                                {cand.isWordSynced && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>Word-Sync</span>
                                  </span>
                                )}
                                {cand.hasTranslation && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                                    Translation
                                  </span>
                                )}
                                {cand.duration > 0 && (
                                  <span className="text-[9px] font-mono text-gatefold-text-3">
                                    {Math.round(cand.duration)}s
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApplyCandidate(cand);
                                }}
                                className="px-2.5 py-1 rounded bg-gatefold-accent text-gatefold-bg hover:opacity-90 font-semibold text-[11px] transition-all flex items-center gap-1"
                                title="Apply to Studio"
                              >
                                <Check className="w-3 h-3" />
                                <span>Apply</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Detailed Candidate Preview Pane */}
              <div className="lg:col-span-7 flex flex-col h-[560px] space-y-3">
                <div className="flex justify-between items-center px-1 shrink-0">
                  <span className="text-[10px] font-semibold text-gatefold-text-3 uppercase tracking-wider font-mono">
                    Lyrics Preview & Synchronization Details
                  </span>
                  {selectedCandidate && (
                    <button
                      type="button"
                      onClick={() => handleApplyCandidate(selectedCandidate)}
                      className="text-xs text-gatefold-accent hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Load this lyric into Studio</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {selectedCandidate ? (
                  <div className="gatefold-card-strong p-4 flex flex-col flex-1 min-h-0 space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-gatefold-line shrink-0">
                      <div>
                        <h3 className="text-sm font-semibold text-gatefold-text">{selectedCandidate.title}</h3>
                        <p className="text-xs text-gatefold-text-3 mt-0.5">
                          {selectedCandidate.artist} {selectedCandidate.album ? `(${selectedCandidate.album})` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyCandidate(selectedCandidate)}
                        className="px-4 py-2 bg-gatefold-accent text-gatefold-bg font-semibold text-xs rounded-lg hover:opacity-90 transition-all flex items-center gap-1.5 shadow-md shadow-gatefold-accent/10"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Apply Lyric to Project</span>
                      </button>
                    </div>

                    <pre className="flex-1 min-h-0 overflow-y-auto text-xs font-mono text-gatefold-text-2 bg-gatefold-surface p-4 rounded-lg whitespace-pre-wrap leading-relaxed border border-gatefold-line">
                      {selectedCandidate.syncedLyrics || selectedCandidate.plainLyrics}
                    </pre>
                  </div>
                ) : (
                  <div className="gatefold-card p-12 flex flex-col flex-1 min-h-0 items-center justify-center text-center space-y-2">
                    <FileText className="w-10 h-10 text-gatefold-text-3 opacity-40" />
                    <h4 className="text-sm font-semibold text-gatefold-text-2">
                      No Lyric Selected
                    </h4>
                    <p className="text-xs text-gatefold-text-3 max-w-sm">
                      Select a candidate match on the left to preview synchronized timestamps, word-level tags, and translation lines.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Manual Paste & File Upload Area */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 gatefold-card-strong p-5 space-y-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-gatefold-text">
                  Import Subtitle File
                </h3>
                <p className="text-[11px] text-gatefold-text-3 mt-1 leading-relaxed">
                  Upload an existing timestamped lyric file or paste directly. All furigana tags and timings are automatically recognized.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".lrc,.srt,.vtt,.txt"
                onChange={handleUploadSubtitleFile}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-lg bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-accent/40 text-gatefold-accent font-semibold text-xs flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Upload .LRC / .SRT File...</span>
              </button>

              <div className="pt-3 border-t border-gatefold-line space-y-2 text-[11px] text-gatefold-text-3">
                <span className="font-semibold text-gatefold-text-2 block uppercase text-[10px] font-mono">
                  Supported Formats
                </span>
                <ul className="list-disc list-inside space-y-1 font-mono text-[10px]">
                  <li>LRC Timestamp: <code className="text-gatefold-text">[00:12.30]</code></li>
                  <li>SRT Blocks: <code className="text-gatefold-text">1 \n 00:00:01,000</code></li>
                  <li>Ruby Markdown: <code className="text-gatefold-text">&#123;Kanji|Ruby&#125;</code></li>
                  <li>NetEase YRC Word Timings</li>
                </ul>
              </div>
            </div>

            <div className="lg:col-span-8 gatefold-card-strong p-5 space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider font-mono">
                  LRC / SRT / Ruby Monospace Buffer
                </label>
                <span className="text-[10px] text-gatefold-text-3 font-mono">
                  {manualText.split(/\r?\n/).filter((l) => l.trim()).length} lines in buffer
                </span>
              </div>

              <textarea
                rows={18}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="[00:12.00] もう{何|なに}もいらない... or paste .SRT blocks here"
                className="w-full p-4 text-xs font-mono bg-gatefold-surface border border-gatefold-line rounded-lg text-gatefold-text focus:border-gatefold-accent focus:outline-none resize-none leading-relaxed"
              />

              <div className="flex justify-end items-center">
                <button
                  type="button"
                  onClick={handleApplyManual}
                  className="px-5 py-2.5 bg-gatefold-accent text-gatefold-bg font-semibold text-xs rounded-lg hover:opacity-90 transition-all flex items-center gap-2 shadow-md shadow-gatefold-accent/10"
                >
                  <Check className="w-4 h-4" />
                  <span>Parse & Commit to Studio</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
