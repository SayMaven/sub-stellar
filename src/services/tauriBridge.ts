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
  available_encoders: string[];
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
        available_encoders: ['libx264'],
      };
    }
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

  async lyricsHttpGet(url: string, headers?: Record<string, string>): Promise<string> {
    try {
      return await invokeTauri<string>('lyrics_http_get', { url, headers });
    } catch {
      // In browser fallback mode, attempt direct fetch if allowed by CORS
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Fetch failed with status ${res.status}`);
      }
      return await res.text();
    }
  },
};

