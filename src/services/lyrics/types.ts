export type LyricsSourceType = 'lrclib' | 'netease' | 'qq' | 'kugou' | 'manual';

export interface LyricsCandidate {
  id: string;
  source: LyricsSourceType;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  similarity: number; // 0.0 - 1.0 (e.g. 0.95 -> 95%)
  isWordSynced: boolean;
  isLineSynced: boolean;
  hasTranslation: boolean;
  plainLyrics?: string;
  syncedLyrics?: string; // Standard LRC or word-timed YRC
  translationLyrics?: string;
}

export interface LyricsSearchParams {
  query?: string;
  title?: string;
  artist?: string;
  duration?: number;
}

