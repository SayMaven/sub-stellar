/**
 * Off-thread Web Worker for audio waveform downsampling and peak extraction.
 * Guarantees zero UI thread blocking when processing audio tracks.
 */

export interface WaveformWorkerRequest {
  type: 'EXTRACT_PEAKS' | 'GENERATE_SYNTHETIC';
  channelData?: Float32Array;
  duration?: number;
  targetBins?: number;
  seed?: number;
}

export interface WaveformWorkerResponse {
  type: 'PEAKS_READY' | 'ERROR';
  peaks?: Float32Array;
  bins?: number;
  error?: string;
}

/**
 * Pure function: downsamples raw audio channel data into ~2000 peak points (min/max pairs).
 */
export function calculatePeaksFromChannelData(
  channelData: Float32Array,
  targetBins: number = 1000
): Float32Array {
  const totalSamples = channelData.length;
  if (totalSamples === 0) return new Float32Array(targetBins * 2);

  const samplesPerBin = Math.max(1, Math.floor(totalSamples / targetBins));
  const peaks = new Float32Array(targetBins * 2);

  for (let b = 0; b < targetBins; b++) {
    const start = b * samplesPerBin;
    const end = Math.min(start + samplesPerBin, totalSamples);

    let min = 1.0;
    let max = -1.0;

    for (let i = start; i < end; i++) {
      const val = channelData[i];
      if (val < min) min = val;
      if (val > max) max = val;
    }

    if (min > max) {
      min = 0;
      max = 0;
    }

    peaks[b * 2] = min;
    peaks[b * 2 + 1] = max;
  }

  return peaks;
}

/**
 * Generates procedural realistic waveform peaks when raw audio data is not yet loaded.
 */
export function generateSyntheticPeaks(
  durationSeconds: number,
  targetBins: number = 1000,
  seed: number = 42
): Float32Array {
  const peaks = new Float32Array(targetBins * 2);

  for (let b = 0; b < targetBins; b++) {
    const t = (b / targetBins) * durationSeconds;

    // Harmonic musical envelope simulation (bassline + chords + drum hits)
    const rhythm = Math.sin(t * 3.5 + seed) * 0.4;
    const vocal = Math.cos(t * 1.8 + seed * 0.5) * 0.35;
    const transient = Math.abs(Math.sin(t * 8.0)) > 0.85 ? 0.25 : 0;
    const envelope = Math.sin((b / targetBins) * Math.PI) * 0.3 + 0.3;

    const amplitude = Math.min(0.98, Math.max(0.08, Math.abs(rhythm + vocal + transient) * envelope));

    peaks[b * 2] = -amplitude;     // min peak
    peaks[b * 2 + 1] = amplitude;  // max peak
  }

  return peaks;
}

// Web Worker message listener (active when run inside dedicated Worker thread)
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  self.onmessage = (event: MessageEvent<WaveformWorkerRequest>) => {
    try {
      const req = event.data;
      const targetBins = req.targetBins || 1000;

      let peaks: Float32Array;

      if (req.type === 'EXTRACT_PEAKS' && req.channelData) {
        peaks = calculatePeaksFromChannelData(req.channelData, targetBins);
      } else {
        const duration = req.duration || 180;
        peaks = generateSyntheticPeaks(duration, targetBins, req.seed || 42);
      }

      // Zero-copy transfer of underlying ArrayBuffer
      (self as unknown as Worker).postMessage(
        {
          type: 'PEAKS_READY',
          peaks,
          bins: targetBins,
        },
        [peaks.buffer] as unknown as StructuredSerializeOptions
      );
    } catch (err) {
      (self as unknown as Worker).postMessage({
        type: 'ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };
}

