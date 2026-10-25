import { describe, it, expect, vi } from 'vitest';
import { markOrphans, sweepOrphans, readOrphans, ORPHAN_GRACE_MS } from './attachmentOrphans.js';

const memoryStorage = () => {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
};
const T0 = 1_800_000_000_000;

describe('attachment orphans', () => {
  it('deletes a marked file only after the grace, and only when nothing refers to it', async () => {
    const storage = memoryStorage();
    markOrphans(['a', 'b', 'c'], { storage, now: T0 });
    const remove = vi.fn(async () => {});
    // Too early: nothing goes.
    expect(await sweepOrphans({ referenced: new Set(), remove, storage, now: T0 + 1000 })).toEqual([]);
    // 'b' came back (an undo, a sync): its mark is dropped, its file kept.
    const removed = await sweepOrphans({ referenced: new Set(['b']), remove, storage, now: T0 + ORPHAN_GRACE_MS + 1 });
    expect(removed.sort()).toEqual(['a', 'c']);
    expect(remove).not.toHaveBeenCalledWith('b');
    expect(readOrphans(storage)).toEqual({});
  });

  it('a failed delete stays marked for the next sweep', async () => {
    const storage = memoryStorage();
    markOrphans(['a'], { storage, now: T0 });
    const remove = vi.fn(async () => { throw new Error('io'); });
    expect(await sweepOrphans({ referenced: new Set(), remove, storage, now: T0 + ORPHAN_GRACE_MS + 1 })).toEqual([]);
    expect(Object.keys(readOrphans(storage))).toEqual(['a']);
  });

  it('marking again keeps the first time', () => {
    const storage = memoryStorage();
    markOrphans(['a'], { storage, now: T0 });
    markOrphans(['a'], { storage, now: T0 + 5000 });
    expect(readOrphans(storage)).toEqual({ a: T0 });
  });
});
