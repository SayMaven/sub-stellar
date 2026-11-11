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
const ACTIVE_PROJECT_HANDLE_KEY = 'last-project-file-handle';
const MAX_IDB_CACHE_BYTES = 350 * 1024 * 1024; // 350 MB cap so standard HD music videos dropped via drag-and-drop remain cached across restarts
let lastRestoredObjectUrl: string | null = null;
let activeProjectFileHandle: FileSystemFileHandleLike | null = null;

export interface CachedMediaRecord {
  blob: Blob;
  name: string;
  type: string;
  isVideo: boolean;
  savedAt: number;
}

interface FileSystemWritableFileStreamLike {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}

interface FileSystemFileHandleLike {
  name: string;
  getFile?: () => Promise<File>;
  createWritable: () => Promise<FileSystemWritableFileStreamLike>;
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

interface FilePickerWindow {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandleLike>;
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandleLike[]>;
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

async function cacheProjectHandle(handle: FileSystemFileHandleLike): Promise<void> {
  activeProjectFileHandle = handle;
  const db = await openMediaDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, ACTIVE_PROJECT_HANDLE_KEY);
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

async function getCachedProjectHandle(): Promise<FileSystemFileHandleLike | null> {
  if (activeProjectFileHandle) {
    return activeProjectFileHandle;
  }
  const db = await openMediaDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(ACTIVE_PROJECT_HANDLE_KEY);
      req.onsuccess = () => {
        db.close();
        const handle = (req.result as FileSystemFileHandleLike | undefined) ?? null;
        if (handle && typeof handle.createWritable === 'function') {
          activeProjectFileHandle = handle;
          resolve(handle);
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

export async function clearCachedProjectHandle(): Promise<void> {
  activeProjectFileHandle = null;
  const db = await openMediaDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(ACTIVE_PROJECT_HANDLE_KEY);
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

export async function openProjectWithFilePicker(): Promise<{
  path: string;
  contents: string;
} | null> {
  const win = (typeof window !== 'undefined' ? window : undefined) as
    | (Window & FilePickerWindow)
    | undefined;
  if (!win || typeof win.showOpenFilePicker !== 'function') {
    return null;
  }
  try {
    const handles = await win.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'SubStellar Project (.substellar)',
          accept: { 'application/json': ['.substellar', '.json'] },
        },
      ],
    });
    const handle = handles?.[0];
    if (!handle || typeof handle.getFile !== 'function') {
      return null;
    }
    const file = await handle.getFile();
    const contents = await file.text();
    await cacheProjectHandle(handle);
    return { path: handle.name || file.name, contents };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { path: '', contents: '' };
    }
    return null;
  }
}

export async function saveProjectToDisk(options: {
  json: string;
  defaultFilename: string;
  existingPath: string | null;
  forceSaveAs: boolean;
}): Promise<{ saved: boolean; path: string | null }> {
  const { json, defaultFilename, existingPath, forceSaveAs } = options;
  const normalizedExisting = existingPath && existingPath.trim().length > 0 ? existingPath.trim() : null;

  // 1. Native Tauri Desktop Path
  if (tauriBridge.isAvailable()) {
    let targetPath = !forceSaveAs && normalizedExisting ? normalizedExisting : null;
    if (!targetPath) {
      const suggested = normalizedExisting
        ? normalizedExisting.split(/[/\\]/).pop() || defaultFilename
        : defaultFilename;
      targetPath = await tauriBridge.saveProjectDialog(suggested);
    }
    if (!targetPath) {
      return { saved: false, path: normalizedExisting };
    }
    const writtenPath = await tauriBridge.writeProjectFile(targetPath, json);
    return { saved: true, path: writtenPath };
  }

  // 2. Chromium / WebView2 File System Access API
  const win = (typeof window !== 'undefined' ? window : undefined) as
    | (Window & FilePickerWindow)
    | undefined;
  if (win && typeof win.showSaveFilePicker === 'function') {
    // Reuse existing FileSystemFileHandle on normal Save (Ctrl+S) without opening Save As dialog!
    if (!forceSaveAs && normalizedExisting) {
      const existingHandle = await getCachedProjectHandle();
      if (existingHandle) {
        try {
          if (typeof existingHandle.queryPermission === 'function') {
            let perm = await existingHandle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted' && typeof existingHandle.requestPermission === 'function') {
              perm = await existingHandle.requestPermission({ mode: 'readwrite' });
            }
          }
          const writable = await existingHandle.createWritable();
          await writable.write(json);
          await writable.close();
          return { saved: true, path: existingHandle.name || normalizedExisting };
        } catch {
          // If the handle was invalidated or file moved, fall through to Save As picker
        }
      }
    }

    try {
      const suggested = normalizedExisting
        ? normalizedExisting.split(/[/\\]/).pop() || defaultFilename
        : defaultFilename;
      const handle = await win.showSaveFilePicker({
        suggestedName: suggested,
        types: [
          {
            description: 'SubStellar Project (.substellar)',
            accept: { 'application/json': ['.substellar', '.json'] },
          },
        ],
      });
      await cacheProjectHandle(handle);
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return { saved: true, path: handle.name };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { saved: false, path: normalizedExisting };
      }
    }
  }

  // 3. Standard Browser Download Fallback
  const fallbackName = normalizedExisting
    ? normalizedExisting.split(/[/\\]/).pop() || defaultFilename
    : defaultFilename;
  downloadFile(fallbackName, json, 'application/json;charset=utf-8');
  return { saved: true, path: fallbackName };
}

export async function saveExportTextToDisk(options: {
  content: string;
  defaultFilename: string;
  ext: 'ass' | 'srt';
  targetPath?: string | null;
}): Promise<{ saved: boolean; path: string | null }> {
  const { content, defaultFilename, ext, targetPath } = options;

  // 1. Native Tauri Desktop Path
  if (tauriBridge.isAvailable()) {
    let chosenPath = targetPath && targetPath.trim() ? targetPath.trim() : null;
    if (!chosenPath) {
      chosenPath = await tauriBridge.exportSaveDialog(defaultFilename, ext);
    }
    if (!chosenPath) {
      return { saved: false, path: null };
    }
    const writtenPath = await tauriBridge.writeProjectFile(chosenPath, content);
    return { saved: true, path: writtenPath };
  }

  // 2. Chromium / WebView2 File System Access API
  const win = (typeof window !== 'undefined' ? window : undefined) as
    | (Window & FilePickerWindow)
    | undefined;
  if (win && typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [
          {
            description:
              ext === 'ass'
                ? 'Advanced SubStation Alpha (.ass)'
                : 'SubRip Subtitle (.srt)',
            accept: { 'text/plain': [`.${ext}`] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return { saved: true, path: handle.name };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { saved: false, path: null };
      }
    }
  }

  // 3. Standard Browser Download Fallback
  downloadFile(defaultFilename, content, 'text/plain;charset=utf-8');
  return { saved: true, path: defaultFilename };
}
