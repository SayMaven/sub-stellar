import { describe, it, expect } from 'vitest';
import {
  parseMarkdownRuby,
  serializeToMarkdownRuby,
  computeRubyPosition,
  wrapCJKText,
  getGraphemeClusters,
} from '../engine/text/RubyLayout';

describe('RubyLayout Engine', () => {
  it('parses mixed Japanese text with Markdown Ruby tags', () => {
    const raw = 'もう{何|なに}もいらない';
    const tokens = parseMarkdownRuby(raw);

    expect(tokens.length).toBe(3);
    expect(tokens[0]).toEqual({ base: 'もう', isRuby: false });
    expect(tokens[1]).toEqual({ base: '何', ruby: 'なに', isRuby: true });
    expect(tokens[2]).toEqual({ base: 'もいらない', isRuby: false });
  });

  it('serializes ruby tokens back to Markdown Ruby syntax', () => {
    const tokens = [
      { base: 'あぁ', isRuby: false },
      { base: '待', ruby: 'ま', isRuby: true },
      { base: 'ち', isRuby: false },
      { base: '遠', ruby: 'とお', isRuby: true },
      { base: 'しいな', isRuby: false },
    ];
    const result = serializeToMarkdownRuby(tokens);
    expect(result).toBe('あぁ{待|ま}ち{遠|とお}しいな');
  });

  it('computes accurate horizontal and vertical ruby position centered over kanji', () => {
    // Kanji at (100, 200), width 50, height 50
    // Ruby width 30, height 20, gap 2
    const metrics = computeRubyPosition(100, 200, 50, 50, 30, 20, 2);

    // rubyX = 100 + (50 - 30) / 2 = 110
    expect(metrics.rubyX).toBe(110);
    // rubyY = 200 - 20 - 2 = 178
    expect(metrics.rubyY).toBe(178);
  });

  it('segments grapheme clusters properly without breaking multi-byte characters', () => {
    const clusters = getGraphemeClusters('星空の下で歌おう');
    expect(clusters.length).toBe(8);
    expect(clusters[0]).toBe('星');
  });

  it('respects Kinsoku Shori rules preventing prohibited characters at start of line', () => {
    // Punctuation '。' should not be placed alone at start of line
    const text = 'これは長い日本語の文章です。次の文です。';
    const lines = wrapCJKText(text, 14);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.startsWith('。')).toBe(false);
      expect(line.startsWith('、')).toBe(false);
    }
  });
});

