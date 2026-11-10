import { describe, it, expect } from 'vitest';
import {
  calculatePeaksFromChannelData,
  generateSyntheticPeaks,
} from '../workers/waveform.worker';
import { waveformManager } from '../engine/audio/WaveformManager';

describe('Waveform Downsampling & Peak Extraction', () => {
  it('calculatePeaksFromChannelData downsamples audio into specified bins', () => {
    // 44100 samples (1 second at 44.1kHz)
    const samples = new Float32Array(44100);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((i / 44100) * Math.PI * 2 * 440); // 440Hz sine wave
    }

    const peaks = calculatePeaksFromChannelData(samples, 500);
    expect(peaks).toHaveLength(1000); // 500 bins * 2 (min, max)

    // Check min and max are within valid amplitude range [-1.0, 1.0]
    for (let i = 0; i < peaks.length; i += 2) {
      const min = peaks[i];
      const max = peaks[i + 1];
      expect(min).toBeLessThanOrEqual(max);
      expect(min).toBeGreaterThanOrEqual(-1.05);
      expect(max).toBeLessThanOrEqual(1.05);
    }
  });

  it('calculatePeaksFromChannelData handles empty audio buffer safely', () => {
    const empty = new Float32Array(0);
    const peaks = calculatePeaksFromChannelData(empty, 100);
    expect(peaks).toHaveLength(200);
    expect(peaks[0]).toBe(0);
    expect(peaks[1]).toBe(0);
  });

  it('generateSyntheticPeaks produces realistic envelope data', () => {
    const peaks = generateSyntheticPeaks(180, 1000);
    expect(peaks).toHaveLength(2000);

    let hasNonZero = false;
    for (let i = 0; i < peaks.length; i++) {
      if (peaks[i] !== 0) hasNonZero = true;
    }
    expect(hasNonZero).toBe(true);
  });

  it('waveformManager caches results for same track and duration', async () => {
    const peaks1 = await waveformManager.getPeaks('test-track-1', 120);
    const peaks2 = await waveformManager.getPeaks('test-track-1', 120);

    expect(peaks1).toBe(peaks2); // Same instance from cache
    expect(peaks1.length).toBe(2000);
  });
});

