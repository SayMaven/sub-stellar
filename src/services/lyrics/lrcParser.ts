import type { SubtitleLine, RubyToken } from '../../types';
import { tokenizeSubtitleText } from '../../engine/text/RubyLayout';

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
 * Parses SRT timestamp "HH:MM:SS,mmm" or "HH:MM:SS.mmm" or "MM:SS,mmm" into seconds.
 */
export function parseSrtTimestamp(timeStr: string): number | null {
  const cleaned = timeStr.trim().replace(',', '.');
  const hms = cleaned.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (hms) {
    return (
      parseInt(hms[1], 10) * 3600 +
      parseInt(hms[2], 10) * 60 +
      parseFloat(hms[3])
    );
  }
  const ms = cleaned.match(/^(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (ms) {
    return parseInt(ms[1], 10) * 60 + parseFloat(ms[2]);
  }
  return null;
}

/**
 * Checks if raw text is SubRip (.srt) or WebVTT format.
 */
export function isSrtFormat(raw: string): boolean {
  return /\d{1,2}:\d{2}(?::\d{2})?[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?[,.]\d{1,3}/.test(
    raw
  );
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Parses SubRip (.srt) or WebVTT subtitle text into SubtitleLine[] with per-word tokens.
 * Supports optional secondary translation SRT/VTT track matched by overlapping cue time.
 */
export function parseSrt(raw: string, translationRaw?: string): SubtitleLine[] {
  const cleanRaw = raw.replace(/^\uFEFF/, '').trim();
  if (!cleanRaw) return [];

  const blocks = cleanRaw.split(/\r?\n\s*\r?\n/);
  const result: SubtitleLine[] = [];

  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    // Skip WEBVTT header / STYLE / NOTE blocks
    if (/^(WEBVTT|STYLE|NOTE)\b/i.test(lines[0]) && !lines.some((l) => l.includes('-->'))) {
      continue;
    }

    // Find the line containing "-->"
    const arrowIdx = lines.findIndex((l) => l.includes('-->'));
    if (arrowIdx === -1) continue;

    const timingLine = lines[arrowIdx];
    const parts = timingLine.split('-->');
    if (parts.length < 2) continue;

    const rawStart = parseSrtTimestamp(parts[0]);
    // Strip optional cue settings after end timestamp
    const rawEnd = parseSrtTimestamp(parts[1].trim().split(/\s+/)[0]);
    if (rawStart === null || rawEnd === null) continue;

    const startTime = Math.round(rawStart * 100) / 100;
    const endTime = Math.round(Math.max(startTime + 0.3, rawEnd) * 100) / 100;

    // Strip HTML/ASS formatting tags like <i>, </i>, {\an8} and decode HTML entities
    const contentLines = lines
      .slice(arrowIdx + 1)
      .map((l) =>
        decodeHtmlEntities(l.replace(/<[^>]+>/g, '').replace(/\{\\[^}]+\}/g, '')).trim()
      )
      .filter(Boolean);

    if (contentLines.length === 0) continue;

    // Inspect multi-line cues: check if line 0 is bracketed Romaji/pronunciation like "[Atashi wa...]"
    // and line 1 is the actual translated lyrics text.
    const bracketedLineRegex = /^[(\[（【]([^)\]）】]+)[)\]）】]$/;
    let primaryText = contentLines[0];
    let inlineTranslation: string | undefined =
      contentLines.length > 1 ? contentLines.slice(1).join(' ') : undefined;

    if (contentLines.length >= 2) {
      const matchBracket0 = contentLines[0].match(bracketedLineRegex);
      const isBracket1 = bracketedLineRegex.test(contentLines[1]);

      if (matchBracket0 && !isBracket1) {
        // Line 0 is Romaji/phonetic reading in brackets; Line 1 is the actual meaning/translation
        // Prioritize the actual translated text for primaryText and keep cleaned Romaji in translation
        primaryText = contentLines[1];
        inlineTranslation = matchBracket0[1].trim();
      }
    } else if (contentLines.length === 1) {
      // If single line has brackets wrapping the entire line: e.g. "[Atashi wa...]"
      const singleBracket = contentLines[0].match(bracketedLineRegex);
      if (singleBracket && !singleBracket[1].includes('|')) {
        primaryText = singleBracket[1].trim();
      }
    }

    // Deduplicate consecutive identical cues with overlapping or adjacent timestamps
    const prev = result[result.length - 1];
    if (prev && prev.text === primaryText && Math.abs(startTime - prev.endTime) <= 0.15) {
      prev.endTime = Math.max(prev.endTime, endTime);
      continue;
    }

    const parsedTokens = tokenizeSubtitleText(primaryText);
    const span = Math.max(0.1, endTime - startTime);
    const step = span / Math.max(1, parsedTokens.length);

    const tokens: RubyToken[] = parsedTokens.map((pt, idx) => ({
      text: pt.base,
      ruby: pt.ruby,
      startTime: Math.round((startTime + idx * step) * 100) / 100,
      endTime:
        idx === parsedTokens.length - 1
          ? endTime
          : Math.round((startTime + (idx + 1) * step) * 100) / 100,
    }));

    result.push({
      id: `line-${result.length + 1}`,
      startTime,
      endTime,
      text: primaryText,
      tokens,
      translation: inlineTranslation,
    });
  }

  // Merge secondary translation SRT/VTT if provided
  if (translationRaw && translationRaw.trim() && isSrtFormat(translationRaw)) {
    const transCues = parseSrt(translationRaw);
    for (const line of result) {
      const mid = (line.startTime + line.endTime) / 2;
      const matched =
        transCues.find((tc) => mid >= tc.startTime - 0.4 && mid <= tc.endTime + 0.4) ||
        transCues.find((tc) => Math.abs(tc.startTime - line.startTime) <= 0.9);
      if (matched && matched.text.trim()) {
        line.translation = matched.text.trim();
      }
    }
  }

  return result;
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
 * Parses standard LRC, word-synced Enhanced LRC, YRC, or SRT into SubtitleLine[].
 */
export function parseLrc(raw: string, translationRaw?: string): SubtitleLine[] {
  if (isYrcFormat(raw)) {
    return parseYrc(raw);
  }
  if (isSrtFormat(raw)) {
    return parseSrt(raw, translationRaw);
  }

  const rawLines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
  const parsedItems: { time: number; text: string; rawLine: string }[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip metadata tags like [ar:Artist], [ti:Title], [al:Album]
    if (/^\[[a-zA-Z]+:/.test(trimmed)) continue;

    // Match one or more leading timestamps: [00:12.34][01:20.00]Lyric
    const timestampRegex = /\[(\d+:\d+(?:\.\d+)?)\]/g;
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIdx = 0;

    while ((match = timestampRegex.exec(trimmed)) !== null) {
      const t = parseLrcTimestamp(match[1]);
      if (t !== null) {
        timestamps.push(t);
      }
      lastIdx = timestampRegex.lastIndex;
    }

    if (timestamps.length > 0) {
      const textContent = trimmed.slice(lastIdx).trim();
      for (const time of timestamps) {
        parsedItems.push({
          time,
          text: textContent,
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

    // Skip empty instrumental break tags unless they have text
    if (!item.text.trim()) continue;

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
      // Make contiguous end times for word-synced LRC
      for (let k = 0; k < tokens.length; k++) {
        if (k < tokens.length - 1) {
          tokens[k].endTime = Math.max(tokens[k].startTime + 0.05, tokens[k + 1].startTime);
        } else {
          tokens[k].endTime = Math.max(tokens[k].startTime + 0.1, endTime);
        }
      }
    }

    // Clean text by stripping word tags: <00:12.34>
    const cleanLineText = item.text.replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim();

    // If no word sync tags found, generate even token intervals from Ruby tokens / CJK / words
    if (tokens.length === 0) {
      const rubyTokens = tokenizeSubtitleText(cleanLineText);
      const tokenDur = lineDuration / Math.max(1, rubyTokens.length);

      rubyTokens.forEach((rt, idx) => {
        const tStart = Math.round((startTime + idx * tokenDur) * 100) / 100;
        const tEnd =
          idx === rubyTokens.length - 1
            ? endTime
            : Math.round((startTime + (idx + 1) * tokenDur) * 100) / 100;
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
      id: `line-${result.length + 1}`,
      startTime,
      endTime,
      text: cleanLineText,
      tokens,
      translation,
    });
  }

  // Fallback for plain untimed lyrics (1 line per 3.5 seconds)
  if (result.length === 0) {
    const plainLines = raw
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^\[[a-zA-Z]+:/.test(l));

    plainLines.forEach((lineText, idx) => {
      const startTime = Math.round(idx * 3.5 * 100) / 100;
      const endTime = Math.round((startTime + 3.2) * 100) / 100;
      const rubyTokens = tokenizeSubtitleText(lineText);
      const step = (endTime - startTime) / Math.max(1, rubyTokens.length);
      result.push({
        id: `line-${idx + 1}`,
        startTime,
        endTime,
        text: lineText,
        tokens: rubyTokens.map((rt, tIdx) => ({
          text: rt.base,
          ruby: rt.ruby,
          startTime: Math.round((startTime + tIdx * step) * 100) / 100,
          endTime:
            tIdx === rubyTokens.length - 1
              ? endTime
              : Math.round((startTime + (tIdx + 1) * step) * 100) / 100,
        })),
      });
    });
  }

  return result;
}

