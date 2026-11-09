import type { LyricsCandidate, LyricsSearchParams } from './types';
import { searchLrclib } from './lrclib';
import { searchNetEase } from './netease';

export async function aggregateLyricsSearch(params: LyricsSearchParams): Promise<LyricsCandidate[]> {
  const [lrclibResult, neteaseResult] = await Promise.allSettled([
    searchLrclib(params),
    searchNetEase(params),
  ]);

  const candidates: LyricsCandidate[] = [];

  if (lrclibResult.status === 'fulfilled') {
    candidates.push(...lrclibResult.value);
  }

  if (neteaseResult.status === 'fulfilled') {
    candidates.push(...neteaseResult.value);
  }

  // Deduplicate by clean title and artist if both came from different sources
  const seen = new Set<string>();
  const uniqueCandidates: LyricsCandidate[] = [];

  for (const c of candidates) {
    const key = `${c.title.toLowerCase().trim()}|${c.artist.toLowerCase().trim()}|${c.source}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCandidates.push(c);
    }
  }

  // Sort descending: highest similarity score first, with word-synced bonus
  uniqueCandidates.sort((a, b) => {
    const scoreA = a.similarity + (a.isWordSynced ? 0.05 : 0);
    const scoreB = b.similarity + (b.isWordSynced ? 0.05 : 0);
    return scoreB - scoreA;
  });

  return uniqueCandidates;
}

