import { describe, it, expect } from 'vitest';
import {
  parseMarkdownRuby,
  serializeToMarkdownRuby,
  type ParsedRubyToken,
} from '../engine/text/RubyLayout';

describe('Ruby & Furigana Editor Workflows', () => {
  it('parses mixed kanji-ruby text into editable tokens', () => {
    const raw = 'もう{何|なに}もいらない';
    const tokens = parseMarkdownRuby(raw);

    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toEqual({ base: 'もう', isRuby: false });
    expect(tokens[1]).toEqual({ base: '何', ruby: 'なに', isRuby: true });
    expect(tokens[2]).toEqual({ base: 'もいらない', isRuby: false });
  });

  it('serializes edited tokens back to clean Markdown Ruby syntax', () => {
    const tokens = [
      { base: 'あぁ', isRuby: false },
      { base: '待', ruby: 'ま', isRuby: true },
      { base: 'ち', isRuby: false },
      { base: '遠', ruby: 'とお', isRuby: true },
      { base: 'しいな', isRuby: false },
    ];

    const serialized = serializeToMarkdownRuby(tokens);
    expect(serialized).toBe('あぁ{待|ま}ち{遠|とお}しいな');
  });

  it('handles addition of ruby reading to plain word', () => {
    const tokens: ParsedRubyToken[] = [{ base: '星空', isRuby: false }];
    tokens[0] = { base: '星空', ruby: 'ほしぞら', isRuby: true };

    const serialized = serializeToMarkdownRuby(tokens);
    expect(serialized).toBe('{星空|ほしぞら}');
  });
});
