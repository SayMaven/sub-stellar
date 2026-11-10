import React, { useState, useEffect } from 'react';
import {
  Download,
  Video,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  FileAudio,
  RefreshCw,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { tauriBridge, type YouTubeMetadata, type YtDlpStatus } from '../../services/tauriBridge';

export const YouTubeDrawer: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchStep, setFetchStep] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<YouTubeMetadata | null>(null);
  const [ytDlpStatus, setYtDlpStatus] = useState<YtDlpStatus | null>(null);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { loadSampleTrack, setActiveTab, setTrack } = useStudioStore();
  const { extractFromCover } = useThemeStore();

  useEffect(() => {
    tauriBridge.checkYtDlp().then(setYtDlpStatus).catch(() => {});
  }, []);

  const validateUrl = (input: string): boolean => {
    const trimmed = input.trim();
    if (!trimmed) {
      setValidationError('Please enter a YouTube video URL.');
      return false;
    }

    const regex = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/;
    if (!regex.test(trimmed)) {
      setValidationError('URL must be a valid YouTube address (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleFetch = async () => {
    if (!validateUrl(url)) return;

    setIsFetching(true);
    setFetchStep('Probing video metadata and stream endpoints...');
    setMetadata(null);

    try {
      const data = await tauriBridge.getYouTubeMetadata(url.trim());
      setMetadata(data);
      setSelectedFormat(data.formats[0]?.format_id ?? '');
      setDownloadError(null);
      setFetchStep('');
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : 'Failed to retrieve YouTube video metadata. Please verify the URL.'
      );
      setFetchStep('');
    } finally {
      setIsFetching(false);
    }
  };

  const formatSize = (bytes: number): string =>
    bytes > 0 ? `${(bytes / (1024 * 1024)).toFixed(0)} MB` : 'size unknown';

  const trackFromMetadata = (m: YouTubeMetadata) => ({
    id: m.id,
    title: m.title,
    artist: m.channel,
    duration: m.duration_seconds,
    coverUrl: m.thumbnail_url,
  });

  const canDownload = Boolean(ytDlpStatus?.available) && Boolean(selectedFormat);

  // Download with yt-dlp first, then load the local file so playback is real and seekable.
  const handleDownloadAndImport = async () => {
    if (!metadata || !canDownload) return;

    setIsDownloading(true);
    setDownloadError(null);
    try {
      const isAudio = selectedFormat === 'audio';
      const localPath = await tauriBridge.downloadYouTubeMedia(
        url.trim(),
        selectedFormat,
        isAudio ? 'audio' : 'video'
      );
      const playable = await tauriBridge.toPlayableUrl(localPath);

      setTrack({
        ...trackFromMetadata(metadata),
        videoUrl: isAudio ? undefined : playable,
        audioUrl: isAudio ? playable : undefined,
        mediaFilePath: localPath,
      });
      if (metadata.thumbnail_url) {
        extractFromCover(metadata.thumbnail_url);
      }
      setActiveTab('studio');
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDownloading(false);
    }
  };

  // Metadata only: no media file, so the studio has nothing to play.
  const handleImportToStudio = () => {
    if (!metadata) return;
    setTrack({ ...trackFromMetadata(metadata), videoUrl: undefined, audioUrl: undefined });
    if (metadata.thumbnail_url) {
      extractFromCover(metadata.thumbnail_url);
    }
    setActiveTab('studio');
  };
  const handleSearchLyricsForThis = () => {
    if (!metadata) return;

    setTrack({
      id: metadata.id,
      title: metadata.title,
      artist: metadata.channel,
      duration: metadata.duration_seconds,
      coverUrl: metadata.thumbnail_url,
    });

    if (metadata.thumbnail_url) {
      extractFromCover(metadata.thumbnail_url);
    }

    setActiveTab('lyrics');
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

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gatefold-bg/30 select-none">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gatefold-text flex items-center gap-2">
            <Video className="w-5 h-5 text-red-500" />
            <span>1-Click YouTube Ingestion & Media Importer</span>
          </h2>
          <p className="text-xs text-gatefold-text-3 mt-1">
            Extract high-resolution video thumbnails, parse stream metadata, and adapt OKLCH palette automatically.
          </p>
        </div>

        {/* Input Card */}
        <div className="gatefold-card-strong p-5 space-y-4">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-semibold text-gatefold-text-2 uppercase tracking-wider font-mono">
              YouTube Video URL
            </label>
            {ytDlpStatus && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  ytDlpStatus.available
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-gatefold-surface text-gatefold-text-3 border-gatefold-line'
                }`}
              >
                {ytDlpStatus.available
                  ? `yt-dlp ${ytDlpStatus.version || 'Active'}`
                  : 'Fast Web API Mode (yt-dlp optional)'}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (validationError) setValidationError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              className={`flex-1 px-3 py-2 text-xs bg-gatefold-surface border rounded-lg text-gatefold-text placeholder:text-gatefold-text-3 focus:outline-none transition-colors ${
                validationError
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gatefold-line focus:border-gatefold-accent'
              }`}
            />
            <button
              onClick={handleFetch}
              disabled={isFetching}
              className="px-4 py-2 bg-gatefold-accent text-gatefold-bg font-semibold text-xs rounded-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
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

        {/* Video Preview Card (When Metadata Loaded) */}
        {metadata && (
          <div className="gatefold-card-strong p-5 space-y-4 border-gatefold-accent/40 bg-gatefold-surface/60">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {/* Thumbnail */}
              <div className="relative w-full sm:w-48 aspect-video rounded-lg overflow-hidden bg-gatefold-surface shrink-0 border border-gatefold-line shadow-lg">
                <img
                  src={metadata.thumbnail_url}
                  alt={metadata.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] text-white">
                  {formatDuration(metadata.duration_seconds)}
                </span>
              </div>

              {/* Info & Metadata */}
              <div className="flex-1 space-y-2 min-w-0">
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-gatefold-accent/20 text-gatefold-accent border border-gatefold-accent/30 inline-block">
                  Video Resolved
                </span>
                <h3 className="text-sm font-semibold text-gatefold-text leading-snug line-clamp-2">
                  {metadata.title}
                </h3>
                <p className="text-xs text-gatefold-text-3 font-medium">
                  {metadata.channel}
                </p>

                <div className="flex items-center gap-3 pt-1 text-[11px] text-gatefold-text-3 font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gatefold-accent" />
                    <span>{formatDuration(metadata.duration_seconds)}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-gatefold-accent" />
                    <span>ID: {metadata.id}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Resolution picker */}
            {metadata.formats.length > 0 && (
              <div className="space-y-1.5 pt-3 border-t border-gatefold-line">
                <label
                  htmlFor="yt-format"
                  className="block text-[11px] font-semibold text-gatefold-text-2 uppercase tracking-wider font-mono"
                >
                  Resolution
                </label>
                <select
                  id="yt-format"
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  disabled={isDownloading}
                  className="w-full px-3 py-2 text-xs bg-gatefold-surface border border-gatefold-line rounded-lg text-gatefold-text focus:outline-none focus:border-gatefold-accent"
                >
                  {metadata.formats.map((f) => (
                    <option key={f.format_id} value={f.format_id}>
                      {f.resolution} - {formatSize(f.filesize_approx)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!ytDlpStatus?.available && (
              <div className="flex items-start gap-1.5 text-xs text-gatefold-text-2 bg-gatefold-surface p-2.5 rounded-lg border border-gatefold-line">
                <AlertCircle className="w-4 h-4 shrink-0 text-gatefold-accent" />
                <span>
                  yt-dlp was not found on PATH. Install yt-dlp (and ffmpeg) to download playable media, or load
                  metadata only.
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
                  onClick={handleDownloadAndImport}
                  className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-[11px] font-medium shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {isDownloading && (
              <div className="p-3 rounded-lg bg-gatefold-surface border border-gatefold-line text-xs space-y-2">
                <div className="flex justify-between font-mono text-gatefold-text-2">
                  <span>Downloading with yt-dlp and merging streams...</span>
                  <span className="text-gatefold-accent">In Progress</span>
                </div>
                <div className="h-1.5 w-full bg-gatefold-surface-2 rounded-full overflow-hidden">
                  <div className="h-full bg-gatefold-accent animate-pulse w-3/4" />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gatefold-line">
              <button
                onClick={handleDownloadAndImport}
                disabled={!canDownload || isDownloading}
                className="flex-1 py-2.5 px-4 bg-gatefold-accent text-gatefold-bg font-semibold text-xs rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDownloading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{isDownloading ? 'Downloading...' : 'Download & Load into Studio'}</span>
              </button>
              <button
                onClick={handleImportToStudio}
                disabled={isDownloading}
                className="py-2.5 px-4 bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-xs font-semibold text-gatefold-text rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                title="Loads title and cover only; nothing will play"
              >
                <CheckCircle2 className="w-4 h-4 text-gatefold-accent" />
                <span>Metadata Only</span>
              </button>
              <button
                onClick={handleSearchLyricsForThis}
                disabled={isDownloading}
                className="py-2.5 px-4 bg-gatefold-surface-2 hover:bg-gatefold-hover border border-gatefold-line text-xs font-semibold text-gatefold-text rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-gatefold-accent" />
                <span>Find Synced Lyrics</span>
              </button>
            </div>
          </div>
        )}

        {/* Offline / Local File Fallback */}
        <div className="gatefold-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileAudio className="w-5 h-5 text-gatefold-accent" />
            <div>
              <h4 className="text-xs font-semibold text-gatefold-text">Working Offline?</h4>
              <p className="text-[11px] text-gatefold-text-3">
                You can load local audio or video files directly without requiring an internet connection.
              </p>
            </div>
          </div>
          <button
            onClick={handleDemoClick}
            className="px-3 py-1.5 rounded-lg bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line text-xs font-medium text-gatefold-text"
          >
            Open Local Demo
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
