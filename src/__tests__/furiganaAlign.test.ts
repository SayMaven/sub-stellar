import { describe, it, expect } from 'vitest';
import {
  alignReading,
  applyPlainEdit,
  deriveReading,
  hasFurigana,
  kataToHira,
  markdownToSegments,
  mergeSegments,
  normalizeReading,
  removeSegmentRuby,
  segmentsFromMorphTokens,
  segmentsToMarkdown,
  segmentsToReading,
  setSegmentRuby,
  splitSegmentPerKanji,
  stripRuby,
  suggestSplit,
} from '../engine/text/furiganaAlign';

function align(text: string, reading: string) {
  const res = alignReading(text, reading);
  if (!res.ok) throw new Error(res.error.message);
  return segmentsToMarkdown(res.segments);
}

describe('furiganaAlign: reading → ruby alignment', () => {
  it('aligns a whole line with group ruby and okurigana anchors', () => {
    expect(align('星空の下で歌おう', 'ほしぞらのしたでうたおう')).toBe(
      '{星空|ほしぞら}の{下|した}で{歌|うた}おう'
    );
  });

  it('handles okurigana inside a word', () => {
    expect(align('食べる', 'たべる')).toBe('{食|た}べる');
    expect(align('待ち遠しいな', 'まちどおしいな')).toBe('{待|ま}ち{遠|どお}しいな');
  });

  it('splits a kanji run per character with "/"', () => {
    expect(align('星空の下', 'ほし/ぞらのした')).toBe('{星|ほし}{空|ぞら}の{下|した}');
  });

  it('accepts katakana readings and ignores spaces and punctuation', () => {
    expect(align('星空の下で、歌おう', 'ホシゾラ の シタ デ うたおう')).toBe(
      '{星空|ほしぞら}の{下|した}で、{歌|うた}おう'
    );
    expect(kataToHira('ウタ')).toBe('うた');
    expect(normalizeReading('ホシ ゾラ。/')).toBe('ほしぞら/');
  });

  it('backtracks when the particle also appears inside the reading', () => {
    expect(align('野の花', 'ののはな')).toBe('{野|の}の{花|はな}');
  });

  it('treats a part equal to the kanji as "no furigana"', () => {
    expect(align('星の下', '星のした')).toBe('星の{下|した}');
  });

  it('returns an error with position and keeps going nowhere when reading is wrong', () => {
    const res = alignReading('星空の下で歌おう', 'ほしぞらのしたでうたえ');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message.length).toBeGreaterThan(0);
      expect(res.error.index).toBeGreaterThanOrEqual(0);
    }
    expect(alignReading('星空の下', 'ほしぞら').ok).toBe(false);
    expect(alignReading('星', 'ほし/ぞら').ok).toBe(false);
  });

  it('uses the current partition as a hint for partial groups', () => {
    const current = markdownToSegments('{選択|せんたく}{肢|し}');
    const res = alignReading('選択肢', 'せんたく/し', current);
    expect(res.ok).toBe(true);
    if (res.ok) expect(segmentsToMarkdown(res.segments)).toBe('{選択|せんたく}{肢|し}');
    expect(alignReading('選択肢', 'せんたく/し').ok).toBe(false);
  });
});

describe('furiganaAlign: markdown helpers & round trip', () => {
  const samples = [
    'もう{何|なに}もいらない',
    'あぁ{待|ま}ち{遠|とお}しいな',
    '{星|ほし}{空|ぞら}の{下|した}で{歌|うた}おう',
    '{星空|ほしぞら}の{下|した}で{歌|うた}おう',
    'Hello {世界|せかい}!',
  ];

  it('strips ruby and detects furigana', () => {
    expect(stripRuby('{星|ほし}の{下|した}')).toBe('星の下');
    expect(hasFurigana('{星|ほし}の')).toBe(true);
    expect(hasFurigana('星の')).toBe(false);
  });

  it.each(samples)('reading derived from %s aligns back to the same markdown', (md) => {
    const segs = markdownToSegments(md);
    const reading = segmentsToReading(segs);
    const res = alignReading(stripRuby(md), reading, segs);
    expect(res.ok).toBe(true);
    if (res.ok) expect(segmentsToMarkdown(res.segments)).toBe(md);
    expect(deriveReading(md)).toBe(reading);
  });

  it('emits "/" for per-kanji runs', () => {
    expect(deriveReading('{星|ほし}{空|ぞら}の{下|した}')).toBe('ほし/ぞらのした');
  });
});

describe('furiganaAlign: editor operations', () => {
  it('sets, clears and keeps the reading in sync', () => {
    let segs = markdownToSegments('{今日|きょう}は');
    segs = setSegmentRuby(segs, 0, 'こんにち');
    expect(segmentsToMarkdown(segs)).toBe('{今日|こんにち}は');
    segs = removeSegmentRuby(segs, 0);
    expect(segmentsToMarkdown(segs)).toBe('今日は');
    expect(segmentsToReading(segs)).toBe('今日は');
  });

  it('splits a group per kanji and merges it back', () => {
    let segs = markdownToSegments('{星空|ほしぞら}の');
    expect(suggestSplit('星空', 'ほしぞら')).toEqual(['ほしぞら', '']);
    expect(suggestSplit('愛人', 'あい')).toEqual(['あ', 'い']);
    segs = splitSegmentPerKanji(segs, 0, ['ほし', 'ぞら']);
    expect(segmentsToMarkdown(segs)).toBe('{星|ほし}{空|ぞら}の');
    expect(segmentsToReading(segs)).toBe('ほし/ぞらの');
    segs = mergeSegments(segs, 0);
    expect(segmentsToMarkdown(segs)).toBe('{星空|ほしぞら}の');
  });

  it('clears the reading when merging a segment that has none', () => {
    const segs = mergeSegments(markdownToSegments('{星|ほし}空の'), 0);
    expect(segmentsToMarkdown(segs)).toBe('星空の');
  });

  it('keeps furigana of untouched parts when the plain text is edited', () => {
    const segs = markdownToSegments('{星空|ほしぞら}の{下|した}で{歌|うた}おう');
    const edited = applyPlainEdit(segs, '星空の下で歌いたい');
    expect(stripRuby(segmentsToMarkdown(edited))).toBe('星空の下で歌いたい');
    expect(segmentsToMarkdown(edited)).toBe('{星空|ほしぞら}の{下|した}で{歌|うた}いたい');
  });

  it('drops only the edited group and keeps the rest', () => {
    const segs = markdownToSegments('{星空|ほしぞら}の{下|した}');
    const edited = applyPlainEdit(segs, '星月の下');
    expect(stripRuby(segmentsToMarkdown(edited))).toBe('星月の下');
    expect(segmentsToMarkdown(edited)).toContain('{下|した}');
    expect(segmentsToMarkdown(edited)).not.toContain('ほしぞら');
  });
});

describe('furiganaAlign: morphological tokens', () => {
  it('builds segments from analyzer tokens with okurigana trimming', () => {
    const segs = segmentsFromMorphTokens([
      { surface: '星空', reading: 'ホシゾラ' },
      { surface: 'の', reading: 'ノ' },
      { surface: '下', reading: 'シタ' },
      { surface: 'で', reading: 'デ' },
      { surface: '歌い', reading: 'ウタイ' },
      { surface: 'たい', reading: 'タイ' },
    ]);
    expect(segmentsToMarkdown(segs)).toBe('{星空|ほしぞら}の{下|した}で{歌|うた}いたい');
  });

  it('leaves unknown words without furigana', () => {
    const segs = segmentsFromMorphTokens([{ surface: '鬱', reading: undefined }, { surface: '!' }]);
    expect(segmentsToMarkdown(segs)).toBe('鬱!');
  });
});
