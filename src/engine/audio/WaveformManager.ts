import {
  calculatePeaksFromChannelData,
  generateSyntheticPeaks,
  type WaveformWorkerResponse,
} from '../../workers/waveform.worker';

export class WaveformManager {
  private cache = new Map<string, Float32Array>();
  private worker: Worker | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(
          new URL('../../workers/waveform.worker.ts', import.meta.url),
          { type: 'module' }
        );
      } catch {
        this.worker = null;
      }
    }
  }

  /**
   * Retrieves downsampled ~2000 peak points for a track, utilizing worker or fallback.
   */
  public async getPeaks(
    trackId: string,
    durationSeconds: number,
    channelData?: Float32Array
  ): Promise<Float32Array> {
    const cacheKey = `${trackId}-${Math.round(durationSeconds)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (this.worker) {
      try {
        const peaks = await this.queryWorker(channelData, durationSeconds);
        this.cache.set(cacheKey, peaks);
        return peaks;
      } catch {
        // Fallback to in-thread calculation if worker encounters an error
      }
    }

    // In-thread synchronous calculation fallback
    const peaks = channelData
      ? calculatePeaksFromChannelData(channelData, 1000)
      : generateSyntheticPeaks(durationSeconds, 1000);

    this.cache.set(cacheKey, peaks);
    return peaks;
  }

  private queryWorker(channelData: Float32Array | undefined, duration: number): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handler = (event: MessageEvent<WaveformWorkerResponse>) => {
        this.worker?.removeEventListener('message', handler);
        if (event.data.type === 'PEAKS_READY' && event.data.peaks) {
          resolve(event.data.peaks);
        } else {
          reject(new Error(event.data.error || 'Failed to extract waveform peaks'));
        }
      };

      this.worker.addEventListener('message', handler);

      if (channelData) {
        this.worker.postMessage(
          {
            type: 'EXTRACT_PEAKS',
            channelData,
            targetBins: 1000,
          },
          [channelData.buffer]
        );
      } else {
        this.worker.postMessage({
          type: 'GENERATE_SYNTHETIC',
          duration,
          targetBins: 1000,
        });
      }
    });
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.cache.clear();
  }
}

export const waveformManager = new WaveformManager();

