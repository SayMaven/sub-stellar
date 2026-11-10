import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FFmpegExportPipeline } from '../engine/export/FFmpegExportPipeline';
import type { SubtitleLine } from '../types';

describe('FFmpegExportPipeline', () => {
  const sampleLines: SubtitleLine[] = [
    {
      id: 'test-1',
      startTime: 0.0,
      endTime: 1.5,
      text: '{夢|ゆめ}の{中|なか}へ',
      translation: 'Into the dream',
      tokens: [
        { text: '夢', ruby: 'ゆめ', startTime: 0.0, endTime: 0.8 },
        { text: 'の', startTime: 0.8, endTime: 1.0 },
        { text: '中', ruby: 'なか', startTime: 1.0, endTime: 1.3 },
        { text: 'へ', startTime: 1.3, endTime: 1.5 },
      ],
    },
  ];

  const sampleStyle = {
    fontFamily: 'sans-serif',
    fontSize: 48,
    primaryColor: '#ffffff',
    outlineColor: '#00ffff',
    secondaryOutlineColor: '#ff00ff',
    outlineThickness: 4,
    rubySizeRatio: 0.5,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly calculates total frames and advances progress', async () => {
    const pipeline = new FFmpegExportPipeline();
    const progressList: number[] = [];

    const result = await pipeline.runExport({
      outputPath: 'test_output.mp4',
      mode: 'mp4_burnin',
      width: 320,
      height: 240,
      fps: 10,
      duration: 0.5, // 5 frames
      lines: sampleLines,
      style: sampleStyle,
      onProgress: (prog) => {
        progressList.push(prog.percentage);
      },
    });

    expect(result.success).toBe(true);
    expect(progressList.length).toBe(5);
    expect(progressList[progressList.length - 1]).toBe(100);
  });

  it('handles user cancellation smoothly', async () => {
    const pipeline = new FFmpegExportPipeline();

    // Trigger cancel immediately
    setTimeout(() => {
      pipeline.cancel();
    }, 5);

    const result = await pipeline.runExport({
      outputPath: 'test_cancel.mp4',
      mode: 'mp4_burnin',
      width: 320,
      height: 240,
      fps: 30,
      duration: 3.0, // 90 frames
      lines: sampleLines,
      style: sampleStyle,
    });

    expect(result.success).toBe(false);
    expect(result.error_message).toContain('cancelled');
  });

  it('supports transparent alpha mode rendering', async () => {
    const pipeline = new FFmpegExportPipeline();
    let lastProgress = 0;

    const result = await pipeline.runExport({
      outputPath: 'test_alpha.webm',
      mode: 'webm_alpha',
      width: 320,
      height: 240,
      fps: 10,
      duration: 0.2, // 2 frames
      lines: sampleLines,
      style: sampleStyle,
      onProgress: (p) => {
        lastProgress = p.percentage;
      },
    });

    expect(result.success).toBe(true);
    expect(lastProgress).toBe(100);
  });
});

