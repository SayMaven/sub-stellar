/**
 * Native Tauri IPC Bridge with graceful browser fallback.
 */

export interface SystemInfo {
  app_version: string;
  os_name: string;
  arch: string;
}

export interface HardwareCapabilities {
  gpu_accelerated: boolean;
  recommended_quality: string;
  primary_encoder: string;
  available_encoders: string[];
  supports_alpha_webm: boolean;
  supports_alpha_prores: boolean;
  ffmpeg_found: boolean;
  ffmpeg_version: string;
}

export interface FFmpegInfo {
  found: boolean;
  version: string;
  path: string;
}

export interface ExportPipeConfig {
  session_id: string;
  output_path: string;
  mode: 'mp4_burnin' | 'webm_alpha' | 'prores_alpha';
  encoder?: string;
  width: number;
  height: number;
  fps: number;
  total_frames: number;
  audio_source_path?: string;
  audio_bitrate?: string;
}

export interface ExportProgress {
  session_id: string;
  frames_written: number;
  total_frames: number;
  percentage: number;
  fps: number;
}

export interface ExportResult {
  success: boolean;
  output_path: string;
  file_size_bytes: number;
  elapsed_seconds: number;
  error_message?: string;
}

export interface YouTubeFormat {
  format_id: string;
  resolution: string;
  filesize_approx: number;
}

export interface YouTubeSubtitleTrack {
  lang: string;
  name: string;
}

export interface YouTubeMetadata {
  id: string;
  title: string;
  channel: string;
  duration_seconds: number;
  thumbnail_url: string;
  formats: YouTubeFormat[];
  subtitles?: YouTubeSubtitleTrack[];
}

export interface YtDlpStatus {
  available: boolean;
  path: string | null;
  version: string | null;
}

export interface CachedMediaItem {
  file_name: string;
  file_path: string;
  video_id: string;
  title: string;
  channel: string;
  thumbnail_url: string;
  duration_seconds: number;
  format_id: string;
  format_label: string;
  size_bytes: number;
  is_audio: boolean;
}

export interface OpenedProjectFile {
  path: string;
  contents: string;
}

let cachedYtDlpStatus: YtDlpStatus | null = null;
let cachedHardwareCaps: HardwareCapabilities | null = null;

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  }
  throw new Error(`Tauri IPC is not available in browser mode for command: ${cmd}`);
}

export const tauriBridge = {
  isAvailable: isTauriEnvironment,

  async getSystemInfo(): Promise<SystemInfo> {
    try {
      return await invokeTauri<SystemInfo>('get_system_info');
    } catch {
      return {
        app_version: '1.0.0-alpha.3',
        os_name: typeof navigator !== 'undefined' ? navigator.platform : 'browser',
        arch: 'x64',
      };
    }
  },

  getCachedHardwareCapabilities(): HardwareCapabilities | null {
    return cachedHardwareCaps;
  },

  async probeHardwareCapabilities(forceRefresh = false): Promise<HardwareCapabilities> {
    if (!forceRefresh && cachedHardwareCaps) {
      return cachedHardwareCaps;
    }
    try {
      const caps = await invokeTauri<HardwareCapabilities>('probe_hardware_capabilities');
      cachedHardwareCaps = caps;
      return caps;
    } catch {
      const fallback: HardwareCapabilities = {
        gpu_accelerated: true,
        recommended_quality: 'balanced',
        primary_encoder: 'libx264',
        available_encoders: ['libx264'],
        supports_alpha_webm: true,
        supports_alpha_prores: true,
        ffmpeg_found: false,
        ffmpeg_version: 'Web Browser Fallback',
      };
      cachedHardwareCaps = fallback;
      return fallback;
    }
  },

  async ffmpegCheckBinary(): Promise<FFmpegInfo> {
    try {
      return await invokeTauri<FFmpegInfo>('ffmpeg_check_binary');
    } catch {
      return {
        found: false,
        version: '',
        path: '',
      };
    }
  },

  async ffmpegStartExportPipe(config: ExportPipeConfig): Promise<string> {
    return invokeTauri<string>('ffmpeg_start_export_pipe', { config });
  },

  async ffmpegWriteFrameChunk(sessionId: string, chunk: Uint8Array): Promise<ExportProgress> {
    return invokeTauri<ExportProgress>('ffmpeg_write_frame_chunk', {
      sessionId,
      chunk: Array.from(chunk),
    });
  },

  async ffmpegFinishExport(sessionId: string): Promise<ExportResult> {
    return invokeTauri<ExportResult>('ffmpeg_finish_export', { sessionId });
  },

  async ffmpegCancelExport(sessionId: string): Promise<void> {
    try {
      await invokeTauri<void>('ffmpeg_cancel_export', { sessionId });
    } catch {
      // Graceful fallback for non-Tauri / test environments
    }
  },

  async ffmpegExportAssBurnin(
    videoInput: string,
    assPath: string,
    outputPath: string,
    encoder?: string
  ): Promise<ExportResult> {
    return invokeTauri<ExportResult>('ffmpeg_export_ass_burnin', {
      videoInput,
      assPath,
      outputPath,
      encoder,
    });
  },

  getCachedYtDlpStatus(): YtDlpStatus | null {
    return cachedYtDlpStatus;
  },

  async checkYtDlp(forceRefresh = false): Promise<YtDlpStatus> {
    if (!forceRefresh && cachedYtDlpStatus) {
      return cachedYtDlpStatus;
    }
    try {
      const status = await invokeTauri<YtDlpStatus>('ytdl_check_binary', {
        forceRefresh,
      });
      cachedYtDlpStatus = status;
      return status;
    } catch {
      const fallback: YtDlpStatus = {
        available: false,
        path: null,
        version: null,
      };
      cachedYtDlpStatus = fallback;
      return fallback;
    }
  },

  async listCachedYouTubeMedia(): Promise<CachedMediaItem[]> {
    if (!isTauriEnvironment()) return [];
    try {
      return await invokeTauri<CachedMediaItem[]>('ytdl_list_cached_media');
    } catch {
      return [];
    }
  },

  async deleteCachedYouTubeMedia(fileName: string): Promise<void> {
    if (!isTauriEnvironment()) return;
    await invokeTauri<void>('ytdl_delete_cached_media', { fileName });
  },

  async getYouTubeMetadata(url: string): Promise<YouTubeMetadata> {
    try {
      return await invokeTauri<YouTubeMetadata>('ytdl_get_info', { url });
    } catch (err) {
      // In web browser fallback mode, extract ID and return structured metadata
      const match = url.match(/(?:watch\?v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
      const id = match ? match[1] : 'dQw4w9WgXcQ';
      return {
        id,
        title: `YouTube Video (${id})`,
        channel: 'YouTube Creator',
        duration_seconds: 215,
        thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        formats: [
          {
            format_id: 'stream',
            resolution: 'Online Stream',
            filesize_approx: 0,
          },
        ],
      };
    }
  },

  async downloadYouTubeMedia(
    url: string,
    formatId: string,
    targetType: string,
    meta?: { title?: string; channel?: string; durationSeconds?: number }
  ): Promise<string> {
    return invokeTauri<string>('ytdl_download_media', {
      url,
      formatId,
      targetType,
      title: meta?.title,
      channel: meta?.channel,
      durationSeconds: meta?.durationSeconds,
    });
  },

  async downloadYouTubeSubtitle(url: string, lang: string): Promise<string> {
    return invokeTauri<string>('ytdl_download_subtitle', {
      url,
      lang,
    });
  },

  /** Converts an absolute local file path into a URL the webview can load (asset protocol). */
  async toPlayableUrl(path: string): Promise<string> {
    if (!isTauriEnvironment()) return path;
    let normalizedPath = path;
    try {
      normalizedPath = await invokeTauri<string>('allow_asset_file', { path });
    } catch {
      // Continue with original path if allow_asset_file fails
    }
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    return convertFileSrc(normalizedPath);
  },

  /** Fallback that reads a local media file directly as raw bytes via IPC and returns a Blob URL. */
  async readMediaBlobUrl(path: string): Promise<string> {
    const buffer = await invokeTauri<ArrayBuffer | Uint8Array>('read_local_media_bytes', {
      path,
    });
    const lower = path.toLowerCase();
    const mime = lower.endsWith('.webm')
      ? 'video/webm'
      : lower.endsWith('.mov')
      ? 'video/quicktime'
      : lower.endsWith('.mkv')
      ? 'video/x-matroska'
      : lower.endsWith('.mp3')
      ? 'audio/mpeg'
      : lower.endsWith('.wav')
      ? 'audio/wav'
      : lower.endsWith('.flac')
      ? 'audio/flac'
      : lower.endsWith('.ogg')
      ? 'audio/ogg'
      : lower.endsWith('.m4a')
      ? 'audio/mp4'
      : 'video/mp4';
    const blob = new Blob([buffer as BlobPart], { type: mime });
    return URL.createObjectURL(blob);
  },

  async saveProjectDialog(defaultName: string): Promise<string | null> {
    if (isTauriEnvironment()) {
      return invokeTauri<string | null>('project_save_dialog', { defaultName });
    }
    return null;
  },

  async writeProjectFile(path: string, contents: string): Promise<string> {
    return invokeTauri<string>('project_write_file', { path, contents });
  },

  async openProjectDialog(): Promise<OpenedProjectFile | null> {
    if (isTauriEnvironment()) {
      return invokeTauri<OpenedProjectFile | null>('project_open_dialog');
    }
    return null;
  },

  async openMediaDialog(): Promise<string | null> {
    if (isTauriEnvironment()) {
      return invokeTauri<string | null>('media_open_dialog');
    }
    return null;
  },

  async exportSaveDialog(defaultName: string, ext: string): Promise<string | null> {
    if (isTauriEnvironment()) {
      return invokeTauri<string | null>('export_save_dialog', { defaultName, ext });
    }
    return null;
  },

  async revealInExplorer(path: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invokeTauri<void>('reveal_in_explorer', { path });
    }
  },

  async lyricsHttpGet(url: string, headers?: Record<string, string>): Promise<string> {
    if (isTauriEnvironment()) {
      // Inside the desktop app every request MUST go through the Rust allowlist proxy.
      // Never fall back to a direct fetch here: it would bypass the domain allowlist.
      return invokeTauri<string>('lyrics_http_get', { url, headers });
    }
    // Browser dev mode only: attempt direct fetch if allowed by CORS
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Fetch failed with status ${res.status}`);
    }
    return await res.text();
  },
};

// Eagerly probe hardware capabilities in background so ExportDrawer has NVENC/encoders cached immediately without delay or UI flicker
if (typeof window !== 'undefined') {
  setTimeout(() => {
    tauriBridge.probeHardwareCapabilities().catch(() => {});
  }, 50);
}
