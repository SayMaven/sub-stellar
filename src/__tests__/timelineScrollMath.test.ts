import { describe, it, expect } from 'vitest';
import {
  calculateZoomScrollAnchor,
  isPointerInScrollbarZone,
} from '../engine/layout/timelineScrollMath';

describe('timelineScrollMath', () => {
  describe('calculateZoomScrollAnchor', () => {
    it('returns 0 for non-positive duration or clientWidth', () => {
      expect(
        calculateZoomScrollAnchor({
          prevZoom: 1,
          nextZoom: 2,
          clientWidth: 0,
          currentScrollLeft: 0,
          currentTime: 10,
          duration: 100,
        })
      ).toBe(0);

      expect(
        calculateZoomScrollAnchor({
          prevZoom: 1,
          nextZoom: 2,
          clientWidth: 1000,
          currentScrollLeft: 0,
          currentTime: 10,
          duration: 0,
        })
      ).toBe(0);
    });

    it('preserves exact pixel offset on screen when zooming in', () => {
      // 100s song, playhead at 50s (exact middle).
      // Screen width 1000px.
      // Zoom 1x -> playhead is at x=500px, scrollLeft=0. Offset from left edge = 500px.
      // Zoom 2x -> content width 2000px, playhead is at x=1000px.
      // Target scrollLeft = 1000 - 500 = 500px.
      // Screen offset in 2x: 1000 - 500 = 500px (exact same screen pixel!).
      const scroll2x = calculateZoomScrollAnchor({
        prevZoom: 1,
        nextZoom: 2,
        clientWidth: 1000,
        currentScrollLeft: 0,
        currentTime: 50,
        duration: 100,
      });
      expect(scroll2x).toBe(500);

      // Now zoom 2x -> 4x:
      // In 2x: playhead at 1000px, scrollLeft=500. Offset = 500px.
      // In 4x: content width 4000px, playhead at 2000px.
      // Target scrollLeft = 2000 - 500 = 1500px.
      // Screen offset in 4x: 2000 - 1500 = 500px!
      const scroll4x = calculateZoomScrollAnchor({
        prevZoom: 2,
        nextZoom: 4,
        clientWidth: 1000,
        currentScrollLeft: scroll2x,
        currentTime: 50,
        duration: 100,
      });
      expect(scroll4x).toBe(1500);
    });

    it('preserves exact pixel offset on screen when zooming out', () => {
      // Zooming out from 4x (scrollLeft=1500) back to 2x:
      const scroll2x = calculateZoomScrollAnchor({
        prevZoom: 4,
        nextZoom: 2,
        clientWidth: 1000,
        currentScrollLeft: 1500,
        currentTime: 50,
        duration: 100,
      });
      expect(scroll2x).toBe(500);

      // Zooming out from 2x (scrollLeft=500) back to 1x:
      const scroll1x = calculateZoomScrollAnchor({
        prevZoom: 2,
        nextZoom: 1,
        clientWidth: 1000,
        currentScrollLeft: scroll2x,
        currentTime: 50,
        duration: 100,
      });
      expect(scroll1x).toBe(0);
    });

    it('centers playhead when playhead was previously off-screen', () => {
      // Playhead is at 90s in 100s song.
      // At zoom 2x (content width 2000px), playhead is at x=1800px.
      // Suppose scrollLeft is 0 (playhead is off-screen since 1800 > 1000).
      // Zoom to 4x (content width 4000px), playhead is at x=3600px.
      // Since it was off-screen, target is center: 3600 - 500 = 3100px.
      // Max scroll is 4000 - 1000 = 3000px. Clamped to 3000px.
      const scroll4x = calculateZoomScrollAnchor({
        prevZoom: 2,
        nextZoom: 4,
        clientWidth: 1000,
        currentScrollLeft: 0,
        currentTime: 90,
        duration: 100,
      });
      expect(scroll4x).toBe(3000); // clamped to max
    });

    it('clamps scrollLeft between 0 and maxScroll', () => {
      // Playhead at 2s in 100s song.
      // At zoom 2x, playhead is at x=40px, scrollLeft=0, offset=40px.
      // Zoom out to 1x: newPlayheadX is 20px.
      // Target scrollLeft = 20 - 40 = -20px. Must clamp to 0!
      const scroll = calculateZoomScrollAnchor({
        prevZoom: 2,
        nextZoom: 1,
        clientWidth: 1000,
        currentScrollLeft: 0,
        currentTime: 2,
        duration: 100,
      });
      expect(scroll).toBe(0);
    });
  });

  describe('isPointerInScrollbarZone', () => {
    const mockRect = { top: 400, left: 100, bottom: 600, right: 900 };
    const clientHeight = 185; // 200 total - 15px scrollbar
    const clientWidth = 800;

    it('detects click inside horizontal scrollbar at bottom', () => {
      // Y = 590 is > top (400) + clientHeight (185) = 585
      const inScrollbar = isPointerInScrollbarZone({
        clientX: 300,
        clientY: 590,
        rect: mockRect,
        clientHeight,
        clientWidth,
      });
      expect(inScrollbar).toBe(true);
    });

    it('detects click inside track content area (not scrollbar)', () => {
      // Y = 500 is <= 585
      const inScrollbar = isPointerInScrollbarZone({
        clientX: 300,
        clientY: 500,
        rect: mockRect,
        clientHeight,
        clientWidth,
      });
      expect(inScrollbar).toBe(false);
    });

    it('detects click inside vertical scrollbar area at right', () => {
      // X = 905 is >= left (100) + clientWidth (800) = 900
      const inScrollbar = isPointerInScrollbarZone({
        clientX: 905,
        clientY: 500,
        rect: mockRect,
        clientHeight,
        clientWidth,
      });
      expect(inScrollbar).toBe(true);
    });
  });
});
