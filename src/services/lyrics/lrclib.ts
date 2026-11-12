import type { LyricsCandidate, LyricsSearchParams } from './types';
import { computeSimilarity } from './similarity';
import { tauriBridge } from '../tauriBridge';

interface LrclibResponseItem {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration: number;
  instrumental: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

export async function searchLrclib(params: LyricsSearchParams): Promise<LyricsCandidate[]> {
  try {
    let url = 'https://lrclib.net/api/search?';
    if (params.title && params.artist) {
      url += `track_name=${encodeURIComponent(params.title)}&artist_name=${encodeURIComponent(params.artist)}`;
    } else if (params.query) {
      url += `q=${encodeURIComponent(params.query)}`;
    } else if (params.title) {
      url += `track_name=${encodeURIComponent(params.title)}`;
    } else {
      return [];
    }

    const raw = await tauriBridge.lyricsHttpGet(url, {
      'User-Agent': 'SubStellar Studio (https://github.com/SayMaven/sub-stellar)',
    });

    const items: LrclibResponseItem[] = JSON.parse(raw);
    if (!Array.isArray(items)) return [];

    return items
      .filter((item) => !item.instrumental && (item.syncedLyrics || item.plainLyrics))
      .map((item) => {
        const hasWordSync = Boolean(item.syncedLyrics && /<\d+:\d+(?:\.\d+)?>/.test(item.syncedLyrics));
        const hasLineSync = Boolean(item.syncedLyrics && /^\[\d+:\d+/m.test(item.syncedLyrics));

        const similarity = computeSimilarity(
          params.title || params.query || '',
          params.artist || '',
          item.trackName,
          item.artistName,
          params.duration,
          item.duration
        );

        return {
          id: `lrclib-${item.id}`,
          source: 'lrclib' as const,
          title: item.trackName,
          artist: item.artistName,
          album: item.albumName,
          duration: item.duration,
          similarity,
          isWordSynced: hasWordSync,
          isLineSynced: hasLineSync,
          hasTranslation: false,
          plainLyrics: item.plainLyrics,
          syncedLyrics: item.syncedLyrics,
        };
      });
  } catch {
    return [];
  }
}

