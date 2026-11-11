/**
 * SubStellar - Timeline Scroll & Zoom Anchor Math
 *
 * Pure functions for calculating pixel-stable scroll positions when zooming,
 * and identifying scrollbar interaction zones to isolate scrolling from scrubbing.
 */

export interface ZoomAnchorParams {
  prevZoom: number;
  nextZoom: number;
  clientWidth: number;
  currentScrollLeft: number;
  currentTime: number;
  duration: number;
}

/**
 * Calculates the new `scrollLeft` when timeline zoom changes.
 *
 * If the playhead was visible in the viewport before zoom, its exact pixel distance
 * from the viewport's left edge is preserved (0px visual jump).
 * If the playhead was off-screen, it is centered in the viewport.
 */
export function calculateZoomScrollAnchor(params: ZoomAnchorParams): number {
  const { prevZoom, nextZoom, clientWidth, currentScrollLeft, currentTime, duration } = params;

  if (duration <= 0 || clientWidth <= 0 || nextZoom <= 0 || prevZoom <= 0) {
    return 0;
  }

  const oldTotalW = clientWidth * prevZoom;
  const oldPlayheadX = (currentTime / duration) * oldTotalW;
  const oldOffsetInView = oldPlayheadX - currentScrollLeft;

  const newTotalW = clientWidth * nextZoom;
  const newPlayheadX = (currentTime / duration) * newTotalW;

  let targetScrollLeft: number;
  // If playhead was inside the visible viewport, preserve its relative screen offset
  if (oldOffsetInView >= 0 && oldOffsetInView <= clientWidth) {
    targetScrollLeft = newPlayheadX - oldOffsetInView;
  } else {
    // If playhead was outside the screen, bring it to the center of the viewport
    targetScrollLeft = newPlayheadX - clientWidth / 2;
  }

  const maxScroll = Math.max(0, newTotalW - clientWidth);
  return Math.max(0, Math.min(maxScroll, Math.round(targetScrollLeft)));
}

export interface ScrollbarZoneParams {
  clientX: number;
  clientY: number;
  rect: { top: number; left: number; bottom: number; right: number };
  clientHeight: number;
  clientWidth: number;
}

/**
 * Detects whether a pointer event occurred in the native scrollbar area
 * (either horizontal scrollbar at bottom, or vertical scrollbar at right).
 */
export function isPointerInScrollbarZone(params: ScrollbarZoneParams): boolean {
  const { clientX, clientY, rect, clientHeight, clientWidth } = params;
  const isHorizontalScrollbar = clientY >= rect.top + clientHeight;
  const isVerticalScrollbar = clientX >= rect.left + clientWidth;
  return isHorizontalScrollbar || isVerticalScrollbar;
}

