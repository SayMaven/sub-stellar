import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download,
  Video,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  FileAudio,
  RefreshCw,
  Clock,
  Layers,
  ClipboardPaste,
  Wand2,
  HardDrive,
  FolderOpen,
  Trash2,
  History,
  Music,
  Film,
  X,
  Play,
  Subtitles,
} from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import { useThemeStore } from '../../stores/useThemeStore';
import {
  tauriBridge,
  type YouTubeMetadata,
  type YtDlpStatus,
  type CachedMediaItem,
} from '../../services/tauriBridge';
import { aggregateLyricsSearch } from '../../services/lyrics/lyricsAggregator';
import { parseLrcNative } from '../../services/lyrics/lrcParser';

const YT_URL_REGEX =
  /^https?:\/\/(?:(?:www|m|music)\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const RECENT_HISTORY_KEY = 'substellar:youtube-history:v1';

export interface YouTubeHistoryItem {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration_seconds: number;
  thumbnail_url: string;
  fetchedAt: number;
}

interface PersistedDrawerSession {
  url: string;
  metadata: YouTubeMetadata | null;
  customTitle: string;
  customArtist: string;
  selectedFormat: string;
  selectedSubLang: string;
  selectedTransSubLang: string;
  autoFetchLyrics: boolean;
  autoFurigana: boolean;
  autoThemePalette: boolean;
}

// Module-level session memory so switching tabs (YouTube <-> Lyrics <-> Studio) is 0ms and never loses state
let sessionMemory: PersistedDrawerSession = {
  url: '',
  metadata: null,
  customTitle: '',
  customArtist: '',
  selectedFormat: '',
  selectedSubLang: 'none',
  selectedTransSubLang: 'none',
  autoFetchLyrics: true,
  autoFurigana: true,
  autoThemePalette: true,
};

/**
 * Cleans YouTube video title noise (e.g. [Official MV], 【4K】, (Full Ver.)) and extracts Artist / Title when formatted as "Artist - Title" or "Artist「Title」".
 */
export function parseCleanYouTubeTitleAndArtist(
  rawTitle: string,
  rawChannel: string
): { title: string; artist: string } {
  let cleaned = (rawTitle || '')
    .replace(
      /\s*[\(\[【（](?:official|mv|music\s*video|lyric\s*video|pv|audio|full\s*ver\.?|short\s*ver\.?|hd|4k|60fps|sub\s*español|english\s*sub|romaji|kanji|furigana|karaoke|cover|歌ってみた)[^\)\]】）]*[\)\]】）]/gi,
      ''
    )
    .replace(/\s*(?:\/\/|\||｜)\s*(?:official\s*(?:mv|music\s*video|video)|mv|pv).*$/i, '')
    .replace(/\s*-\s*(?:official\s*(?:mv|music\s*video|video)|mv|pv)\b.*$/i, '')
    .trim();

  let artist = (rawChannel || '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*Official\s*(?:YouTube\s*)?Channel$/i, '')
    .trim();

  // Check Japanese bracket pattern: Artist「Title」 or Artist『Title』
  const jpBracketMatch = cleaned.match(/^(.+?)\s*[「『](.+?)[」』]/);
  if (jpBracketMatch) {
    const candidateArtist = jpBracketMatch[1].replace(/^【[^】]+】\s*/, '').trim();
    const candidateTitle = jpBracketMatch[2].trim();
    if (candidateTitle) {
      return {
        title: candidateTitle,
        artist: candidateArtist || artist,
      };
    }
  }

  // Check standard "Artist - Title" separator
  const dashParts = cleaned.split(/\s+[-–—]\s+/);
  if (dashParts.length >= 2) {
    const left = dashParts[0].replace(/^【[^】]+】\s*/, '').trim();
    const right = dashParts.slice(1).join(' - ').trim();
    if (left && right) {
      return {
        title: right,
        artist: left,
      };
    }
  }

  cleaned = cleaned.replace(/^【[^】]+】\s*/, '').trim();
  return {
    title: cleaned || rawTitle.trim(),
    artist: artist || rawChannel.trim(),
  };
}

function loadRecentHistory(): YouTubeHistoryItem[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(RECENT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function saveRecentHistory(items: YouTubeHistoryItem[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(RECENT_HISTORY_KEY, JSON.stringify(items.slice(0, 8)));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export const YouTubeDrawer: React.FC = () => {
  const [url, setUrl] = useState(sessionMemory.url);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchStep, setFetchStep] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<YouTubeMetadata | null>(sessionMemory.metadata);
  const [customTitle, setCustomTitle] = useState(sessionMemory.customTitle);
  const [customArtist, setCustomArtist] = useState(sessionMemory.customArtist);
  const [ytDlpStatus, setYtDlpStatus] = useState<YtDlpStatus | null>(() =>
    tauriBridge.getCachedYtDlpStatus()
  );
  const [isCheckingBinary, setIsCheckingBinary] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState(sessionMemory.selectedFormat);
  const [selectedSubLang, setSelectedSubLang] = useState(sessionMemory.selectedSubLang);
  const [selectedTransSubLang, setSelectedTransSubLang] = useState(
    sessionMemory.selectedTransSubLang
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStep, setDownloadStep] = useState('');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Combo Ingestion toggles
  const [autoFetchLyrics, setAutoFetchLyrics] = useState(sessionMemory.autoFetchLyrics);
  const [autoFurigana, setAutoFurigana] = useState(sessionMemory.autoFurigana);
  const [autoThemePalette, setAutoThemePalette] = useState(sessionMemory.autoThemePalette);

  // Local cache & recent history
  const [cachedMedia, setCachedMedia] = useState<CachedMediaItem[]>([]);
  const [isLoadingCache, setIsLoadingCache] = useState(false);
  const [recentHistory, setRecentHistory] = useState<YouTubeHistoryItem[]>(() =>
    loadRecentHistory()
  );

  // Narrow Zustand selectors — NEVER subscribe to entire store (prevents 60 FPS re-renders during playback)
  const loadSampleTrack = useStudioStore((s) => s.loadSampleTrack);
  const setActiveTab = useStudioStore((s) => s.setActiveTab);
  const setTrack = useStudioStore((s) => s.setTrack);
  const setProjectFilePath = useStudioStore((s) => s.setProjectFilePath);
  const importLyrics = useStudioStore((s) => s.importLyrics);
  const autoFuriganaAll = useStudioStore((s) => s.autoFuriganaAll);
  const loadLocalMediaFromPath = useStudioStore((s) => s.loadLocalMediaFromPath);
  const saveToLocalStorage = useStudioStore((s) => s.saveToLocalStorage);
  const activeTrackId = useStudioStore((s) => s.track.id);
  const extractFromCover = useThemeStore((s) => s.extractFromCover);

  // Sync local state into module-level session memory
  useEffect(() => {
    sessionMemory = {
      url,
      metadata,
      customTitle,
      customArtist,
      selectedFormat,
      selectedSubLang,
      selectedTransSubLang,
      autoFetchLyrics,
      autoFurigana,
      autoThemePalette,
    };
  }, [
    url,
    metadata,
    customTitle,
    customArtist,
    selectedFormat,
    selectedSubLang,
    selectedTransSubLang,
    autoFetchLyrics,
    autoFurigana,
    autoThemePalette,
  ]);

  const refreshCacheList = useCallback(async () => {
    if (!tauriBridge.isAvailable()) return;
    setIsLoadingCache(true);
    try {
      const list = await tauriBridge.listCachedYouTubeMedia();
      setCachedMedia(list);
    } finally {
      setIsLoadingCache(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!ytDlpStatus) {
      tauriBridge
        .checkYtDlp(false)
        .then((st) => {
          if (mounted) setYtDlpStatus(st);
        })
        .catch(() => {});
    }
    void refreshCacheList();
    return () => {
      mounted = false;
    };
  }, [ytDlpStatus, refreshCacheList]);

  const handleRefreshYtDlp = async () => {
    setIsCheckingBinary(true);
    try {
      const st = await tauriBridge.checkYtDlp(true);
      setYtDlpStatus(st);
    } finally {
      setIsCheckingBinary(false);
    }
  };

  // Instant Video ID detection from current URL input
  const detectedVideoId = useMemo(() => {
    const match = url.trim().match(YT_URL_REGEX);
    return match ? match[1] : null;
  }, [url]);

  const validateUrl = (input: string): boolean => {
    const trimmed = input.trim();
    if (!trimmed) {
      setValidationError('Please enter a YouTube video URL.');
      return false;
    }

    if (!YT_URL_REGEX.test(trimmed)) {
      setValidationError(
        'URL must be a valid YouTube address (e.g. https://www.youtube.com/watch?v=..., https://youtu.be/..., or music.youtube.com)'
      );
      return false;
    }

    setValidationError(null);
    return true;
  };

  const applyResolvedMetadata = useCallback(
    (data: YouTubeMetadata, sourceUrl: string) => {
      setMetadata(data);
      const cleaned = parseCleanYouTubeTitleAndArtist(data.title, data.channel);
      setCustomTitle(cleaned.title);
      setCustomArtist(cleaned.artist);
      setSelectedFormat(data.formats[0]?.format_id ?? '');

      // Default to first official video subtitle track if available (already sorted ja -> id -> en)
      const subs = data.subtitles ?? [];
      if (subs.length > 0) {
        const primary = subs[0].lang;
        setSelectedSubLang(primary);
        const secondary = subs.find(
          (s) =>
            s.lang !== primary &&
            (s.lang.startsWith('id') || s.lang.startsWith('en'))
        );
        setSelectedTransSubLang(secondary ? secondary.lang : 'none');
      } else {
        setSelectedSubLang('none');
        setSelectedTransSubLang('none');
      }

      setDownloadError(null);
      setStatusNotice(null);

      const historyEntry: YouTubeHistoryItem = {
        id: data.id,
        url: sourceUrl,
        title: data.title,
        channel: data.channel,
        duration_seconds: data.duration_seconds,
        thumbnail_url: data.thumbnail_url,
        fetchedAt: Date.now(),
      };
      setRecentHistory((prev) => {
        const next = [historyEntry, ...prev.filter((item) => item.id !== data.id)].slice(0, 8);
        saveRecentHistory(next);
        return next;
      });
      void refreshCacheList();
    },
    [refreshCacheList]
  );

  const handleFetchWithUrl = async (targetUrl: string) => {
    if (!validateUrl(targetUrl)) return;

    setIsFetching(true);
    setFetchStep('Probing video metadata, H.264 streams, and creator subtitle tracks...');
    setMetadata(null);
    setStatusNotice(null);

    try {
      const data = await tauriBridge.getYouTubeMetadata(targetUrl.trim());
      applyResolvedMetadata(data, targetUrl.trim());
      setFetchStep('');
    } catch (err) {
      setValidationError(
        err instanceof Error
          ? err.message
          : 'Failed to retrieve YouTube video metadata. Please verify the URL.'
      );
      setFetchStep('');
    } finally {
      setIsFetching(false);
    }
  };

  const handleFetch = () => {
    void handleFetchWithUrl(url);
  };

  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = (await navigator.clipboard.readText()).trim();
        if (text) {
          setUrl(text);
          setValidationError(null);
          if (YT_URL_REGEX.test(text)) {
            await handleFetchWithUrl(text);
          }
        }
      }
    } catch {
      setValidationError('Clipboard access was denied. Please press Ctrl+V in the URL field.');
    }
  };

  const handleCleanMetadataNoise = () => {
    if (!metadata) return;
    const cleaned = parseCleanYouTubeTitleAndArtist(
      customTitle || metadata.title,
      customArtist || metadata.channel
    );
    setCustomTitle(cleaned.title);
    setCustomArtist(cleaned.artist);
    setStatusNotice('Cleaned title & artist noise for accurate lyrics matching.');
  };

  const formatSize = (bytes: number): string =>
    bytes > 0 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : 'size unknown';

  const effectiveTitle = (customTitle || metadata?.title || '').trim();
  const effectiveArtist = (customArtist || metadata?.channel || '').trim();

  const trackFromMetadata = (m: YouTubeMetadata) => ({
    id: m.id,
    title: effectiveTitle || m.title,
    artist: effectiveArtist || m.channel,
    duration: m.duration_seconds,
    coverUrl: m.thumbnail_url,
  });

  const canDownload = Boolean(ytDlpStatus?.available) && Boolean(selectedFormat);
  const availableSubtitles = metadata?.subtitles ?? [];

  // Check which formats of the current video are already cached on disk
  const cachedFormatsForCurrentVideo = useMemo(() => {
    if (!metadata) return new Set<string>();
    const set = new Set<string>();
    for (const item of cachedMedia) {
      if (item.video_id === metadata.id) {
        if (item.format_id) {
          set.add(item.format_id);
        } else {
          const stem = item.file_name.replace(/\.[^.]+$/, '');
          const fmtPart = stem.slice(metadata.id.length + 1);
          if (fmtPart) set.add(fmtPart);
        }
      }
    }
    return set;
  }, [cachedMedia, metadata]);

  // Run subtitle/lyrics pipeline: prioritizes creator-provided video subtitle if selected, otherwise queries LRCLIB + NetEase
  const runPostIngestionPipeline = async (
    canonicalUrl: string,
    titleQuery: string,
    artistQuery: string,
    durationSec: number
  ): Promise<boolean> => {
    // Priority 1: Official Creator Subtitle from the YouTube video itself (non-auto-translated)
    if (
      selectedSubLang &&
      selectedSubLang !== 'none' &&
      availableSubtitles.some((s) => s.lang === selectedSubLang)
    ) {
      setDownloadStep(`Downloading official video subtitle (${selectedSubLang})...`);
      try {
        const primaryRaw = await tauriBridge.downloadYouTubeSubtitle(
          canonicalUrl,
          selectedSubLang
        );
        let transRaw: string | undefined;
        if (
          selectedTransSubLang &&
          selectedTransSubLang !== 'none' &&
          selectedTransSubLang !== selectedSubLang
        ) {
          setDownloadStep(
            `Downloading secondary translation subtitle (${selectedTransSubLang})...`
          );
          try {
            transRaw = await tauriBridge.downloadYouTubeSubtitle(
              canonicalUrl,
              selectedTransSubLang
            );
          } catch {
            // Optional secondary subtitle failure is non-fatal
          }
        }

        const parsedLines = await parseLrcNative(primaryRaw, transRaw);
        if (parsedLines.length > 0) {
          importLyrics(parsedLines);
          if (autoFurigana) {
            setDownloadStep('Generating Japanese Furigana ({Kanji|Ruby}) via Kuromoji...');
            try {
              await autoFuriganaAll({ overwrite: false });
            } catch (fErr) {
              console.warn('Auto-furigana failed (subtitles retained):', fErr);
            }
          }
          return true;
        }
      } catch (subErr) {
        console.warn('Failed to extract official video subtitle, trying external search:', subErr);
      }
    }

    // Priority 2: External Multi-Source Lyrics Search (LRCLIB + NetEase)
    if (!autoFetchLyrics) return false;

    setDownloadStep(`Searching synced lyrics for "${titleQuery}"...`);
    try {
      const candidates = await aggregateLyricsSearch({
        title: titleQuery,
        artist: artistQuery,
        duration: durationSec,
      });

      const best = candidates.find((c) => Boolean(c.syncedLyrics)) || candidates[0];
      if (best) {
        const raw = best.syncedLyrics || best.plainLyrics;
        if (raw) {
          const parsedLines = await parseLrcNative(raw, best.translationLyrics);
          if (parsedLines.length > 0) {
            importLyrics(parsedLines);
            if (autoFurigana) {
              setDownloadStep('Generating Japanese Furigana ({Kanji|Ruby}) via Kuromoji...');
              try {
                await autoFuriganaAll({ overwrite: false });
              } catch (fErr) {
                console.warn('Auto-furigana failed (lyrics retained):', fErr);
              }
            }
            return true;
          }
        }
      }
    } catch {
      // Non-fatal: media is still loaded even if online lyrics search fails
    }
    return false;
  };

  // Download with yt-dlp (using real video title for cache filename), run subtitle/lyrics pipeline, then open Studio
  const handleDownloadAndImport = async () => {
    if (!metadata || !canDownload) return;

    setIsDownloading(true);
    setDownloadError(null);
    setStatusNotice(null);
    setDownloadStep(
      cachedFormatsForCurrentVideo.has(selectedFormat)
        ? 'Loading existing media from local disk cache...'
        : 'Downloading with yt-dlp and merging H.264/AAC streams...'
    );

    try {
      const isAudio = selectedFormat === 'audio';
      const canonicalUrl = url.trim() || `https://www.youtube.com/watch?v=${metadata.id}`;
      const localPath = await tauriBridge.downloadYouTubeMedia(
        canonicalUrl,
        selectedFormat,
        isAudio ? 'audio' : 'video',
        {
          title: metadata.title,
          channel: metadata.channel,
          durationSeconds: metadata.duration_seconds,
        }
      );
      const playable = await tauriBridge.toPlayableUrl(localPath);

      const nextTrack = trackFromMetadata(metadata);
      setProjectFilePath(null);
      setTrack({
        ...nextTrack,
        videoUrl: isAudio ? undefined : playable,
        audioUrl: isAudio ? playable : undefined,
        mediaFilePath: localPath,
      });

      if (autoThemePalette && metadata.thumbnail_url) {
        extractFromCover(metadata.thumbnail_url);
      }

      await runPostIngestionPipeline(
        canonicalUrl,
        nextTrack.title,
        nextTrack.artist,
        metadata.duration_seconds
      );

      saveToLocalStorage();
      void refreshCacheList();
      setActiveTab('studio');
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDownloading(false);
      setDownloadStep('');
    }
  };

  // Import only the selected official YouTube subtitle track into Studio
  const handleImportVideoSubtitleOnly = async () => {
    if (!metadata || !selectedSubLang || selectedSubLang === 'none') return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const canonicalUrl = url.trim() || `https://www.youtube.com/watch?v=${metadata.id}`;
      const ok = await runPostIngestionPipeline(
        canonicalUrl,
        effectiveTitle || metadata.title,
        effectiveArtist || metadata.channel,
        metadata.duration_seconds
      );
      if (ok) {
        saveToLocalStorage();
        setActiveTab('studio');
      } else {
        setDownloadError('Could not parse subtitle lines from the selected video subtitle track.');
      }
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDownloading(false);
      setDownloadStep('');
    }
  };

  // Metadata only: no media file, optionally fetches video subtitle or lyrics & furigana
  const handleImportToStudio = async () => {
    if (!metadata) return;
    setIsDownloading(true);
    try {
      const canonicalUrl = url.trim() || `https://www.youtube.com/watch?v=${metadata.id}`;
      const nextTrack = trackFromMetadata(metadata);
      setProjectFilePath(null);
      setTrack({ ...nextTrack, videoUrl: undefined, audioUrl: undefined });
      if (autoThemePalette && metadata.thumbnail_url) {
        extractFromCover(metadata.thumbnail_url);
      }
      await runPostIngestionPipeline(
        canonicalUrl,
        nextTrack.title,
        nextTrack.artist,
        metadata.duration_seconds
      );
      saveToLocalStorage();
      setActiveTab('studio');
    } finally {
      setIsDownloading(false);
      setDownloadStep('');
    }
  };

  const handleSearchLyricsForThis = () => {
    if (!metadata) return;

    setTrack(trackFromMetadata(metadata));

    if (autoThemePalette && metadata.thumbnail_url) {
      extractFromCover(metadata.thumbnail_url);
    }

    setActiveTab('lyrics');
  };

  const handleLoadCachedMediaItem = async (item: CachedMediaItem) => {
    try {
      const playable = await tauriBridge.toPlayableUrl(item.file_path);
      const historyMatch = recentHistory.find((h) => h.id === item.video_id);
      const rawTitle = item.title || historyMatch?.title || item.file_name;
      const rawChannel = item.channel || historyMatch?.channel || 'YouTube Creator';
      const cleaned = parseCleanYouTubeTitleAndArtist(rawTitle, rawChannel);
      const thumbUrl =
        item.thumbnail_url ||
        historyMatch?.thumbnail_url ||
        `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg`;

      setProjectFilePath(null);
      setTrack({
        id: item.video_id,
        title: cleaned.title,
        artist: cleaned.artist,
        duration: item.duration_seconds || historyMatch?.duration_seconds || 180,
        coverUrl: thumbUrl,
        videoUrl: item.is_audio ? undefined : playable,
        audioUrl: item.is_audio ? playable : undefined,
        mediaFilePath: item.file_path,
      });

      if (autoThemePalette) {
        extractFromCover(thumbUrl);
      }

      saveToLocalStorage();
      setActiveTab('studio');
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteCachedMediaItem = async (fileName: string) => {
    try {
      await tauriBridge.deleteCachedYouTubeMedia(fileName);
      await refreshCacheList();
      setStatusNotice(`Removed ${fileName} from local media cache.`);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSelectHistoryItem = (item: YouTubeHistoryItem) => {
    setUrl(item.url);
    setValidationError(null);
    void handleFetchWithUrl(item.url);
  };

  const handleOpenLocalMediaFile = async () => {
    if (tauriBridge.isAvailable()) {
      try {
        const chosen = await tauriBridge.openMediaDialog();
        if (chosen) {
          await loadLocalMediaFromPath(chosen);
          saveToLocalStorage();
          setActiveTab('studio');
        }
        return;
      } catch {
        // Fall through to demo
      }
    }
    loadSampleTrack();
    setActiveTab('studio');
  };

  const handleDemoClick = () => {
    loadSampleTrack();
    setActiveTab('studio');
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalCacheBytes = useMemo(
    () => cachedMedia.reduce((acc, item) => acc + item.size_bytes, 0),
    [cachedMedia]
  );

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 py-5 overflow-y-auto bg-gatefold-bg/30 select-none">
      <div className="w-full max-w-[1720px] mx-auto space-y-5">
        {/* Top Studio Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gatefold-line">
          <div>
            <h2 className="text-lg font-semibold text-gatefold-text flex items-center gap-2">
              <Video className="w-5 h-5 text-red-500" />
              <span>1-Click YouTube Ingestion & Media Cache Studio</span>
            </h2>
            <p className="text-xs text-gatefold-text-3 mt-0.5">
              Extract H.264/AAC WebView2-ready streams, official creator subtitles, auto-sync Furigana, and manage local disk cache.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {ytDlpStatus && (
              <span
                className={`text-[10px] font-mono px-2.5 py-1 rounded border flex items-center gap-1.5 ${
                  ytDlpStatus.available
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-gatefold-surface text-gatefold-text-3 border-gatefold-line'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    ytDlpStatus.available ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                {ytDlpStatus.available
                  ? `yt-dlp ${ytDlpStatus.version || 'Ready'}`
                  : 'Fast Web API Mode (yt-dlp optional)'}
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleRefreshYtDlp()}
              disabled={isCheckingBinary}
              title="Re-check yt-dlp binary on system PATH"
              className="p-1.5 rounded bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-gatefold-text-2 hover:text-gatefold-text transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingBinary ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 2-Column High-Density Studio Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN (7 Cols): URL Ingestion, Creator Subtitles & Combo Pipeline */}
          <div className="lg:col-span-7 space-y-4">
            {/* URL Input Card */}
            <div className="gatefold-card-strong p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider font-mono">
                  YouTube Video / Shorts / Music URL
                </label>
                {detectedVideoId && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gatefold-accent/15 text-gatefold-accent border border-gatefold-accent/30">
                    Detected ID: {detectedVideoId}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                    className={`w-full pl-3 pr-8 py-2 text-xs bg-gatefold-surface border rounded-lg text-gatefold-text placeholder:text-gatefold-text-3 focus:outline-none transition-colors font-mono ${
                      validationError
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-gatefold-line focus:border-gatefold-accent'
                    }`}
                  />
                  {url && (
                    <button
                      type="button"
                      onClick={() => {
                        setUrl('');
                        setValidationError(null);
                      }}
                      title="Clear URL"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gatefold-text-3 hover:text-gatefold-text"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handlePasteClipboard()}
                  disabled={isFetching || isDownloading}
                  title="Paste YouTube URL from Clipboard & Inspect"
                  className="px-3 py-2 bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-gatefold-text font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-gatefold-accent" />
                  <span>Paste</span>
                </button>

                <button
                  type="button"
                  onClick={handleFetch}
                  disabled={isFetching || isDownloading}
                  className="px-4 py-2 bg-gatefold-accent text-gatefold-bg font-semibold text-xs rounded-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  {isFetching ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{isFetching ? 'Inspecting...' : 'Fetch Video'}</span>
                </button>
              </div>

              {/* Validation Feedback */}
              {validationError && (
                <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Notice Feedback */}
              {statusNotice && !validationError && (
                <div className="flex items-center justify-between gap-2 text-xs text-emerald-300 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/25">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{statusNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatusNotice(null)}
                    className="text-emerald-300/70 hover:text-emerald-200 text-[10px] font-mono"
                  >
                    Dismiss
                  </button>
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
            </div>

            {/* Video Preview & Ingestion Workbench (When Metadata Loaded) */}
            {metadata ? (
              <div className="gatefold-card-strong p-5 space-y-4 border-gatefold-accent/40 bg-gatefold-surface/60">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {/* Thumbnail */}
                  <div className="relative w-full sm:w-52 aspect-video rounded-lg overflow-hidden bg-gatefold-surface shrink-0 border border-gatefold-line shadow-lg">
                    <img
                      src={metadata.thumbnail_url}
                      alt={metadata.title}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] text-white">
                      {formatDuration(metadata.duration_seconds)}
                    </span>
                    {cachedFormatsForCurrentVideo.size > 0 && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-emerald-500/90 font-mono text-[9px] font-semibold text-black">
                        CACHED ON DISK
                      </span>
                    )}
                  </div>

                  {/* Info & Metadata */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/30 inline-block">
                        Video Resolved
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-gatefold-text-3 font-mono">
                        <Clock className="w-3 h-3 text-gatefold-accent" />
                        <span>{formatDuration(metadata.duration_seconds)}</span>
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-gatefold-text-3 font-mono">
                        <Layers className="w-3 h-3 text-gatefold-accent" />
                        <span>ID: {metadata.id}</span>
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-gatefold-text leading-snug line-clamp-2">
                      {metadata.title}
                    </h3>
                    <p className="text-xs text-gatefold-text-3 font-medium">
                      Channel: {metadata.channel}
                    </p>
                  </div>
                </div>

                {/* Smart Track Title & Artist Cleaner / Override */}
                <div className="p-3.5 rounded-lg bg-gatefold-bg/60 border border-gatefold-line space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-gatefold-text-2 font-semibold">
                      Project Track Metadata & Lyrics Search Query
                    </span>
                    <button
                      type="button"
                      onClick={handleCleanMetadataNoise}
                      className="px-2 py-1 rounded bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-[10px] font-mono text-gatefold-accent flex items-center gap-1 transition-colors"
                      title="Remove [Official MV], (4K), and split Artist - Title"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>Clean Title Noise</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-mono text-gatefold-text-3 mb-1">
                        Song Title
                      </label>
                      <input
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder={metadata.title}
                        className="w-full px-2.5 py-1.5 text-xs bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text focus:outline-none focus:border-gatefold-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-gatefold-text-3 mb-1">
                        Artist / Vocalist
                      </label>
                      <input
                        type="text"
                        value={customArtist}
                        onChange={(e) => setCustomArtist(e.target.value)}
                        placeholder={metadata.channel}
                        className="w-full px-2.5 py-1.5 text-xs bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text focus:outline-none focus:border-gatefold-accent"
                      />
                    </div>
                  </div>
                </div>

                {/* Resolution & Stream Format Picker */}
                {metadata.formats.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-gatefold-line">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="yt-format"
                        className="block text-[11px] font-semibold text-gatefold-text-2 uppercase tracking-wider font-mono"
                      >
                        Stream Format & Resolution (H.264 / M4A)
                      </label>
                      <span className="text-[10px] font-mono text-gatefold-text-3">
                        Saved with Real Video Title
                      </span>
                    </div>

                    {/* Visual Format Grid + Native Select for accessibility/test compatibility */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {metadata.formats.map((f) => {
                        const isSelected = selectedFormat === f.format_id;
                        const isCached = cachedFormatsForCurrentVideo.has(f.format_id);
                        const isAudioFmt = f.format_id === 'audio';
                        return (
                          <button
                            key={f.format_id}
                            type="button"
                            disabled={isDownloading}
                            onClick={() => setSelectedFormat(f.format_id)}
                            className={`p-2.5 rounded-lg border text-left transition-all ${
                              isSelected
                                ? 'bg-gatefold-accent/15 border-gatefold-accent text-gatefold-accent'
                                : 'bg-gatefold-surface border-gatefold-line text-gatefold-text hover:border-gatefold-line-2'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold font-mono flex items-center gap-1">
                                {isAudioFmt ? (
                                  <Music className="w-3 h-3 shrink-0" />
                                ) : (
                                  <Film className="w-3 h-3 shrink-0" />
                                )}
                                <span>{f.resolution}</span>
                              </span>
                              {isCached && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Cached
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gatefold-text-3 font-mono mt-1">
                              {formatSize(f.filesize_approx)}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <select
                      id="yt-format"
                      aria-label="Resolution"
                      value={selectedFormat}
                      onChange={(e) => setSelectedFormat(e.target.value)}
                      disabled={isDownloading}
                      className="sr-only"
                    >
                      {metadata.formats.map((f) => (
                        <option key={f.format_id} value={f.format_id}>
                          {f.resolution} - {formatSize(f.filesize_approx)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Official Video Creator Subtitles Selector (Auto-Translate / Auto-Generated Excluded) */}
                <div className="p-3.5 rounded-lg bg-gatefold-bg/60 border border-gatefold-line space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Subtitles className="w-3.5 h-3.5 text-gatefold-accent" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-gatefold-text-2 font-semibold">
                        Video Creator Subtitles (Official / Non-Auto-Translated)
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                        availableSubtitles.length > 0
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-gatefold-surface text-gatefold-text-3 border-gatefold-line'
                      }`}
                    >
                      {availableSubtitles.length > 0
                        ? `${availableSubtitles.length} Manual Track${
                            availableSubtitles.length === 1 ? '' : 's'
                          }`
                        : 'No Manual CC on Video'}
                    </span>
                  </div>

                  {availableSubtitles.length > 0 ? (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-mono text-gatefold-text-3 mb-1">
                            Primary Video Subtitle
                          </label>
                          <select
                            value={selectedSubLang}
                            onChange={(e) => setSelectedSubLang(e.target.value)}
                            disabled={isDownloading}
                            className="w-full px-2.5 py-1.5 text-xs bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text focus:outline-none focus:border-gatefold-accent"
                          >
                            <option value="none">
                              None — Use External Lyrics Search (LRCLIB / NetEase)
                            </option>
                            {availableSubtitles.map((sub) => (
                              <option key={sub.lang} value={sub.lang}>
                                {sub.name} [{sub.lang}]
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-gatefold-text-3 mb-1">
                            Secondary Translation Track (Optional)
                          </label>
                          <select
                            value={selectedTransSubLang}
                            onChange={(e) => setSelectedTransSubLang(e.target.value)}
                            disabled={isDownloading || selectedSubLang === 'none'}
                            className="w-full px-2.5 py-1.5 text-xs bg-gatefold-surface border border-gatefold-line rounded text-gatefold-text focus:outline-none focus:border-gatefold-accent disabled:opacity-40"
                          >
                            <option value="none">No Secondary Translation</option>
                            {availableSubtitles
                              .filter((sub) => sub.lang !== selectedSubLang)
                              .map((sub) => (
                                <option key={sub.lang} value={sub.lang}>
                                  {sub.name} [{sub.lang}]
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {selectedSubLang !== 'none' && (
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-[10px] text-gatefold-text-3">
                            Auto-translated & ASR tracks are excluded. Only genuine video subtitles are listed.
                          </span>
                          <button
                            type="button"
                            disabled={isDownloading}
                            onClick={() => void handleImportVideoSubtitleOnly()}
                            className="px-2.5 py-1 rounded bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-[10px] font-mono text-gatefold-accent shrink-0 transition-colors"
                          >
                            Import Subtitle Only
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gatefold-text-3 leading-relaxed">
                      This video has no manual creator subtitles (auto-translated captions are excluded). SubStellar will automatically query synchronized lyrics from LRCLIB & NetEase.
                    </p>
                  )}
                </div>

                {/* 1-Click Automation Combo Options */}
                <div className="p-3 rounded-lg bg-gatefold-bg/50 border border-gatefold-line space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-gatefold-text-2 font-semibold">
                    Automated Studio Setup Pipeline
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-gatefold-text-2 hover:text-gatefold-text">
                      <input
                        type="checkbox"
                        checked={autoFetchLyrics}
                        onChange={(e) => setAutoFetchLyrics(e.target.checked)}
                        className="rounded border-gatefold-line accent-[var(--accent)]"
                      />
                      <span>Auto-fetch fallback lyrics</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-gatefold-text-2 hover:text-gatefold-text">
                      <input
                        type="checkbox"
                        checked={autoFurigana}
                        onChange={(e) => setAutoFurigana(e.target.checked)}
                        className="rounded border-gatefold-line accent-[var(--accent)]"
                      />
                      <span>Auto-generate Furigana</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-gatefold-text-2 hover:text-gatefold-text">
                      <input
                        type="checkbox"
                        checked={autoThemePalette}
                        onChange={(e) => setAutoThemePalette(e.target.checked)}
                        className="rounded border-gatefold-line accent-[var(--accent)]"
                      />
                      <span>Adapt OKLCH cover theme</span>
                    </label>
                  </div>
                </div>

                {!ytDlpStatus?.available && (
                  <div className="flex items-start gap-1.5 text-xs text-gatefold-text-2 bg-gatefold-surface p-2.5 rounded-lg border border-gatefold-line">
                    <AlertCircle className="w-4 h-4 shrink-0 text-gatefold-accent mt-0.5" />
                    <span>
                      yt-dlp was not found on PATH. Install yt-dlp (and ffmpeg) to download playable media, or load metadata + synced lyrics only.
                    </span>
                  </div>
                )}

                {downloadError && (
                  <div className="flex items-center justify-between gap-2 text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="break-words min-w-0">{downloadError}</span>
                    </div>
                    <button
                      onClick={() => void handleDownloadAndImport()}
                      className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-[11px] font-medium shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {isDownloading && (
                  <div className="p-3 rounded-lg bg-gatefold-surface border border-gatefold-line text-xs space-y-2">
                    <div className="flex justify-between font-mono text-gatefold-text-2">
                      <span>{downloadStep || 'Downloading with yt-dlp and merging streams...'}</span>
                      <span className="text-gatefold-accent">In Progress</span>
                    </div>
                    <div className="h-1.5 w-full bg-gatefold-surface-2 rounded-full overflow-hidden">
                      <div className="h-full bg-gatefold-accent animate-pulse w-3/4" />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gatefold-line">
                  <button
                    onClick={() => void handleDownloadAndImport()}
                    disabled={!canDownload || isDownloading}
                    className="flex-1 py-2.5 px-4 bg-gatefold-accent text-gatefold-bg font-semibold text-xs rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>
                      {isDownloading
                        ? 'Processing...'
                        : cachedFormatsForCurrentVideo.has(selectedFormat)
                        ? 'Load Cached Stream into Studio'
                        : 'Download & Load into Studio'}
                    </span>
                  </button>
                  <button
                    onClick={() => void handleImportToStudio()}
                    disabled={isDownloading}
                    className="py-2.5 px-3.5 bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-xs font-semibold text-gatefold-text rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    title="Loads title, cover, and selected subtitle/lyrics without downloading video"
                  >
                    <CheckCircle2 className="w-4 h-4 text-gatefold-accent" />
                    <span>Metadata Only</span>
                  </button>
                  <button
                    onClick={handleSearchLyricsForThis}
                    disabled={isDownloading}
                    className="py-2.5 px-3.5 bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-xs font-semibold text-gatefold-text rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Music className="w-4 h-4 text-gatefold-accent" />
                    <span>Find Synced Lyrics</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Helpful Pre-Fetch Studio Pipeline Guide when no video is inspected yet */
              <div className="gatefold-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-gatefold-text-2">
                    Ingestion Workflow Specification
                  </h3>
                  <span className="text-[10px] font-mono text-gatefold-accent">
                    H.264 (avc1) + Official CC + Furigana
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-gatefold-surface/70 border border-gatefold-line space-y-1">
                    <div className="font-mono text-[10px] text-gatefold-accent font-semibold">
                      01 • STREAM & CC PROBE
                    </div>
                    <div className="font-medium text-gatefold-text">Paste & Inspect URL</div>
                    <p className="text-[11px] text-gatefold-text-3 leading-relaxed">
                      Extracts video title, H.264 MP4 / M4A streams, and genuine creator subtitles (excluding auto-translate).
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-gatefold-surface/70 border border-gatefold-line space-y-1">
                    <div className="font-mono text-[10px] text-gatefold-accent font-semibold">
                      02 • SUBTITLE & FURIGANA
                    </div>
                    <div className="font-medium text-gatefold-text">Video CC or Auto-Lyrics</div>
                    <p className="text-[11px] text-gatefold-text-3 leading-relaxed">
                      Imports official video subtitles (or LRCLIB/NetEase fallback) and annotates Kanji with Kuromoji ruby tags.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-gatefold-surface/70 border border-gatefold-line space-y-1">
                    <div className="font-mono text-[10px] text-gatefold-accent font-semibold">
                      03 • VISUAL DISK CACHE
                    </div>
                    <div className="font-medium text-gatefold-text">Real Title & Thumbnail</div>
                    <p className="text-[11px] text-gatefold-text-3 leading-relaxed">
                      Saves files with their original video title and displays thumbnail previews for instant 1-click reload.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN (5 Cols): Downloaded Media Cache Library with Thumbnails, Recent History & Local Fallback */}
          <div className="lg:col-span-5 space-y-4">
            {/* 1. Local Downloaded Media Cache Manager (with Thumbnail Previews & Real Video Titles) */}
            <div className="gatefold-card-strong p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-gatefold-accent shrink-0" />
                  <div>
                    <h3 className="text-xs font-semibold text-gatefold-text">
                      Downloaded Media Cache
                    </h3>
                    <p className="text-[10px] font-mono text-gatefold-text-3">
                      {cachedMedia.length} file{cachedMedia.length === 1 ? '' : 's'} •{' '}
                      {(totalCacheBytes / (1024 * 1024)).toFixed(1)} MB on disk
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshCacheList()}
                  disabled={isLoadingCache}
                  title="Refresh cached media files"
                  className="p-1.5 rounded bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-gatefold-text-3 hover:text-gatefold-text transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCache ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {cachedMedia.length === 0 ? (
                <div className="p-4 rounded-lg bg-gatefold-surface/50 border border-dashed border-gatefold-line text-center space-y-1">
                  <p className="text-xs text-gatefold-text-2 font-medium">
                    No cached YouTube streams on disk yet
                  </p>
                  <p className="text-[11px] text-gatefold-text-3">
                    Videos and audio tracks downloaded via yt-dlp will appear here with thumbnail previews and original titles.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {cachedMedia.map((item) => {
                    const historyMatch = recentHistory.find((h) => h.id === item.video_id);
                    const displayTitle =
                      item.title || historyMatch?.title || item.file_name;
                    const displayChannel =
                      item.channel || historyMatch?.channel || `ID: ${item.video_id}`;
                    const thumbUrl =
                      item.thumbnail_url ||
                      historyMatch?.thumbnail_url ||
                      `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg`;
                    const isCurrentlyLoaded = activeTrackId === item.video_id;

                    return (
                      <div
                        key={item.file_name}
                        title={item.file_name}
                        className={`p-2.5 rounded-lg border flex items-center gap-3 transition-colors ${
                          isCurrentlyLoaded
                            ? 'bg-gatefold-accent/10 border-gatefold-accent/40'
                            : 'bg-gatefold-surface border-gatefold-line hover:border-gatefold-line-2'
                        }`}
                      >
                        {/* 16:9 Thumbnail Preview */}
                        <div
                          onClick={() => void handleLoadCachedMediaItem(item)}
                          className="relative w-24 aspect-video rounded-md overflow-hidden bg-black border border-gatefold-line shrink-0 cursor-pointer group"
                        >
                          <img
                            src={thumbUrl}
                            alt={displayTitle}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-4 h-4 text-white fill-white" />
                          </div>
                          <span className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-black/85 font-mono text-[9px] text-gatefold-accent font-semibold">
                            {item.format_label}
                          </span>
                        </div>

                        {/* Title, Channel & Size Info */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-xs font-semibold text-gatefold-text line-clamp-1 leading-snug">
                            {displayTitle}
                          </div>
                          <div className="text-[11px] text-gatefold-text-3 truncate">
                            {displayChannel}
                          </div>
                          <div className="text-[10px] font-mono text-gatefold-text-3 flex items-center gap-2">
                            <span>{formatSize(item.size_bytes)}</span>
                            <span>•</span>
                            <span className="truncate opacity-75">ID: {item.video_id}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleLoadCachedMediaItem(item)}
                            title="Load directly into Studio (0s wait)"
                            className="px-2.5 py-1.5 rounded bg-gatefold-accent text-gatefold-bg text-[11px] font-semibold hover:opacity-90 flex items-center gap-1"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Load</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void tauriBridge.revealInExplorer(item.file_path)}
                            title="Reveal file in Windows Explorer"
                            className="p-1.5 rounded bg-gatefold-bg hover:bg-gatefold-hover border border-gatefold-line text-gatefold-text-2 hover:text-gatefold-text"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCachedMediaItem(item.file_name)}
                            title="Delete cached file from disk"
                            className="p-1.5 rounded bg-gatefold-bg hover:bg-red-500/20 border border-gatefold-line hover:border-red-500/40 text-gatefold-text-3 hover:text-red-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Recent Inspected Videos History */}
            {recentHistory.length > 0 && (
              <div className="gatefold-card p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gatefold-text flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-gatefold-accent" />
                    <span>Recent YouTube Lookups</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setRecentHistory([]);
                      saveRecentHistory([]);
                    }}
                    className="text-[10px] font-mono text-gatefold-text-3 hover:text-gatefold-text"
                  >
                    Clear
                  </button>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {recentHistory.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectHistoryItem(item)}
                      className="w-full p-2 rounded-lg bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-left flex items-center gap-2.5 transition-colors"
                    >
                      <img
                        src={item.thumbnail_url}
                        alt={item.title}
                        className="w-12 aspect-video rounded object-cover shrink-0 bg-black"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-gatefold-text truncate">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-gatefold-text-3 font-mono truncate">
                          {item.channel} • {formatDuration(item.duration_seconds)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Offline / Local File Importer & Demo Showcase */}
            <div className="gatefold-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FileAudio className="w-4 h-4 text-gatefold-accent shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold text-gatefold-text">Working Offline?</h4>
                    <p className="text-[11px] text-gatefold-text-3">
                      Load local `.mp4`, `.webm`, `.mkv`, `.mp3`, `.wav`, or `.flac` files directly.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleOpenLocalMediaFile()}
                  className="px-3 py-1.5 rounded-lg bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-xs font-medium text-gatefold-text shrink-0"
                >
                  Open Local Demo
                </button>
              </div>

              <div className="pt-2.5 border-t border-gatefold-line">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gatefold-text mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Instant Demo Showcase</span>
                </div>
                <p className="text-[11px] text-gatefold-text-3 mb-2.5">
                  Try a pre-loaded J-Pop track with Furigana ruby annotations and synchronized karaoke particles.
                </p>
                <button
                  type="button"
                  onClick={handleDemoClick}
                  className="w-full py-2 px-3 rounded-lg bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-xs text-gatefold-text font-medium flex items-center justify-between transition-colors"
                >
                  <span className="truncate">
                    Load Demo: Luna feat. Hatsune Miku - Stellar Night Flight
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-gatefold-accent shrink-0 ml-2" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
