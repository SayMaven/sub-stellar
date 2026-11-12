import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FFmpegExportPipeline,
  computeSubtitleOverlayBand,
  encodeSparseRgbaPacket,
} from '../engine/export/FFmpegExportPipeline';
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

  it('renders gradient fills, glow shadows, and custom ruby colors with parity', async () => {
    const pipeline = new FFmpegExportPipeline();

    const result = await pipeline.runExport({
      outputPath: 'test_parity.mp4',
      mode: 'mp4_burnin',
      width: 640,
      height: 360,
      fps: 10,
      duration: 0.3,
      lines: sampleLines,
      style: {
        ...sampleStyle,
        fontFamily: 'Yu Gothic UI',
        innerStrokeWidth: 2,
        fillGradientEnabled: true,
        fillGradientEndColor: '#b8d0ff',
        glowColor: '#5770b0',
        glowBlur: 12,
        rubyFillColor: '#8fb4ff',
        rubyActiveColor: '#5affb5',
        translationFillColor: '#bfc3ca',
        wordAnimStyle: 'sweep',
      },
    });

    expect(result.success).toBe(true);
  });

  it('computes even-aligned ROI subtitle band significantly smaller than full 1080p frame', () => {
    const band = computeSubtitleOverlayBand({
      outputPath: 'roi.mp4',
      mode: 'mp4_burnin',
      width: 1920,
      height: 1080,
      fps: 60,
      duration: 5,
      lines: sampleLines,
      style: {
        ...sampleStyle,
        glowBlur: 10,
        yOffset: 70,
        verticalPosition: 'bottom',
      },
    });

    expect(band.y % 2).toBe(0);
    expect(band.height % 2).toBe(0);
    expect(band.y).toBeGreaterThan(500);
    expect(band.height).toBeLessThan(480);
    expect(band.y + band.height).toBeLessThanOrEqual(1080);
  });

  it('expands overlay band when particle engine is enabled', () => {
    const baseBand = computeSubtitleOverlayBand({
      outputPath: 'base.mp4',
      mode: 'mp4_burnin',
      width: 1920,
      height: 1080,
      fps: 60,
      duration: 5,
      lines: sampleLines,
      style: {
        ...sampleStyle,
        particleEnabled: false,
      },
    });

    const particleBand = computeSubtitleOverlayBand({
      outputPath: 'particle.mp4',
      mode: 'mp4_burnin',
      width: 1920,
      height: 1080,
      fps: 60,
      duration: 5,
      lines: sampleLines,
      style: {
        ...sampleStyle,
        particleEnabled: true,
        particlePreset: 'sakura',
      },
    });

    expect(particleBand.height).toBeGreaterThan(baseBand.height);
  });

  it('simulates export pipeline with procedural particle engine enabled', async () => {
    const pipeline = new FFmpegExportPipeline();
    const result = await pipeline.runExport({
      outputPath: 'particle_test.mp4',
      mode: 'mp4_burnin',
      width: 640,
      height: 360,
      fps: 15,
      duration: 1.0,
      lines: sampleLines,
      style: {
        ...sampleStyle,
        particleEnabled: true,
        particlePreset: 'sparkle',
        particleBurstCount: 10,
        particleColorMode: 'rainbow',
      },
    });

    expect(result.success).toBe(true);
  });

  it('encodes transparent RGBA dirty rect into compact sparse RLE packet', () => {
    const w = 64;
    const h = 32;
    const rgba = new Uint8Array(w * h * 4);
    // Paint two non-transparent pixels in the middle
    const p1 = (10 * w + 5) * 4;
    rgba[p1] = 255;
    rgba[p1 + 1] = 100;
    rgba[p1 + 2] = 50;
    rgba[p1 + 3] = 255;
    rgba[p1 + 4] = 10;
    rgba[p1 + 5] = 20;
    rgba[p1 + 6] = 30;
    rgba[p1 + 7] = 255;

    const scratch = { buf: new Uint32Array(4096) };
    const packet = encodeSparseRgbaPacket(rgba, 12, 8, w, h, true, scratch);
    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);

    expect(view.getUint32(0, true)).toBe(1); // Sparse RLE flag
    expect(view.getUint32(4, true)).toBe(12); // dirtyX
    expect(view.getUint32(8, true)).toBe(8); // dirtyRelY
    expect(view.getUint32(12, true)).toBe(w);
    expect(view.getUint32(16, true)).toBe(h);
    // Should compress 8192 bytes of raw RGBA down to < 64 bytes
    expect(packet.byteLength).toBeLessThan(64);
  });
});

