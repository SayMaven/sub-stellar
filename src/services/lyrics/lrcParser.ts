import type { SubtitleLine, RubyToken } from '../../types';
import { parseMarkdownRuby } from '../../engine/text/RubyLayout';

/**
 * Parses timestamp string "[mm:ss.xx]" or "<mm:ss.xx>" into seconds (float).
 */
export function parseLrcTimestamp(timeStr: string): number | null {
  const match = timeStr.match(/(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const minutes = parseInt(match[1], 10);
  const seconds = parseFloat(match[2]);
  return minutes * 60 + seconds;
}

/**
 * Checks if raw text is NetEase YRC format.
 */
export function isYrcFormat(raw: string): boolean {
  return /\[\d+,\d+\]\(\d+,\d+,\d+\)/.test(raw);
}

/**
 * Parses NetEase YRC format into SubtitleLine[].
 * Example line: [12340,4500](12340,800,0)word1(13140,500,0)word2
 */
export function parseYrc(raw: string): SubtitleLine[] {
  const lines = raw.split(/\r?\n/);
  const result: SubtitleLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const lineMatch = line.match(/^\[(\d+),(\d+)\](.*)$/);
    if (!lineMatch) continue;

    const lineStartSec = parseInt(lineMatch[1], 10) / 1000;
    const lineDurationSec = parseInt(lineMatch[2], 10) / 1000;
    const lineEndSec = lineStartSec + lineDurationSec;
    const tokensContent = lineMatch[3];

    const tokenRegex = /\((\d+),(\d+),\d+\)([^(]+)/g;
    const tokens: RubyToken[] = [];
    let fullText = '';

    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(tokensContent)) !== null) {
      const tokenStart = parseInt(match[1], 10) / 1000;
      const tokenDur = parseInt(match[2], 10) / 1000;
      const tokenText = match[3];

      fullText += tokenText;
      tokens.push({
        text: tokenText,
        startTime: tokenStart,
        endTime: tokenStart + tokenDur,
      });
    }

    if (fullText.trim()) {
      result.push({
        id: `line-${i + 1}`,
        startTime: Math.round(lineStartSec * 100) / 100,
        endTime: Math.round(lineEndSec * 100) / 100,
        text: fullText.trim(),
        tokens: tokens.length > 0 ? tokens : [
          {
            text: fullText.trim(),
            startTime: lineStartSec,
            endTime: lineEndSec,
          },
        ],
      });
    }
  }

  return result;
}

/**
 * Parses standard LRC or word-synced Enhanced LRC into SubtitleLine[].
 */
export function parseLrc(raw: string, translationRaw?: string): SubtitleLine[] {
  if (isYrcFormat(raw)) {
    return parseYrc(raw);
  }

  const rawLines = raw.split(/\r?\n/);
  const parsedItems: { time: number; text: string; rawLine: string }[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip metadata tags like [ar:Artist], [ti:Title], [al:Album]
    if (/^\[[a-zA-Z]+:/.test(trimmed)) continue;

    // Match leading timestamp: [00:12.34]
    const match = trimmed.match(/^\[(\d+:\d+(?:\.\d+)?)\](.*)$/);
    if (match) {
      const time = parseLrcTimestamp(match[1]);
      if (time !== null) {
        parsedItems.push({
          time,
          text: match[2].trim(),
          rawLine: trimmed,
        });
      }
    }
  }

  // Sort by start time
  parsedItems.sort((a, b) => a.time - b.time);

  // Parse translation lines if provided
  const translationsMap = new Map<number, string>();
  if (translationRaw) {
    const transLines = translationRaw.split(/\r?\n/);
    for (const tline of transLines) {
      const match = tline.match(/^\[(\d+:\d+(?:\.\d+)?)\](.*)$/);
      if (match) {
        const time = parseLrcTimestamp(match[1]);
        if (time !== null && match[2].trim()) {
          // Store rounded to nearest 0.5s for loose sync
          translationsMap.set(Math.round(time * 2) / 2, match[2].trim());
        }
      }
    }
  }

  const result: SubtitleLine[] = [];

  for (let i = 0; i < parsedItems.length; i++) {
    const item = parsedItems[i];
    const nextItem = parsedItems[i + 1];

    const startTime = Math.round(item.time * 100) / 100;
    // Default duration: up to next line start, or 4.5s max
    let endTime = nextItem ? Math.min(startTime + 6.0, nextItem.time) : startTime + 4.5;
    if (endTime <= startTime) endTime = startTime + 3.0;
    endTime = Math.round(endTime * 100) / 100;

    const lineDuration = Math.max(0.5, endTime - startTime);

    // Check for word-level sync: <00:12.34>word1 <00:13.10>word2
    const wordSyncMatch = item.text.match(/<(\d+:\d+(?:\.\d+)?)>([^<]+)/g);
    const tokens: RubyToken[] = [];

    if (wordSyncMatch && wordSyncMatch.length > 0) {
      for (const w of wordSyncMatch) {
        const wParts = w.match(/<(\d+:\d+(?:\.\d+)?)>(.*)/);
        if (wParts) {
          const wTime = parseLrcTimestamp(wParts[1]);
          const wText = wParts[2].trim();
          if (wTime !== null && wText) {
            tokens.push({
              text: wText,
              startTime: Math.round(wTime * 100) / 100,
              endTime: Math.round((wTime + 0.6) * 100) / 100,
            });
          }
        }
      }
    }

    // Clean text by stripping word tags: <00:12.34>
    const cleanLineText = item.text.replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim();

    // If no word sync tags found, generate even token intervals from Ruby tokens or words
    if (tokens.length === 0) {
      const rubyTokens = parseMarkdownRuby(cleanLineText);
      const tokenDur = lineDuration / Math.max(1, rubyTokens.length);

      rubyTokens.forEach((rt, idx) => {
        const tStart = Math.round((startTime + idx * tokenDur) * 100) / 100;
        const tEnd = Math.round((tStart + tokenDur) * 100) / 100;
        tokens.push({
          text: rt.base,
          ruby: rt.ruby,
          startTime: tStart,
          endTime: tEnd,
        });
      });
    }

    // Check for matching translation
    const roundedKey = Math.round(startTime * 2) / 2;
    const translation = translationsMap.get(roundedKey);

    result.push({
      id: `line-${i + 1}`,
      startTime,
      endTime,
      text: cleanLineText,
      tokens,
      translation,
    });
  }

  return result;
}

