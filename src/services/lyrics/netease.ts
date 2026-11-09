import type { LyricsCandidate, LyricsSearchParams } from './types';
import { computeSimilarity } from './similarity';
import { tauriBridge } from '../tauriBridge';

interface NetEaseSong {
  id: number;
  name: string;
  artists?: { name: string }[];
  duration?: number; // ms
  album?: { name: string };
}

interface NetEaseSearchResponse {
  result?: {
    songs?: NetEaseSong[];
  };
}

interface NetEaseLyricResponse {
  lrc?: { lyric?: string };
  tlyric?: { lyric?: string };
  klyric?: { lyric?: string };
  yrc?: { lyric?: string };
}

export async function searchNetEase(params: LyricsSearchParams): Promise<LyricsCandidate[]> {
  try {
    const keyword = params.title || params.query || '';
    if (!keyword) return [];

    const searchQuery = params.artist ? `${keyword} ${params.artist}` : keyword;
    const searchUrl = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(searchQuery)}&type=1&offset=0&limit=5`;

    const searchRaw = await tauriBridge.lyricsHttpGet(searchUrl, {
      Referer: 'https://music.163.com/',
      Cookie: 'appver=2.0.2',
    });

    const searchData: NetEaseSearchResponse = JSON.parse(searchRaw);
    const songs = searchData.result?.songs;
    if (!songs || !Array.isArray(songs) || songs.length === 0) {
      return [];
    }

    // Fetch lyrics for the top candidates
    const candidates: LyricsCandidate[] = [];

    for (const song of songs.slice(0, 3)) {
      try {
        const lyricUrl = `https://music.163.com/api/song/lyric?id=${song.id}&lv=1&kv=1&tv=-1&rv=1&yv=1`;
        const lyricRaw = await tauriBridge.lyricsHttpGet(lyricUrl, {
          Referer: 'https://music.163.com/',
        });

        const lyricData: NetEaseLyricResponse = JSON.parse(lyricRaw);
        const yrc = lyricData.yrc?.lyric;
        const lrc = lyricData.lrc?.lyric;
        const tlyric = lyricData.tlyric?.lyric;

        if (!yrc && !lrc) continue;

        const artistName = song.artists?.map((a) => a.name).join(', ') || 'Unknown Artist';
        const durationSec = song.duration ? Math.round(song.duration / 1000) : 0;

        const similarity = computeSimilarity(
          params.title || params.query || '',
          params.artist || '',
          song.name,
          artistName,
          params.duration,
          durationSec
        );

        candidates.push({
          id: `netease-${song.id}`,
          source: 'netease',
          title: song.name,
          artist: artistName,
          album: song.album?.name,
          duration: durationSec,
          similarity,
          isWordSynced: Boolean(yrc && yrc.length > 0),
          isLineSynced: Boolean(lrc || yrc),
          hasTranslation: Boolean(tlyric && tlyric.length > 0),
          syncedLyrics: yrc || lrc,
          translationLyrics: tlyric,
        });
      } catch {
        // Individual lyric fetch failed; continue with other candidates
      }
    }

    return candidates;
  } catch {
    return [];
  }
}

