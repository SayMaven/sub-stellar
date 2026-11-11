/**
 * Furigana service: lazily spawns the Kuromoji worker and terminates it after a period of
 * inactivity so the dictionary memory is returned to the system (low-end friendly).
 */
import type { MorphToken } from '../engine/text/furiganaAlign';
import type {
  FuriganaWorkerRequest,
  FuriganaWorkerResponse,
} from '../workers/furigana.worker';

export const FURIGANA_IDLE_TIMEOUT_MS = 30_000;
const BATCH_SIZE = 50;

interface Pending {
  resolve: (tokens: MorphToken[][]) => void;
  reject: (error: Error) => void;
}

export class FuriganaService {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private seq = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  private resolveDicPath(): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/dict/`;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('../workers/furigana.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<FuriganaWorkerResponse>) => {
      const data = event.data;
      const entry = this.pending.get(data.id);
      if (!entry) return;
      this.pending.delete(data.id);
      if (data.type === 'RESULT') {
        entry.resolve(data.tokens);
      } else {
        entry.reject(
          new Error(
            `Kamus furigana gagal dimuat (${data.message}). Jalankan "npm install" agar kamus tersalin ke public/dict.`
          )
        );
      }
      this.scheduleIdleStop();
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Furigana worker error');
      for (const entry of this.pending.values()) entry.reject(error);
      this.pending.clear();
      this.stop();
    };
    this.worker = worker;
    return worker;
  }

  private scheduleIdleStop(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.pending.size === 0) this.stop();
    }, FURIGANA_IDLE_TIMEOUT_MS);
  }

  /** Analyzes up to a few dozen lines in one worker round trip. */
  public analyze(lines: string[]): Promise<MorphToken[][]> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    return new Promise((resolve, reject) => {
      let worker: Worker;
      try {
        worker = this.ensureWorker();
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject });
      const request: FuriganaWorkerRequest = {
        id,
        type: 'ANALYZE',
        dicPath: this.resolveDicPath(),
        lines,
      };
      worker.postMessage(request);
    });
  }

  /** Analyzes many lines in batches, reporting progress and honoring cancellation. */
  public async analyzeAll(
    lines: string[],
    options: { onProgress?: (done: number, total: number) => void; signal?: { cancelled: boolean } } = {}
  ): Promise<Array<MorphToken[] | null>> {
    const out: Array<MorphToken[] | null> = [];
    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      if (options.signal?.cancelled) {
        while (out.length < lines.length) out.push(null);
        break;
      }
      const chunk = lines.slice(i, i + BATCH_SIZE);
      const tokens = await this.analyze(chunk);
      out.push(...tokens);
      options.onProgress?.(Math.min(lines.length, i + chunk.length), lines.length);
    }
    return out;
  }

  public get isRunning(): boolean {
    return this.worker !== null;
  }

  public stop(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.worker?.terminate();
    this.worker = null;
  }
}

export const furiganaService = new FuriganaService();

