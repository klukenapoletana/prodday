import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { applyRemoteEntity, shredState, reassembleState, BUNDLE_OWNS } from './dbAdapter.js';
import { mergeSyncData } from '../mergeSync.js';
import {
  savedColorsForSync, applyRemoteSavedColors, resetSavedColorsCache,
} from '../hooks/useSavedColors.js';
import { SAVED_COLORS_KEY, SAVED_COLORS_UPDATED_KEY } from '../utils/customColors.js';

// The colours saved from the colour wheel sync as one list, last writer wins
// by customColorsUpdatedAt, on both tiers (the rule icsCalendars follows).
// Per-user when multi-user is on.

const A = ['#7ab3e0', '#f7c5cf'];
const B = ['#3d405b'];
const T1 = '2026-10-01T10:00:00.000Z';
const T2 = '2026-10-02T10:00:00.000Z';

const emptyData = () => ({
  tasks: [], unscheduledTasks: [], recycleBin: [], recurringTasks: [],
  completedTaskUids: [], deletedTaskIds: {},
  syncUrl: null, taskCalendarUrl: null,
  routineDefinitions: {}, todayRoutines: [], routinesDate: '',
  minimizedSections: {}, use24HourClock: false,
});
const withColors = (colors, at, extra = {}) => ({ ...emptyData(), customColors: colors, customColorsUpdatedAt: at, ...extra });

describe('file tier — mergeSyncData', () => {
  it('the newer list wins in both directions', () => {
    expect(mergeSyncData(withColors(A, T2), withColors(B, T1)).data.customColors).toEqual(A);
    expect(mergeSyncData(withColors(A, T1), withColors(B, T2)).data.customColors).toEqual(B);
    expect(mergeSyncData(withColors(A, T1), withColors(B, T2)).data.customColorsUpdatedAt).toBe(T2);
  });

  it('the remote wins a tie, as on the vault tier', () => {
    expect(mergeSyncData(withColors(A, T1), withColors(B, T1)).data.customColors).toEqual(B);
  });

  it('survives a remote written before the slice existed, and heals it', () => {
    const { data, remoteChanged } = mergeSyncData(withColors(A, T1), emptyData());
    expect(data.customColors).toEqual(A);
    expect(remoteChanged).toBe(true);
  });

  it('a removal (shorter list, newer stamp) propagates, an emptied list too', () => {
    expect(mergeSyncData(withColors(['#7ab3e0'], T2), withColors(A, T1)).data.customColors).toEqual(['#7ab3e0']);
    expect(mergeSyncData(withColors([], T2), withColors(A, T1)).data.customColors).toEqual([]);
  });

  it('flags the apply when the remote list wins, and nothing when both agree', () => {
    expect(mergeSyncData(withColors(A, T1), withColors(B, T2)).localChanged).toBe(true);
    const same = mergeSyncData(withColors([...A], T1), withColors([...A], T1));
    expect(same.localChanged).toBe(false);
    expect(same.remoteChanged).toBe(false);
  });

  it('multi-user keeps this device\'s own list whatever the stamps', () => {
    const local = withColors(A, T1, { multiUserEnabled: true });
    const remote = withColors(B, T2, { multiUserEnabled: true });
    const { data } = mergeSyncData(local, remote);
    expect(data.customColors).toEqual(A);
    expect(data.customColorsUpdatedAt).toBe(T1);
  });
});

describe('vault tier — customColors singleton bundle', () => {
  const pull = (data, colors, at) => applyRemoteEntity(data, {
    _kind: 'singleton', _key: 'customColors', value: colors, _extra: { customColorsUpdatedAt: at },
  });

  it('owns its stamp, so a row carries both', () => {
    expect(BUNDLE_OWNS.customColors).toEqual(['customColorsUpdatedAt']);
    const rows = shredState(withColors(A, T1));
    const row = rows.find((r) => r.kind === 'singleton' && r.entity?._key === 'customColors');
    expect(row.entity.value).toEqual(A);
    expect(row.entity._extra).toEqual({ customColorsUpdatedAt: T1 });
    expect(rows.some((r) => r.entity?._key === 'customColorsUpdatedAt')).toBe(false);
    expect(reassembleState(rows).customColors).toEqual(A);
  });

  it('a newer pulled list wins; an older one loses and our newer list is pushed back', () => {
    const data = withColors(A, T1);
    expect(pull(data, B, T2)).toEqual([]);
    expect(data.customColors).toEqual(B);
    expect(data.customColorsUpdatedAt).toBe(T2);

    const mine = withColors(A, T2);
    expect(pull(mine, B, T1)).not.toEqual([]); // re-push the winner
    expect(mine.customColors).toEqual(A);
  });

  it('multi-user keeps the local list and never re-pushes it', () => {
    const data = withColors(A, T1, { multiUserEnabled: true });
    expect(pull(data, B, T2)).toEqual([]);
    expect(data.customColors).toEqual(A);
  });
});

// Two devices sharing one sync file, each with its own storage. The colour
// store is module-level, so switching devices swaps the storage and forgets
// the cached list, as a fresh page load would.
describe('save → push → merge → apply across two devices', () => {
  const devices = { phone: new Map(), pc: new Map() };
  const use = (name) => {
    const map = devices[name];
    globalThis.localStorage = {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); },
      removeItem: (k) => { map.delete(k); },
    };
    resetSavedColorsCache();
  };
  const payload = () => {
    const { colors, updatedAt } = savedColorsForSync();
    return withColors(colors, updatedAt);
  };

  beforeEach(() => { devices.phone.clear(); devices.pc.clear(); });
  afterEach(() => { delete globalThis.localStorage; resetSavedColorsCache(); });

  it('a colour saved on the phone reaches the PC, and the PC\'s apply does not restamp it', () => {
    use('phone');
    localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(A));
    localStorage.setItem(SAVED_COLORS_UPDATED_KEY, T2);
    const file = mergeSyncData(payload(), emptyData()).data; // phone pushes

    use('pc');
    const merged = mergeSyncData(payload(), file);
    expect(merged.localChanged).toBe(true);
    applyRemoteSavedColors(merged.data.customColors, merged.data.customColorsUpdatedAt);
    expect(JSON.parse(localStorage.getItem(SAVED_COLORS_KEY))).toEqual(A);
    expect(localStorage.getItem(SAVED_COLORS_UPDATED_KEY)).toBe(T2);

    // The next cycle on the PC is quiet: nothing to apply, nothing to push.
    const again = mergeSyncData(payload(), merged.data);
    expect(again.localChanged).toBe(false);
    expect(again.remoteChanged).toBe(false);
  });

  it('colours saved before the slice synced are stamped on first read, so an empty device cannot wipe them', () => {
    use('phone');
    localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(A)); // no stamp: saved before sync
    const phone = payload();
    expect(phone.customColorsUpdatedAt).toEqual(expect.any(String));

    use('pc'); // never saved a colour: empty and unstamped
    const pcFile = payload();
    expect(pcFile).toMatchObject({ customColors: [], customColorsUpdatedAt: null });
    expect(mergeSyncData(phone, pcFile).data.customColors).toEqual(A);
  });

  it('applying the same list twice writes nothing the second time', () => {
    use('pc');
    applyRemoteSavedColors(A, T1);
    let writes = 0;
    const set = localStorage.setItem;
    localStorage.setItem = (k, v) => { writes += 1; set(k, v); };
    applyRemoteSavedColors(A, T1);
    expect(writes).toBe(0);
  });
});
