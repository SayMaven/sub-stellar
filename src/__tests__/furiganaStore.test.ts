import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  useStudioStore,
  DEFAULT_SUBTITLE_STYLE,
} from '../stores/useStudioStore';
import {
  segmentsFromMorphTokens,
  segmentsToMarkdown,
  segmentsToPlain,
  stripRuby,
  hasFurigana,
  type MorphToken,
} from '../engine/text/furiganaAlign';
import type { SubtitleLine } from '../types';

const makeLine = (): SubtitleLine => ({
  id: 'k1',
  startTime: 10,
  endTime: 14,
  text: '星空の下で歌おう',
  translation: '',
  tokens: [
    { text: '星空', startTime: 10, endTime: 11 },
    { text: 'の', startTime: 11, endTime: 11.5 },
    { text: '下', startTime: 11.5, endTime: 12.5 },
    { text: 'で', startTime: 12.5, endTime: 13 },
    { text: '歌', startTime: 13, endTime: 13.6 },
    { text: 'おう', startTime: 13.6, endTime: 14 },
  ],
});

describe('furigana store actions', () => {
  beforeEach(() => {
    useStudioStore.setState({
      lines: [makeLine()],
      selectedLineId: 'k1',
      style: { ...DEFAULT_SUBTITLE_STYLE },
    });
  });

  const line = () => useStudioStore.getState().lines[0];

  it('setLineReading builds ruby from a plain reading and splits per kanji with "/"', () => {
    const res = useStudioStore.getState().setLineReading('k1', 'ほしぞらのしたでうたおう');
    expect(res.ok).toBe(true);
    expect(line().text).toBe('{星空|ほしぞら}の{下|した}で{歌|うた}おう');
    // token count unchanged (6) → per-word timing is preserved
    expect(line().tokens).toHaveLength(6);
    expect(line().tokens[2].startTime).toBe(11.5);
    expect(line().tokens[0].ruby).toBe('ほしぞら');

    const split = useStudioStore.getState().setLineReading('k1', 'ほし/ぞらのしたでうたおう');
    expect(split.ok).toBe(true);
    expect(line().text).toBe('{星|ほし}{空|ぞら}の{下|した}で{歌|うた}おう');
    expect(line().tokens).toHaveLength(7);
  });

  it('setLineReading reports an error and leaves the text untouched', () => {
    const before = line().text;
    const res = useStudioStore.getState().setLineReading('k1', 'ほしぞらのしたでうたえ');
    expect(res.ok).toBe(false);
    expect(res.message).toBeTruthy();
    expect(line().text).toBe(before);
  });

  it('an empty reading clears all furigana', () => {
    useStudioStore.getState().setLineReading('k1', 'ほしぞらのしたでうたおう');
    useStudioStore.getState().setLineReading('k1', '');
    expect(line().text).toBe('星空の下で歌おう');
  });

  it('editLineFurigana edits one reading without touching timing, and split changes the token count', () => {
    useStudioStore.getState().setLineReading('k1', 'ほしぞらのしたでうたおう');
    useStudioStore.getState().editLineFurigana('k1', { type: 'setRuby', index: 2, ruby: 'しも' });
    expect(line().text).toBe('{星空|ほしぞら}の{下|しも}で{歌|うた}おう');
    expect(line().tokens).toHaveLength(6);
    expect(line().tokens[2].startTime).toBe(11.5);

    useStudioStore
      .getState()
      .editLineFurigana('k1', { type: 'split', index: 0, rubies: ['ほし', 'ぞら'] });
    expect(line().text).toBe('{星|ほし}{空|ぞら}の{下|しも}で{歌|うた}おう');
    expect(line().tokens).toHaveLength(7);
  });

  it('updateLinePlainText keeps furigana of untouched parts', () => {
    useStudioStore.getState().setLineReading('k1', 'ほしぞらのしたでうたおう');
    useStudioStore.getState().updateLinePlainText('k1', '星空の下で歌いたい');
    expect(stripRuby(line().text)).toBe('星空の下で歌いたい');
    expect(line().text).toBe('{星空|ほしぞら}の{下|した}で{歌|うた}いたい');
  });

  it('updateLinePlainText still accepts raw {Kanji|Ruby} syntax', () => {
    useStudioStore.getState().updateLinePlainText('k1', '{何|なに}も');
    expect(line().text).toBe('{何|なに}も');
  });
});

describe('Kuromoji integration (real dictionary)', () => {
  it(
    'turns a lyric line into furigana segments that preserve the original text',
    async () => {
      const require = createRequire(import.meta.url);
      const kuromoji = require('@sglkc/kuromoji');
      const dicPath = path.resolve(process.cwd(), 'node_modules/@sglkc/kuromoji/dict');
      const tokenizer = await new Promise<{
        tokenize: (t: string) => Array<{ surface_form: string; reading?: string }>;
      }>((resolve, reject) => {
        kuromoji.builder({ dicPath }).build((err: Error | null, t: never) => {
          if (err) reject(err);
          else resolve(t);
        });
      });

      const lines = ['星空の下で歌おう', '触れたくて触れられない', '指折り数えているのは'];
      for (const plain of lines) {
        const tokens: MorphToken[] = tokenizer
          .tokenize(plain)
          .map((t) => ({ surface: t.surface_form, reading: t.reading }));
        const segments = segmentsFromMorphTokens(tokens);
        expect(segmentsToPlain(segments)).toBe(plain);
        const md = segmentsToMarkdown(segments);
        expect(hasFurigana(md)).toBe(true);
        expect(stripRuby(md)).toBe(plain);
        // every kanji-containing token must have received a reading
        expect(md).toMatch(/\{[^|{}]+\|[ぁ-ゖー]+\}/);
      }
    },
    60_000
  );
});

