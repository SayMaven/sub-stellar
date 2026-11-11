/// <reference lib="webworker" />
/**
 * Furigana worker: runs the Kuromoji morphological analyzer off the main thread.
 * The ~17 MB dictionary is loaded lazily on the first request and released when the
 * owning service terminates this worker after it has been idle for a while.
 */
import { builder } from '@sglkc/kuromoji';
import type { IpadicFeatures, Tokenizer } from '@sglkc/kuromoji';
import type { MorphToken } from '../engine/text/furiganaAlign';

export type FuriganaWorkerRequest = {
  id: number;
  type: 'ANALYZE';
  dicPath: string;
  lines: string[];
};

export type FuriganaWorkerResponse =
  | { id: number; type: 'RESULT'; tokens: MorphToken[][] }
  | { id: number; type: 'ERROR'; message: string };

let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | null = null;

function loadTokenizer(dicPath: string): Promise<Tokenizer<IpadicFeatures>> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      builder({ dicPath }).build((err, tokenizer) => {
        if (err || !tokenizer) {
          tokenizerPromise = null;
          reject(err instanceof Error ? err : new Error(String(err ?? 'Kuromoji build failed')));
          return;
        }
        resolve(tokenizer);
      });
    });
  }
  return tokenizerPromise;
}

self.onmessage = async (event: MessageEvent<FuriganaWorkerRequest>) => {
  const { id, type, dicPath, lines } = event.data;
  if (type !== 'ANALYZE') return;
  try {
    const tokenizer = await loadTokenizer(dicPath);
    const tokens: MorphToken[][] = lines.map((line) =>
      line.trim().length === 0
        ? []
        : tokenizer.tokenize(line).map((t) => ({ surface: t.surface_form, reading: t.reading }))
    );
    const response: FuriganaWorkerResponse = { id, type: 'RESULT', tokens };
    (self as unknown as Worker).postMessage(response);
  } catch (err) {
    const response: FuriganaWorkerResponse = {
      id,
      type: 'ERROR',
      message: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(response);
  }
};

