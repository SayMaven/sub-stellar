import type { AspectRatio, CanvasResolutionPreset } from '../../types';

export const TIMELINE_MIN_HEIGHT = 120;
export const TIMELINE_DEFAULT_HEIGHT = 200;
/** Fraction of the available workspace height the timeline may occupy at most. */
export const TIMELINE_MAX_FRACTION = 0.5;
/** Workspace height (px) below which the UI switches to compact density. */
export const COMPACT_HEIGHT_THRESHOLD = 700;

/**
 * Returns the pixel width & height of the logical studio canvas for a given aspect ratio and resolution preset.
 */
export function getCanvasPixelDimensions(
  aspect: AspectRatio,
  resolution: CanvasResolutionPreset
): { width: number; height: number } {
  const shortSide =
    resolution === '4k' ? 2160 : resolution === '1440p' ? 1440 : resolution === '720p' ? 720 : 1080;

  switch (aspect) {
    case '16:9':
      return { width: Math.round((shortSide * 16) / 9), height: shortSide };
    case '9:16':
      return { width: shortSide, height: Math.round((shortSide * 16) / 9) };
    case '1:1':
      return { width: shortSide, height: shortSide };
    case '4:3':
      return { width: Math.round((shortSide * 4) / 3), height: shortSide };
  }
}

export function clampTimelineHeight(height: number, availableHeight: number): number {
  const max = Math.max(TIMELINE_MIN_HEIGHT, Math.floor(availableHeight * TIMELINE_MAX_FRACTION));
  if (!Number.isFinite(height)) return TIMELINE_DEFAULT_HEIGHT;
  return Math.min(max, Math.max(TIMELINE_MIN_HEIGHT, Math.round(height)));
}

export function aspectValue(ratio: AspectRatio): number {
  switch (ratio) {
    case '16:9':
      return 16 / 9;
    case '9:16':
      return 9 / 16;
    case '1:1':
      return 1;
    case '4:3':
      return 4 / 3;
  }
}

/** Largest box of the given aspect ratio that fits inside the area, scaled by zoom (percent). */
export function computeStageSize(
  areaWidth: number,
  areaHeight: number,
  ratio: AspectRatio,
  zoomPercent: number
): { width: number; height: number } {
  if (areaWidth <= 0 || areaHeight <= 0) return { width: 0, height: 0 };
  const a = aspectValue(ratio);
  let width = areaWidth;
  let height = width / a;
  if (height > areaHeight) {
    height = areaHeight;
    width = height * a;
  }
  const k = zoomPercent / 100;
  return { width: Math.floor(width * k), height: Math.floor(height * k) };
}

/** True when a keyboard event target is an editable control and global shortcuts must not fire. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toUpperCase();
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable === true ||
    el.getAttribute?.('role') === 'textbox'
  );
}

