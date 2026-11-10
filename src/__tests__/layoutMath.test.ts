import { describe, it, expect } from 'vitest';
import {
  clampTimelineHeight,
  computeStageSize,
  isEditableTarget,
  TIMELINE_MIN_HEIGHT,
  TIMELINE_DEFAULT_HEIGHT,
} from '../engine/layout/layoutMath';

describe('layoutMath', () => {
  it('clamps timeline height between min and half of workspace', () => {
    expect(clampTimelineHeight(10, 800)).toBe(TIMELINE_MIN_HEIGHT);
    expect(clampTimelineHeight(900, 800)).toBe(400);
    expect(clampTimelineHeight(250, 800)).toBe(250);
    expect(clampTimelineHeight(NaN, 800)).toBe(TIMELINE_DEFAULT_HEIGHT);
  });

  it('never returns below min on tiny workspaces', () => {
    expect(clampTimelineHeight(500, 100)).toBe(TIMELINE_MIN_HEIGHT);
  });

  it('fits stage by aspect ratio and scales with zoom', () => {
    expect(computeStageSize(1600, 900, '16:9', 100)).toEqual({ width: 1600, height: 900 });
    expect(computeStageSize(1600, 600, '16:9', 100)).toEqual({ width: 1066, height: 600 });
    expect(computeStageSize(1000, 1000, '9:16', 100).width).toBe(562);
    expect(computeStageSize(1000, 500, '1:1', 200)).toEqual({ width: 1000, height: 1000 });
    expect(computeStageSize(0, 0, '16:9', 100)).toEqual({ width: 0, height: 0 });
  });

  it('detects editable shortcut targets', () => {
    const mk = (tagName: string, extra: Record<string, unknown> = {}) =>
      ({ tagName, isContentEditable: false, getAttribute: () => null, ...extra }) as unknown as EventTarget;
    expect(isEditableTarget(mk('INPUT'))).toBe(true);
    expect(isEditableTarget(mk('SELECT'))).toBe(true);
    expect(isEditableTarget(mk('DIV', { isContentEditable: true }))).toBe(true);
    expect(isEditableTarget(mk('BUTTON'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

