import { describe, it, expect, vi } from 'vitest';
import { presentIds, waitForSyncIdle } from './syncIdle.js';

describe('waitForSyncIdle', () => {
  it('resolves at once when no cycle runs', async () => {
    await expect(waitForSyncIdle(() => false)).resolves.toBe(true);
    await expect(waitForSyncIdle(undefined)).resolves.toBe(true);
  });

  it('waits for the cycle, and gives up on one that never ends', async () => {
    vi.useFakeTimers();
    let busy = true;
    const done = vi.fn();
    waitForSyncIdle(() => busy).then(done);
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).not.toHaveBeenCalled();
    busy = false;
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toHaveBeenCalledWith(true);

    const stuck = vi.fn();
    waitForSyncIdle(() => true, { maxMs: 5000 }).then(stuck);
    await vi.advanceTimersByTimeAsync(5200);
    expect(stuck).toHaveBeenCalledWith(false);
    vi.useRealTimers();
  });

  it('a check that throws counts as idle', async () => {
    await expect(waitForSyncIdle(() => { throw new Error('x'); })).resolves.toBe(true);
  });
});

describe('presentIds', () => {
  it('keeps the wanted ids the list has', () => {
    expect(presentIds([{ id: 'a' }, { id: 'b' }], ['b', 'c'])).toEqual(['b']);
    expect(presentIds(undefined, ['a'])).toEqual([]);
  });
});
