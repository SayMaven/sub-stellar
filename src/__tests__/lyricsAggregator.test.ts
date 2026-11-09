import { describe, it, expect, vi } from 'vitest';
import { aggregateLyricsSearch } from '../services/lyrics/lyricsAggregator';
import * as lrclibModule from '../services/lyrics/lrclib';
import * as neteaseModule from '../services/lyrics/netease';
import type { LyricsCandidate } from '../services/lyrics/types';

describe('Lyrics Aggregator', () => {
  it('combines, deduplicates and ranks results from multiple providers', async () => {
    const mockLrcLibCandidate: LyricsCandidate = {
      id: 'lrclib-1',
      source: 'lrclib',
      title: 'Idol',
      artist: 'YOASOBI',
      duration: 210,
      similarity: 0.88,
      isWordSynced: false,
      isLineSynced: true,
      hasTranslation: false,
      syncedLyrics: '[00:10.00] Idol',
    };

    const mockNetEaseCandidate: LyricsCandidate = {
      id: 'netease-2',
      source: 'netease',
      title: 'Idol',
      artist: 'YOASOBI',
      duration: 210,
      similarity: 0.95,
      isWordSynced: true,
      isLineSynced: true,
      hasTranslation: true,
      syncedLyrics: '[10000,3000](10000,1000,0)Idol',
    };

    vi.spyOn(lrclibModule, 'searchLrclib').mockResolvedValue([mockLrcLibCandidate]);
    vi.spyOn(neteaseModule, 'searchNetEase').mockResolvedValue([mockNetEaseCandidate]);

    const results = await aggregateLyricsSearch({ title: 'Idol', artist: 'YOASOBI' });

    expect(results.length).toBeGreaterThanOrEqual(1);
    // NetEase candidate has higher similarity and word-sync bonus, so should rank first
    expect(results[0].source).toBe('netease');
    expect(results[0].isWordSynced).toBe(true);
  });

  it('handles provider failures gracefully and returns available candidates', async () => {
    vi.spyOn(lrclibModule, 'searchLrclib').mockRejectedValue(new Error('Network error'));
    vi.spyOn(neteaseModule, 'searchNetEase').mockResolvedValue([
      {
        id: 'netease-fallback',
        source: 'netease',
        title: 'Shunkan Heartbeat',
        artist: 'AZKi',
        duration: 205,
        similarity: 0.92,
        isWordSynced: false,
        isLineSynced: true,
        hasTranslation: false,
      },
    ]);

    const results = await aggregateLyricsSearch({ title: 'Shunkan Heartbeat' });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Shunkan Heartbeat');
  });
});

