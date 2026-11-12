/// <reference lib="webworker" />
/**
 * Furigana worker: runs the Kuromoji morphological analyzer off the main thread.
 * The ~17 MB dictionary is loaded lazily on the first request and released when the
 * owning service terminates this worker after it has been idle for a while.
 */
import { builder } from '@sglkc/kuromoji';
import type { IpadicFeatures, Tokenizer } from '@sglkc/kuromoji';
// @ts-expect-error kuromoji internal loader
import BrowserDictionaryLoader from '@sglkc/kuromoji/src/loader/BrowserDictionaryLoader.js';
import * as fflate from 'fflate';
import type { MorphToken } from '../engine/text/furiganaAlign';

// Patch BrowserDictionaryLoader to:
// 1. Repair URLs corrupted by Kuromoji's regex (which turns http:// into http:/)
// 2. Safely handle both raw gzipped data (magic bytes 0x1f 0x8b) and buffers
//    that the browser / web server already transparently decompressed (Content-Encoding: gzip)
// 3. Chain promises and handle errors with timeouts so the worker never deadlocks
if (BrowserDictionaryLoader && BrowserDictionaryLoader.prototype) {
  BrowserDictionaryLoader.prototype.loadArrayBuffer = function (
    url: string,
    callback: (err: Error | null, buffer: ArrayBuffer | null) => void
  ) {
    const cleanUrl = url
      .replace(/^(https?):\/+([^\/])/, (_m: string, proto: string, rest: string) => `${proto}://${rest}`)
      .replace(/^(file):\/+([^\/])/, (_m: string, proto: string, rest: string) => `${proto}:///${rest}`);

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;

    fetch(cleanUrl, controller ? { signal: controller.signal } : undefined)
      .then(async (response) => {
        if (timer) clearTimeout(timer);
        if (!response.ok) {
          return callback(
            new Error(`HTTP ${response.status} ${response.statusText} loading dictionary file: ${cleanUrl}`),
            null
          );
        }
        const arraybuffer = await response.arrayBuffer();
        const uint8 = new Uint8Array(arraybuffer);
        let decompressed: Uint8Array;
        if (uint8.length >= 2 && uint8[0] === 0x1f && uint8[1] === 0x8b) {
          try {
            decompressed = fflate.gunzipSync(uint8);
          } catch (gzErr) {
            return callback(
              gzErr instanceof Error ? gzErr : new Error(`Gzip decompression failed for ${cleanUrl}`),
              null
            );
          }
        } else {
          // Already decompressed by browser or server via Content-Encoding: gzip
          decompressed = uint8;
        }
        callback(null, decompressed.buffer as ArrayBuffer);
      })
      .catch((err) => {
        if (timer) clearTimeout(timer);
        callback(err instanceof Error ? err : new Error(String(err)), null);
      });
  };
}

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
      const timeoutId = setTimeout(() => {
        tokenizerPromise = null;
        reject(
          new Error(
            'Kamus Kuromoji timeout setelah 15 detik. Periksa koneksi atau file kamus di public/dict.'
          )
        );
      }, 15000);

      builder({ dicPath }).build((err, tokenizer) => {
        clearTimeout(timeoutId);
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
    const tokens: MorphToken[][] = lines.map((line) => {
      if (line.trim().length === 0) return [];
      const rawTokens = tokenizer.tokenize(line);
      const lineTokens: MorphToken[] = [];
      let cursor = 0;
      for (const t of rawTokens) {
        const surface = t.surface_form;
        if (!surface) continue;
        const pos = line.indexOf(surface, cursor);
        if (pos !== -1) {
          if (pos > cursor) {
            lineTokens.push({ surface: line.slice(cursor, pos), reading: undefined });
          }
          lineTokens.push({ surface, reading: t.reading && t.reading !== '*' ? t.reading : undefined });
          cursor = pos + surface.length;
        } else {
          lineTokens.push({ surface, reading: t.reading && t.reading !== '*' ? t.reading : undefined });
        }
      }
      if (cursor < line.length) {
        lineTokens.push({ surface: line.slice(cursor), reading: undefined });
      }
      return lineTokens;
    });
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

