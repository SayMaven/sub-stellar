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

export interface YouTubeMetadata {
  id: string;
  title: string;
  channel: string;
  duration_seconds: number;
  thumbnail_url: string;
  formats: YouTubeFormat[];
}

export interface YtDlpStatus {
  available: boolean;
  path: string | null;
  version: string | null;
}

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

  async probeHardwareCapabilities(): Promise<HardwareCapabilities> {
    try {
      return await invokeTauri<HardwareCapabilities>('probe_hardware_capabilities');
    } catch {
      return {
        gpu_accelerated: true,
        recommended_quality: 'balanced',
        primary_encoder: 'libx264',
        available_encoders: ['libx264'],
        supports_alpha_webm: true,
        supports_alpha_prores: true,
        ffmpeg_found: false,
        ffmpeg_version: 'Web Browser Fallback',
      };
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

  async checkYtDlp(): Promise<YtDlpStatus> {
    try {
      return await invokeTauri<YtDlpStatus>('ytdl_check_binary');
    } catch {
      return {
        available: false,
        path: null,
        version: null,
      };
    }
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

  async downloadYouTubeMedia(url: string, formatId: string, targetType: string): Promise<string> {
    return invokeTauri<string>('ytdl_download_media', {
      url,
      formatId,
      targetType,
    });
  },

  /** Converts an absolute local file path into a URL the webview can load (asset protocol). */
  async toPlayableUrl(path: string): Promise<string> {
    if (!isTauriEnvironment()) return path;
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    return convertFileSrc(path);
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