import { describe, it, expect } from 'vitest';
import { SNAP_MINUTES, LAST_SNAPPED_START, snapMinutes, minutesToTimeStr } from './dragUtils.js';

// The grid a task snaps to on the timelines (drag, resize, click or tap to add).

describe('snapMinutes', () => {
  it('rounds to the nearest SNAP_MINUTES step', () => {
    expect(SNAP_MINUTES).toBe(5);
    expect(snapMinutes(0)).toBe(0);
    expect(snapMinutes(2)).toBe(0);
    expect(snapMinutes(3)).toBe(5);
    expect(snapMinutes(52)).toBe(50);
    expect(snapMinutes(53)).toBe(55);
    expect(snapMinutes(-7)).toBe(-5);
  });

  it('keeps every snapped value on the grid', () => {
    for (let m = 0; m < 24 * 60; m += 7) expect(snapMinutes(m) % SNAP_MINUTES).toBe(0);
  });

  it('last snapped start is one step before midnight', () => {
    expect(minutesToTimeStr(LAST_SNAPPED_START)).toBe('23:55');
  });
});
