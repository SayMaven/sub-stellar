import { describe, it, expect } from 'vitest';
import { cleanTitle, diceCoefficient, computeSimilarity } from '../services/lyrics/similarity';

describe('Similarity & Title Normalization Algorithms', () => {
  it('cleanTitle strips noise suffixes and metadata brackets', () => {
    expect(cleanTitle('Kick Back [Official Music Video]')).toBe('kick back');
    expect(cleanTitle('Idol (feat. Hatsune Miku)')).toBe('idol');
    expect(cleanTitle('Otonablue - MV')).toBe('otonablue');
    expect(cleanTitle('Racing Into The Night (Cover) [HD]')).toBe('racing into the night');
  });

  it('diceCoefficient returns 1.0 for identical strings and ~0 for disjoint strings', () => {
    expect(diceCoefficient('hello world', 'hello world')).toBe(1.0);
    expect(diceCoefficient('abcd', 'wxyz')).toBe(0.0);
    expect(diceCoefficient('shinjuku', 'shinjuku station')).toBeGreaterThan(0.6);
  });

  it('computeSimilarity matches exact song and gives high score', () => {
    const score = computeSimilarity(
      'Shunkan Heartbeat',
      'AZKi',
      'Shunkan Heartbeat [MV]',
      'AZKi',
      210,
      211
    );
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it('computeSimilarity applies duration tolerance penalty for large mismatches', () => {
    const matchingDuration = computeSimilarity('Song A', 'Artist', 'Song A', 'Artist', 180, 182);
    const mismatchDuration = computeSimilarity('Song A', 'Artist', 'Song A', 'Artist', 180, 360);

    expect(matchingDuration).toBeGreaterThan(mismatchDuration);
  });
});

