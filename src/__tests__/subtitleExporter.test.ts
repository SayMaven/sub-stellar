import { describe, it, expect } from 'vitest';
import {
  generateAss,
  generateSrt,
  generateStyledBurninAss,
  hexToAssBgr,
} from '../engine/text/SubtitleExporter';
import type { SubtitleLine, SubtitleStyle, TrackMetadata } from '../types';

describe('SubtitleExporter (.ass & .srt)', () => {
  const mockLines: SubtitleLine[] = [
    {
      id: 'line-1',
      startTime: 12.5,
      endTime: 16.8,
      text: 'もう{何|なに}もいらない',
      tokens: [
        { text: 'もう', startTime: 12.5, endTime: 13.5 },
        { text: '何', ruby: 'なに', startTime: 13.5, endTime: 14.5 },
        { text: 'もいらない', startTime: 14.5, endTime: 16.8 },
      ],
    },
  ];

  const mockStyle: SubtitleStyle = {
    fontFamily: 'Segoe UI',
    fontSize: 52,
    fillColor: '#ffffff',
    fillGradientEnabled: true,
    fillGradientEndColor: '#b8d0ff',
    outerStrokeColor: '#14161b',
    outerStrokeWidth: 8,
    innerStrokeColor: '#8fb4ff',
    innerStrokeWidth: 2,
    glowColor: '#5770b0',
    glowBlur: 12,
    rubyFillColor: '#8fb4ff',
    rubyActiveColor: '#5affb5',
    translationFillColor: '#bfc3ca',
    verticalPosition: 'bottom',
    xOffset: 0,
    yOffset: 80,
    rubyScale: 0.45,
    showSafeGuides: true,
    particlePreset: 'stardust',
    particleBurstCount: 15,
    particleEnabled: true,
    particleSpeed: 1.0,
    particleGravity: 'none',
    particleSize: 1.0,
    particleLifetime: 1.0,
    particleColorMode: 'lyric',
    wordTransitionMs: 140,
    wordAnimStyle: 'pop',
    wordActiveColor: '#8fb4ff',
  };

  const mockTrack: TrackMetadata = {
    id: 't-1',
    title: 'Stellar Track',
    artist: 'Luna',
    duration: 180,
  };

  it('generates valid Advanced SubStation Alpha (.ass) format with karaoke tags', () => {
    const ass = generateAss(mockLines, mockStyle, mockTrack);

    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('ScriptType: v4.00+');
    expect(ass).toContain('PlayResX: 1920');
    expect(ass).toContain('[V4+ Styles]');
    expect(ass).toContain('Style: Default,Segoe UI,52');
    expect(ass).toContain('Style: Furigana,Segoe UI,23');
    expect(ass).toContain('[Events]');
    expect(ass).toContain('Dialogue: 0,0:00:12.50,0:00:16.80,Default,,0,0,0,,{\\k100}もう{\\k100}何{\\k230}もいらない');
  });

  it('generates standard clean SubRip (.srt) format', () => {
    const srt = generateSrt(mockLines);

    expect(srt).toContain('1\n00:00:12,500 --> 00:00:16,800\nもう何もいらない');
  });

  it('converts #RRGGBB to ASS &H00BBGGRR byte order and respects custom fontFamily & alignment', () => {
    expect(hexToAssBgr('#8fb4ff')).toBe('&H00FFB48F');
    expect(hexToAssBgr('#14161b')).toBe('&H001B1614');
    expect(hexToAssBgr('#5affb5')).toBe('&H00B5FF5A');

    const customAss = generateAss(
      mockLines,
      {
        ...mockStyle,
        fontFamily: 'Yu Gothic UI',
        fillColor: '#ff3366',
        verticalPosition: 'top',
      },
      mockTrack
    );

    expect(customAss).toContain('Style: Default,Yu Gothic UI,52,&H006633FF,&H00FFB48F,&H001B1614');
    expect(customAss).toContain(',8,40,40,80,1');
  });

  it('extracts clean primary font name from quoted CSS font stack in generateAss', () => {
    const stackedAss = generateAss(
      mockLines,
      {
        ...mockStyle,
        fontFamily: '"Dela Gothic One", "Noto Sans JP", sans-serif',
      },
      mockTrack
    );
    expect(stackedAss).toContain('Style: Default,Dela Gothic One,52');
    expect(stackedAss).not.toContain('"Dela Gothic One"');
  });

  it('generates multi-layer styled burn-in ASS with 720p->1080p scaling, Furigana, glow, and smooth \\kf sweep', () => {
    const styledAss = generateStyledBurninAss(
      [
        {
          ...mockLines[0],
          translation: 'I need nothing else anymore',
        },
      ],
      {
        ...mockStyle,
        fontFamily: '"UD Digi Kyokasho N-B", sans-serif',
        wordAnimStyle: 'smooth-sweep',
      },
      mockTrack,
      { width: 1920, height: 1080 }
    );

    // 720p -> 1080p scale = 1.5x (fontSize 52 -> 78) and clean primary font name
    expect(styledAss).toContain('Style: SubOuterGlow,UD Digi Kyokasho N-B,78,');
    // Fixed ASS karaoke color polarity: PrimaryColour = active (&H00FFB48F), SecondaryColour = inactive (&H00FFFFFF)
    expect(styledAss).toContain('Style: SubMain,UD Digi Kyokasho N-B,78,&H00FFB48F,&H00FFFFFF,');
    // Furigana layer, outer glow layer, main stroke layer, and translation emitted
    expect(styledAss).toContain('Dialogue: 0,0:00:12.50,0:00:16.80,SubOuterGlow,');
    expect(styledAss).toContain('Dialogue: 1,0:00:12.50,0:00:16.80,SubMain,');
    expect(styledAss).toContain('Dialogue: 2,0:00:12.50,0:00:16.80,Furigana,,0,0,0,,{\\an2\\pos(843,885)');
    expect(styledAss).toContain('\\kf100}何');
    expect(styledAss).toContain('\\kf100}なに');
    expect(styledAss).toContain('\\blur');
    expect(styledAss).toContain('Dialogue: 1,0:00:12.50,0:00:16.80,Translation,');
  });
});

