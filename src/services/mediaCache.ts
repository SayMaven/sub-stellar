/**
 * Persistent Media Cache (IndexedDB) & Native Project Save/Open Helper.
 * Ensures local video/audio files remain loaded when the application is closed and reopened,
 * and provides native Windows Explorer Save / Save As / Open dialogs.
 */

import { tauriBridge } from './tauriBridge';
import { downloadFile } from '../engine/text/SubtitleExporter';

const DB_NAME = 'substellar-media-db';
const STORE_NAME = 'media-blobs';
const ACTIVE_MEDIA_KEY = 'last-active-media';
const MAX_IDB_CACHE_BYTES = 50 * 1024 * 1024; // 50 MB cap to prevent multi-GB RAM spikes in WebView2 Storage Service
let lastRestoredObjectUrl: string | null = null;

export interface CachedMediaRecord {
  blob: Blob;
  name: string;
  type: string;
  isVideo: boolean;
  savedAt: number;
}

function openMediaDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function cacheActiveMediaFile(file: File, isVideo: boolean): Promise<void> {
  if (file.size > MAX_IDB_CACHE_BYTES) {
    return;
  }
  const db = await openMediaDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: CachedMediaRecord = {
        blob: file,
        name: file.name,
        type: file.type,
        isVideo,
        savedAt: Date.now(),
      };
      store.put(record, ACTIVE_MEDIA_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function restoreCachedMediaFile(): Promise<{
  url: string;
  isVideo: boolean;
  name: string;
} | null> {
  const db = await openMediaDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(ACTIVE_MEDIA_KEY);
      req.onsuccess = () => {
        const record = req.result as CachedMediaRecord | undefined;
        db.close();
        if (record && record.blob instanceof Blob && typeof URL.createObjectURL === 'function') {
          if (lastRestoredObjectUrl && typeof URL.revokeObjectURL === 'function') {
            try {
              URL.revokeObjectURL(lastRestoredObjectUrl);
            } catch {
              // Ignore
            }
          }
          const url = URL.createObjectURL(record.blob);
          lastRestoredObjectUrl = url;
          resolve({
            url,
            isVideo: Boolean(record.isVideo),
            name: record.name || 'Cached Media',
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function clearCachedMediaFile(): Promise<void> {
  const db = await openMediaDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(ACTIVE_MEDIA_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

interface SaveFilePickerWindow {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    name: string;
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

export async function saveProjectToDisk(options: {
  json: string;
  defaultFilename: string;
  existingPath: string | null;
  forceSaveAs: boolean;
}): Promise<{ saved: boolean; path: string | null }> {
  const { json, defaultFilename, existingPath, forceSaveAs } = options;

  // 1. Native Tauri Desktop Path
  if (tauriBridge.isAvailable()) {
    let targetPath = !forceSaveAs && existingPath ? existingPath : null;
    if (!targetPath) {
      targetPath = await tauriBridge.saveProjectDialog(defaultFilename);
    }
    if (!targetPath) {
      return { saved: false, path: existingPath };
    }
    const writtenPath = await tauriBridge.writeProjectFile(targetPath, json);
    return { saved: true, path: writtenPath };
  }

  // 2. Chromium / WebView2 File System Access API (opens native Windows Explorer Save As dialog)
  const win = (typeof window !== 'undefined' ? window : undefined) as
    | (Window & SaveFilePickerWindow)
    | undefined;
  if (win && typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [
          {
            description: 'SubStellar Project (.substellar)',
            accept: { 'application/json': ['.substellar', '.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return { saved: true, path: handle.name };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { saved: false, path: existingPath };
      }
    }
  }

  // 3. Standard Browser Download Fallback
  downloadFile(defaultFilename, json, 'application/json;charset=utf-8');
  return { saved: true, path: defaultFilename };
}

