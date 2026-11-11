/**
 * Furigana alignment engine (pure, dependency-free besides RubyLayout's markdown parser).
 *
 * The single source of truth is a list of {@link FuriganaSegment}s. From it we derive:
 *  - the markdown `{Kanji|Ruby}` text stored on a subtitle line,
 *  - the plain text (no braces) shown in the text field,
 *  - the hiragana "Reading" string shown in the reading field.
 */
import { parseMarkdownRuby } from './RubyLayout';

export interface FuriganaSegment {
  /** Surface text of this segment, e.g. "星空", "の", "歌". */
  base: string;
  /** Reading in hiragana. Only meaningful for kanji segments. */
  ruby?: string;
  /** Kanji segments produced from the same kanji run share the same runId. */
  runId: number;
}

export interface AlignError {
  /** Code-point index in the plain text where the reading stopped matching. */
  index: number;
  expected: string;
  message: string;
}

export type AlignResult =
  | { ok: true; segments: FuriganaSegment[] }
  | { ok: false; error: AlignError };

const KANJI_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々〆]/;
const SKIPPABLE_REGEX = /[\s\p{P}\p{S}]/u;

export function isKanjiChar(ch: string): boolean {
  return KANJI_REGEX.test(ch);
}

export function containsKanji(text: string): boolean {
  return KANJI_REGEX.test(text);
}

function isKanjiOnly(text: string): boolean {
  if (!text) return false;
  for (const ch of text) {
    if (!isKanjiChar(ch)) return false;
  }
  return true;
}

function isSkippable(ch: string): boolean {
  return SKIPPABLE_REGEX.test(ch);
}

/** Katakana → hiragana (ウタ → うた). Other characters are untouched. */
export function kataToHira(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) as number;
    out += code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : ch;
  }
  return out;
}

/** Normalizes a reading: katakana → hiragana, lowercase, drops spaces/punctuation, keeps `/`. */
export function normalizeReading(reading: string): string {
  let out = '';
  for (const raw of reading) {
    const ch = raw === '／' ? '/' : raw;
    if (ch === '/') {
      out += '/';
    } else if (!isSkippable(ch)) {
      out += kataToHira(ch).toLowerCase();
    }
  }
  return out;
}

function normalizeAnchor(text: string): string {
  let out = '';
  for (const ch of text) {
    if (!isSkippable(ch)) out += kataToHira(ch).toLowerCase();
  }
  return out;
}

interface TextRun {
  kind: 'kanji' | 'other';
  chars: string[];
  start: number;
}

function splitRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let index = 0;
  for (const ch of text) {
    const kind: TextRun['kind'] = isKanjiChar(ch) ? 'kanji' : 'other';
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) {
      last.chars.push(ch);
    } else {
      runs.push({ kind, chars: [ch], start: index });
    }
    index++;
  }
  return runs;
}

/** Re-assigns runIds so consecutive kanji-only segments share one id. */
export function assignRunIds(segments: Array<Omit<FuriganaSegment, 'runId'>>): FuriganaSegment[] {
  let next = 0;
  let prevWasKanji = false;
  return segments.map((seg) => {
    const kanji = isKanjiOnly(seg.base);
    if (!(kanji && prevWasKanji)) next++;
    prevWasKanji = kanji;
    return { base: seg.base, ruby: seg.ruby, runId: next };
  });
}

/** For each kanji run (in order), the char-lengths of the segments that currently form it. */
function partitionsFromSegments(segments: FuriganaSegment[]): number[][] {
  const result: number[][] = [];
  let current: number[] | null = null;
  let currentRun = -1;
  for (const seg of segments) {
    if (!isKanjiOnly(seg.base)) {
      current = null;
      currentRun = -1;
      continue;
    }
    if (!current || seg.runId !== currentRun) {
      current = [];
      result.push(current);
      currentRun = seg.runId;
    }
    current.push(Array.from(seg.base).length);
  }
  return result;
}

export function segmentsToPlain(segments: FuriganaSegment[]): string {
  return segments.map((s) => s.base).join('');
}

export function segmentsToMarkdown(segments: FuriganaSegment[]): string {
  return segments.map((s) => (s.ruby ? `{${s.base}|${s.ruby}}` : s.base)).join('');
}

/** `{星|ほし}の` → `星の`. */
export function stripRuby(markdown: string): string {
  return parseMarkdownRuby(markdown)
    .map((t) => t.base)
    .join('');
}

function plainRunsToSegments(text: string): Array<Omit<FuriganaSegment, 'runId'>> {
  return splitRuns(text).map((run) => ({ base: run.chars.join('') }));
}

/** Parses a stored markdown line into editable segments. */
export function markdownToSegments(markdown: string): FuriganaSegment[] {
  const raw: Array<Omit<FuriganaSegment, 'runId'>> = [];
  for (const item of parseMarkdownRuby(markdown)) {
    if (item.isRuby && item.ruby) {
      raw.push({ base: item.base, ruby: item.ruby });
    } else {
      raw.push(...plainRunsToSegments(item.base));
    }
  }
  return assignRunIds(raw);
}

/** Builds the hiragana reading string (with `/` between partial parts of one kanji run). */
export function segmentsToReading(segments: FuriganaSegment[]): string {
  let out = '';
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (isKanjiOnly(seg.base)) {
      const parts: string[] = [];
      let j = i;
      while (j < segments.length && isKanjiOnly(segments[j].base) && segments[j].runId === seg.runId) {
        parts.push(kataToHira(segments[j].ruby ?? segments[j].base));
        j++;
      }
      out += parts.join('/');
      i = j;
    } else {
      out += normalizeAnchor(seg.ruby ?? seg.base);
      i++;
    }
  }
  return out;
}

/** Derives the reading directly from a stored markdown line. */
export function deriveReading(markdown: string): string {
  return segmentsToReading(markdownToSegments(markdown));
}

/**
 * Aligns a hiragana reading onto plain text (okurigana-aware, backtracking).
 *
 * - kana in the text act as literal anchors inside the reading,
 * - each kanji run takes the shortest reading that lets the rest align,
 * - `/` splits one kanji run into parts: 1 part = group ruby, N parts = one per kanji,
 *   other counts are accepted only when `hint` (the current segments) already has that partition,
 * - a part equal to the kanji itself means "no furigana".
 */
export function alignReading(
  text: string,
  reading: string,
  hint?: FuriganaSegment[]
): AlignResult {
  const runs = splitRuns(text);
  const r = Array.from(normalizeReading(reading));
  const anchors = runs.map((run) => (run.kind === 'other' ? Array.from(normalizeAnchor(run.chars.join(''))) : []));

  const hintPartitions =
    hint && segmentsToPlain(hint) === text ? partitionsFromSegments(hint) : undefined;
  const kanjiRunOrdinal: number[] = [];
  let ordinal = 0;
  runs.forEach((run, idx) => {
    kanjiRunOrdinal[idx] = run.kind === 'kanji' ? ordinal++ : -1;
  });

  const failed = new Set<string>();
  let best: { run: number; error: AlignError } | null = null;
  const recordFail = (run: number, error: AlignError) => {
    if (!best || run > best.run) best = { run, error };
  };

  const solve = (i: number, p: number): string[][] | null => {
    const key = `${i}:${p}`;
    if (failed.has(key)) return null;

    if (i === runs.length) {
      if (p === r.length) return [];
      recordFail(i, {
        index: Array.from(text).length,
        expected: '',
        message: 'Bacaan lebih panjang dari teks: ada sisa bacaan yang tidak terpakai.',
      });
      failed.add(key);
      return null;
    }

    const run = runs[i];
    if (run.kind === 'other') {
      const a = anchors[i];
      if (a.length === 0 || r.slice(p, p + a.length).join('') === a.join('')) {
        const rest = solve(i + 1, p + a.length);
        if (rest) return rest;
      } else {
        recordFail(i, {
          index: run.start,
          expected: run.chars.join(''),
          message: `Bacaan tidak cocok di "${run.chars.join('')}" (posisi ${run.start + 1}).`,
        });
      }
      failed.add(key);
      return null;
    }

    const n = run.chars.length;
    const ord = kanjiRunOrdinal[i];
    const hinted = hintPartitions?.[ord];
    for (let e = p + 1; e <= r.length; e++) {
      const slice = r.slice(p, e);
      if (slice[0] === '/' || slice[slice.length - 1] === '/') continue;
      const parts = slice.join('').split('/');
      if (parts.some((part) => part.length === 0)) continue;
      const okCount =
        parts.length === 1 ||
        parts.length === n ||
        (hinted !== undefined && hinted.length === parts.length);
      if (!okCount) continue;
      const rest = solve(i + 1, e);
      if (rest) return [parts, ...rest];
    }
    recordFail(i, {
      index: run.start,
      expected: run.chars.join(''),
      message: `Bacaan untuk "${run.chars.join('')}" (posisi ${run.start + 1}) tidak ditemukan atau terlalu pendek.`,
    });
    failed.add(key);
    return null;
  };

  const solved = solve(0, 0);
  if (!solved) {
    const fallback: AlignError = {
      index: 0,
      expected: '',
      message: 'Bacaan tidak dapat diselaraskan dengan teks.',
    };
    const bestFail = best as { run: number; error: AlignError } | null;
    return { ok: false, error: bestFail ? bestFail.error : fallback };
  }

  const raw: Array<Omit<FuriganaSegment, 'runId'>> = [];
  let kanjiIdx = 0;
  runs.forEach((run) => {
    if (run.kind === 'other') {
      raw.push({ base: run.chars.join('') });
      return;
    }
    const parts = solved[kanjiIdx];
    const hinted = hintPartitions?.[kanjiIdx];
    kanjiIdx++;
    const n = run.chars.length;
    let lengths: number[];
    if (parts.length === 1) lengths = [n];
    else if (parts.length === n) lengths = run.chars.map(() => 1);
    else lengths = hinted as number[];

    let offset = 0;
    lengths.forEach((len, k) => {
      const base = run.chars.slice(offset, offset + len).join('');
      offset += len;
      const part = parts[k];
      raw.push({ base, ruby: part === base ? undefined : part });
    });
  });

  return { ok: true, segments: assignRunIds(raw) };
}

// ---------------------------------------------------------------------------
// Editor operations (pure)
// ---------------------------------------------------------------------------

function replaceAt<T>(list: T[], index: number, replacement: T[]): T[] {
  return [...list.slice(0, index), ...replacement, ...list.slice(index + 1)];
}

/** Changes (or clears, when empty / equal to the base) the reading of one kanji segment. */
export function setSegmentRuby(
  segments: FuriganaSegment[],
  index: number,
  ruby: string
): FuriganaSegment[] {
  const seg = segments[index];
  if (!seg || !isKanjiOnly(seg.base)) return segments;
  const cleaned = kataToHira(ruby.trim());
  const next: FuriganaSegment = {
    ...seg,
    ruby: cleaned.length === 0 || cleaned === seg.base ? undefined : cleaned,
  };
  return replaceAt(segments, index, [next]);
}

export function removeSegmentRuby(segments: FuriganaSegment[], index: number): FuriganaSegment[] {
  return setSegmentRuby(segments, index, '');
}

/** Suggests per-kanji readings for a group segment (exact split only when lengths match). */
export function suggestSplit(base: string, ruby?: string): string[] {
  const chars = Array.from(base);
  const reading = Array.from(ruby ?? '');
  if (reading.length === chars.length) return reading;
  return chars.map((_, i) => (i === 0 ? (ruby ?? '') : ''));
}

/** Splits one multi-kanji segment into one segment per kanji using the given readings. */
export function splitSegmentPerKanji(
  segments: FuriganaSegment[],
  index: number,
  rubies: string[]
): FuriganaSegment[] {
  const seg = segments[index];
  if (!seg || !isKanjiOnly(seg.base)) return segments;
  const chars = Array.from(seg.base);
  if (chars.length < 2) return segments;
  const parts: FuriganaSegment[] = chars.map((ch, k) => {
    const cleaned = kataToHira((rubies[k] ?? '').trim());
    return {
      base: ch,
      ruby: cleaned.length === 0 || cleaned === ch ? undefined : cleaned,
      runId: seg.runId,
    };
  });
  return replaceAt(segments, index, parts);
}

/**
 * Merges a kanji segment with the next one (same kanji run) into a single group ruby.
 * The reading is concatenated only when both have one; otherwise it is cleared.
 */
export function mergeSegments(segments: FuriganaSegment[], index: number): FuriganaSegment[] {
  const a = segments[index];
  const b = segments[index + 1];
  if (!a || !b) return segments;
  if (!isKanjiOnly(a.base) || !isKanjiOnly(b.base) || a.runId !== b.runId) return segments;
  const merged: FuriganaSegment = {
    base: a.base + b.base,
    ruby: a.ruby && b.ruby ? a.ruby + b.ruby : undefined,
    runId: a.runId,
  };
  return [...segments.slice(0, index), merged, ...segments.slice(index + 2)];
}

/**
 * Applies a plain-text edit while keeping the furigana of every untouched segment
 * (common prefix / suffix are kept, the changed middle becomes plain text).
 */
export function applyPlainEdit(
  segments: FuriganaSegment[],
  newPlain: string
): FuriganaSegment[] {
  const oldChars = Array.from(segmentsToPlain(segments));
  const newChars = Array.from(newPlain);

  let prefix = 0;
  const maxCommon = Math.min(oldChars.length, newChars.length);
  while (prefix < maxCommon && oldChars[prefix] === newChars[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < maxCommon - prefix &&
    oldChars[oldChars.length - 1 - suffix] === newChars[newChars.length - 1 - suffix]
  ) {
    suffix++;
  }

  const keptPrefix: FuriganaSegment[] = [];
  let offset = 0;
  for (const seg of segments) {
    const len = Array.from(seg.base).length;
    if (offset + len <= prefix) {
      keptPrefix.push(seg);
      offset += len;
    } else {
      break;
    }
  }
  const prefixEnd = offset;

  const keptSuffix: FuriganaSegment[] = [];
  let suffixLen = 0;
  const suffixStartLimit = Math.max(prefixEnd, oldChars.length - suffix);
  let end = oldChars.length;
  for (let i = segments.length - 1; i >= 0; i--) {
    const len = Array.from(segments[i].base).length;
    const start = end - len;
    if (start >= suffixStartLimit) {
      keptSuffix.unshift(segments[i]);
      suffixLen += len;
      end = start;
    } else {
      break;
    }
  }

  const middle = newChars.slice(prefixEnd, newChars.length - suffixLen).join('');
  const raw: Array<Omit<FuriganaSegment, 'runId'>> = [
    ...keptPrefix,
    ...plainRunsToSegments(middle),
    ...keptSuffix,
  ].map((s) => ({ base: s.base, ruby: (s as FuriganaSegment).ruby }));
  return assignRunIds(raw);
}

// ---------------------------------------------------------------------------
// Auto furigana (morphological analyzer output → segments)
// ---------------------------------------------------------------------------

export interface MorphToken {
  surface: string;
  /** Katakana (or hiragana) reading from the analyzer; may be missing for unknown words. */
  reading?: string;
}

/** Builds furigana segments from analyzer tokens, aligning each token on its own. */
export function segmentsFromMorphTokens(tokens: MorphToken[]): FuriganaSegment[] {
  const raw: Array<Omit<FuriganaSegment, 'runId'>> = [];
  for (const token of tokens) {
    const surface = token.surface;
    if (!surface) continue;
    const reading = token.reading && token.reading !== '*' ? token.reading : '';
    if (!containsKanji(surface) || !reading) {
      raw.push(...plainRunsToSegments(surface));
      continue;
    }
    const res = alignReading(surface, reading);
    if (res.ok) {
      raw.push(...res.segments.map((s) => ({ base: s.base, ruby: s.ruby })));
    } else {
      raw.push(...plainRunsToSegments(surface));
    }
  }
  return assignRunIds(raw);
}

/** True when the markdown line already carries at least one furigana tag. */
export function hasFurigana(markdown: string): boolean {
  return parseMarkdownRuby(markdown).some((t) => t.isRuby && Boolean(t.ruby));
}

export type FuriganaEdit =
  | { type: 'setRuby'; index: number; ruby: string }
  | { type: 'removeRuby'; index: number }
  | { type: 'split'; index: number; rubies: string[] }
  | { type: 'merge'; index: number };

/** Applies one editor operation to a segment list (pure). */
export function applyFuriganaEdit(
  segments: FuriganaSegment[],
  edit: FuriganaEdit
): FuriganaSegment[] {
  switch (edit.type) {
    case 'setRuby':
      return setSegmentRuby(segments, edit.index, edit.ruby);
    case 'removeRuby':
      return removeSegmentRuby(segments, edit.index);
    case 'split':
      return splitSegmentPerKanji(segments, edit.index, edit.rubies);
    case 'merge':
      return mergeSegments(segments, edit.index);
  }
}
