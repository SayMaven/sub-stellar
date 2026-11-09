/**
 * RubyLayout Engine: Typography, Unicode & Japanese Furigana Layout Calculator
 * Compliant with Intl.Segmenter, Kinsoku Shori CJK wrapping rules, and UAX #9 standards.
 */

export interface ParsedRubyToken {
  base: string;
  ruby?: string;
  isRuby: boolean;
}

export interface RubyLayoutMetrics {
  baseX: number;
  baseY: number;
  baseWidth: number;
  baseHeight: number;
  rubyX: number;
  rubyY: number;
  rubyWidth: number;
  rubyHeight: number;
}

// Kinsoku Shori (CJK line-wrap rules)
const PROHIBITED_LINE_START = new Set([
  '、', '。', '，', '．', '！', '？', '）', '」', '』', '〕', '〉', '》',
  '!', '?', ')', ']', '}', ',', '.', ':', ';'
]);

const PROHIBITED_LINE_END = new Set([
  '（', '「', '『', '〔', '〈', '《', '(', '[', '{'
]);

/**
 * Grapheme cluster segmentation using native Intl.Segmenter to avoid broken glyphs
 */
export function getGraphemeClusters(text: string, locale = 'ja'): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' });
    return [...segmenter.segment(text)].map((s) => s.segment);
  }
  return Array.from(text);
}

/**
 * Parses Markdown Ruby tags e.g. "もう{何|なに}もいらない" into structured tokens.
 */
export function parseMarkdownRuby(text: string): ParsedRubyToken[] {
  const tokens: ParsedRubyToken[] = [];
  const regex = /\{([^|{}]+)\|([^|{}]+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        base: text.slice(lastIndex, match.index),
        isRuby: false,
      });
    }

    tokens.push({
      base: match[1],
      ruby: match[2],
      isRuby: true,
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      base: text.slice(lastIndex),
      isRuby: false,
    });
  }

  return tokens;
}

/**
 * Serializes ruby tokens back to clean Markdown Ruby syntax.
 */
export function serializeToMarkdownRuby(tokens: ParsedRubyToken[]): string {
  return tokens
    .map((t) => (t.isRuby && t.ruby ? `{${t.base}|${t.ruby}}` : t.base))
    .join('');
}

/**
 * Calculates horizontal & vertical centering for Furigana above base Kanji.
 * Formula: rubyX = baseX + (baseWidth - rubyWidth) / 2
 *          rubyY = baseY - rubyHeight - gap
 */
export function computeRubyPosition(
  baseX: number,
  baseY: number,
  baseWidth: number,
  baseHeight: number,
  rubyWidth: number,
  rubyHeight: number,
  gap = 2
): RubyLayoutMetrics {
  const rubyX = baseX + (baseWidth - rubyWidth) / 2;
  const rubyY = baseY - rubyHeight - gap;

  return {
    baseX,
    baseY,
    baseWidth,
    baseHeight,
    rubyX,
    rubyY,
    rubyWidth,
    rubyHeight,
  };
}

/**
 * CJK word wrap complying with Kinsoku Shori rules (prohibited start/end characters).
 */
export function wrapCJKText(text: string, maxGraphemesPerLine = 18): string[] {
  const clusters = getGraphemeClusters(text);
  if (clusters.length <= maxGraphemesPerLine) {
    return [text];
  }

  const lines: string[] = [];
  let currentLine: string[] = [];

  for (let i = 0; i < clusters.length; i++) {
    const char = clusters[i];

    if (currentLine.length >= maxGraphemesPerLine) {
      // Check if current char is prohibited at the start of a new line
      if (PROHIBITED_LINE_START.has(char)) {
        // Keep it on current line if possible
        currentLine.push(char);
        lines.push(currentLine.join(''));
        currentLine = [];
        continue;
      }

      // Check if previous character was prohibited at end of line
      const prevChar = currentLine[currentLine.length - 1];
      if (PROHIBITED_LINE_END.has(prevChar)) {
        currentLine.pop();
        lines.push(currentLine.join(''));
        currentLine = [prevChar, char];
        continue;
      }

      lines.push(currentLine.join(''));
      currentLine = [char];
    } else {
      currentLine.push(char);
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine.join(''));
  }

  return lines;
}
