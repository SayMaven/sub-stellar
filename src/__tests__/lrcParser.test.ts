import { describe, it, expect } from 'vitest';
import {
  parseLrcTimestamp,
  parseSrtTimestamp,
  isYrcFormat,
  isSrtFormat,
  parseYrc,
  parseSrt,
  parseLrc,
} from '../services/lyrics/lrcParser';

describe('LRC & YRC Subtitle Parsers', () => {
  it('parseLrcTimestamp converts [mm:ss.xx] to float seconds', () => {
    expect(parseLrcTimestamp('01:23.45')).toBeCloseTo(83.45, 2);
    expect(parseLrcTimestamp('00:05.100')).toBeCloseTo(5.1, 2);
    expect(parseLrcTimestamp('invalid')).toBeNull();
  });

  it('detects NetEase YRC format accurately', () => {
    const yrcSample = '[12000,4500](12000,800,0)Hello(12800,1200,0)World';
    const standardLrc = '[00:12.00] Hello World';

    expect(isYrcFormat(yrcSample)).toBe(true);
    expect(isYrcFormat(standardLrc)).toBe(false);
  });

  it('parses YRC format into structured lines with word timings', () => {
    const yrcSample = `
[12000,4000](12000,1000,0)もう(13000,1500,0)何(14500,1500,0)も
[18000,5000](18000,2000,0)いらない
    `.trim();

    const lines = parseYrc(yrcSample);
    expect(lines).toHaveLength(2);
    expect(lines[0].startTime).toBe(12);
    expect(lines[0].endTime).toBe(16);
    expect(lines[0].text).toBe('もう何も');
    expect(lines[0].tokens).toHaveLength(3);
    expect(lines[0].tokens[0].text).toBe('もう');
    expect(lines[0].tokens[0].startTime).toBe(12);
  });

  it('parses standard LRC and computes valid subtitle intervals', () => {
    const standardLrc = `
[ar:Kenshi Yonezu]
[ti:Kick Back]
[00:12.50]努力 未来 A BEAUTIFUL STAR
[00:17.20]努力 未来 A BEAUTIFUL STAR
[00:22.00]油断したって どうしようもない
    `.trim();

    const lines = parseLrc(standardLrc);
    expect(lines).toHaveLength(3);
    expect(lines[0].startTime).toBe(12.5);
    expect(lines[0].text).toBe('努力 未来 A BEAUTIFUL STAR');
    expect(lines[0].tokens.length).toBeGreaterThan(0);
    expect(lines[1].startTime).toBe(17.2);
    expect(lines[0].endTime).toBeLessThanOrEqual(lines[1].startTime);
  });

  it('parses word-synced Enhanced LRC tags', () => {
    const enhancedLrc = '[00:10.00]<00:10.00>Star <00:11.20>Dust <00:12.50>Stream';
    const lines = parseLrc(enhancedLrc);

    expect(lines).toHaveLength(1);
    expect(lines[0].tokens).toHaveLength(3);
    expect(lines[0].tokens[0].text).toBe('Star');
    expect(lines[0].tokens[1].text).toBe('Dust');
  });

  it('associates parallel translation lines correctly', () => {
    const lrc = `
[00:12.00]もう何もいらない
[00:18.00]あぁ待ち遠しいな
    `.trim();

    const translation = `
[00:12.00]I do not need anything anymore
[00:18.00]Ah, I can hardly wait
    `.trim();

    const lines = parseLrc(lrc, translation);
    expect(lines).toHaveLength(2);
    expect(lines[0].translation).toBe('I do not need anything anymore');
    expect(lines[1].translation).toBe('Ah, I can hardly wait');
  });

  it('auto-segments unspaced Japanese LRC lines into multiple word tokens for vocal animation', () => {
    const lrc = '[00:10.00]進み続けた\n[00:14.00]星空の下で歌おう';
    const lines = parseLrc(lrc);
    expect(lines).toHaveLength(2);
    expect(lines[0].tokens.length).toBeGreaterThan(1);
    expect(lines[0].tokens.map((t) => t.text).join('')).toBe('進み続けた');
    expect(lines[0].tokens[0].startTime).toBe(10);
    expect(lines[0].tokens[lines[0].tokens.length - 1].endTime).toBe(14);
  });

  it('detects and parses .SRT subtitle files including secondary translations', () => {
    const srtSample = `
1
00:00:12,000 --> 00:00:16,500
進み続けた
I kept moving forward

2
00:00:17,200 --> 00:00:21,000
<i>Aku dan kamu bersama</i>
    `.trim();

    expect(isSrtFormat(srtSample)).toBe(true);
    expect(parseSrtTimestamp('00:01:05,250')).toBeCloseTo(65.25, 2);

    const lines = parseSrt(srtSample);
    expect(lines).toHaveLength(2);
    expect(lines[0].startTime).toBe(12);
    expect(lines[0].endTime).toBe(16.5);
    expect(lines[0].text).toBe('進み続けた');
    expect(lines[0].translation).toBe('I kept moving forward');
    expect(lines[0].tokens.length).toBeGreaterThan(1);

    expect(lines[1].text).toBe('Aku dan kamu bersama');
    expect(lines[1].tokens).toHaveLength(4);

    // Also verify parseLrc auto-delegates when given SRT input
    const autoParsed = parseLrc(srtSample);
    expect(autoParsed).toHaveLength(2);
    expect(autoParsed[0].text).toBe('進み続けた');
  });

  it('merges separate primary and translation SRT/VTT tracks downloaded from YouTube', () => {
    const primaryVtt = `
WEBVTT

00:00:05.000 --> 00:00:09.000
星街すいせい &amp; Miku

00:00:10.000 --> 00:00:14.000
夜の空を駆ける
    `.trim();

    const translationSrt = `
1
00:00:05,100 --> 00:00:08,900
Hoshimachi Suisei & Miku

2
00:00:10,000 --> 00:00:14,000
Racing across the night sky
    `.trim();

    const lines = parseLrc(primaryVtt, translationSrt);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('星街すいせい & Miku');
    expect(lines[0].translation).toBe('Hoshimachi Suisei & Miku');
    expect(lines[1].text).toBe('夜の空を駆ける');
    expect(lines[1].translation).toBe('Racing across the night sky');
  });

  it('cleans bracketed Romaji and extracts actual translation from YouTube two-line cues', () => {
    const youtubeIdSrt = `
1
00:00:31,740 --> 00:00:37,520
[Atashi wa ishikoro ni demo nareta nara ii na]
Lebih baik aku menjadi batu kerikil saja
    `.trim();

    // Standalone parse: line.text is the actual translation and line.translation is clean Romaji
    const standalone = parseSrt(youtubeIdSrt);
    expect(standalone).toHaveLength(1);
    expect(standalone[0].text).toBe('Lebih baik aku menjadi batu kerikil saja');
    expect(standalone[0].translation).toBe('Atashi wa ishikoro ni demo nareta nara ii na');

    // Dual-track merge: Japanese primary + Indonesian secondary
    const japaneseJaSrt = `
1
00:00:31,740 --> 00:00:37,520
あたしは石ころにでもなれたならいいな
    `.trim();

    const merged = parseLrc(japaneseJaSrt, youtubeIdSrt);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe('あたしは石ころにでもなれたならいいな');
    expect(merged[0].translation).toBe('Lebih baik aku menjadi batu kerikil saja');
  });
});

