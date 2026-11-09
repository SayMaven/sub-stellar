/**
 * Title cleaning, normalization and fuzzy matching algorithms for lyric candidate ranking.
 */

export function cleanTitle(str: string): string {
  if (!str) return '';

  return str
    // Remove bracketed suffixes like [Official MV], (feat. Artist), (Cover), [Audio]
    .replace(/\s*[\(\[](?:feat\.?|ft\.?|official|mv|music video|lyric video|audio|cover|remastered|hd|4k)[^\)\]]*[\)\]]/gi, '')
    // Remove trailing "- MV", "- Official Video"
    .replace(/\s*-\s*(?:mv|official\s*video|audio|cover)\b/gi, '')
    // Replace punctuation with spaces
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Computes Sørensen-Dice bigram coefficient between two strings (0.0 to 1.0).
 */
export function diceCoefficient(a: string, b: string): number {
  const s1 = a.trim().toLowerCase();
  const s2 = b.trim().toLowerCase();

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substring(i, i + 2);
    bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substring(i, i + 2);
    const count = bigrams1.get(bigram) || 0;
    if (count > 0) {
      bigrams1.set(bigram, count - 1);
      intersection++;
    }
  }

  return (2.0 * intersection) / (s1.length - 1 + s2.length - 1);
}

/**
 * Computes candidate match similarity considering title, artist and duration tolerance.
 * Returns a score between 0.0 and 1.0 (1.0 = perfect match).
 */
export function computeSimilarity(
  queryTitle: string,
  queryArtist: string,
  targetTitle: string,
  targetArtist: string,
  queryDuration?: number,
  targetDuration?: number
): number {
  const cleanQTitle = cleanTitle(queryTitle);
  const cleanTTitle = cleanTitle(targetTitle);

  // Title similarity (Weight: 60%)
  let titleScore = diceCoefficient(cleanQTitle, cleanTTitle);
  if (cleanQTitle && cleanTTitle && (cleanQTitle.includes(cleanTTitle) || cleanTTitle.includes(cleanQTitle))) {
    titleScore = Math.max(titleScore, 0.85);
  }

  // Artist similarity (Weight: 25%)
  const cleanQArtist = cleanTitle(queryArtist);
  const cleanTArtist = cleanTitle(targetArtist);
  let artistScore = 0.5; // neutral default if query artist is empty

  if (cleanQArtist && cleanTArtist) {
    artistScore = diceCoefficient(cleanQArtist, cleanTArtist);
    if (cleanQArtist.includes(cleanTArtist) || cleanTArtist.includes(cleanQArtist)) {
      artistScore = Math.max(artistScore, 0.85);
    }
  }

  // Duration proximity (Weight: 15%)
  let durationScore = 0.5; // neutral if duration unknown
  if (queryDuration && queryDuration > 0 && targetDuration && targetDuration > 0) {
    const diff = Math.abs(queryDuration - targetDuration);
    if (diff <= 2) {
      durationScore = 1.0;
    } else if (diff <= 4) {
      durationScore = 0.9;
    } else if (diff <= 10) {
      durationScore = 0.6;
    } else if (diff <= 25) {
      durationScore = 0.3;
    } else {
      durationScore = 0.0;
    }
  }

  const combined = titleScore * 0.6 + artistScore * 0.25 + durationScore * 0.15;
  return Math.min(1.0, Math.max(0.0, Math.round(combined * 100) / 100));
}

