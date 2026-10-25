import { beforeEach, describe, expect, it, vi } from 'vitest';

const react = vi.hoisted(() => ({ slots: [], cursor: 0, effects: [] }));
vi.mock('react', () => ({
  useRef: (initial) => { const i = react.cursor++; return react.slots[i] ??= { current: initial }; },
  useEffect: (effect, deps) => {
    const i = react.cursor++;
    const slot = react.slots[i] ??= {};
    if (!slot.deps || deps.some((d, n) => d !== slot.deps[n])) {
      react.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect(); });
      slot.deps = deps;
    }
  },
}));
const native = vi.hoisted(() => ({ queue: [], acked: [] }));
vi.mock('../native.js', () => ({
  isNativeAndroid: () => true,
  nativePeekQuickAddEntries: () => native.queue.slice(),
  nativeAckQuickAddEntries: (ids) => { native.acked.push(...ids); native.queue = native.queue.filter(e => !ids.includes(e.id)); },
}));
import useQuickAddInbox from './useQuickAddInbox.js';

let inbox;
let props;
let syncing;
// As React would: a state change renders again, so the hook sees the new Inbox.
const setUnscheduledTasks = (fn) => { inbox = fn(inbox); render(); };
const render = (next) => {
  if (next) props = next;
  react.cursor = 0;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useQuickAddInbox({
    setUnscheduledTasks, defaultColor: 'bg-blue-500', unscheduledTasks: inbox, recycleBin: [],
    isSyncBusy: () => syncing, ...props,
  });
  react.effects.splice(0).forEach((run) => run());
};
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  react.slots = []; react.effects = [];
  native.queue = [{ id: 'q1', title: 'Milch kaufen', createdAt: '2026-11-01T08:00:00.000Z' }];
  native.acked = [];
  inbox = [{ id: 'old', title: 'Steuer' }];
  syncing = false;
  props = {};
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

describe('useQuickAddInbox', () => {
  it('reads nothing before the data has loaded', async () => {
    render({ dataLoaded: false });
    await flush();
    expect(inbox.map(t => t.id)).toEqual(['old']);
    expect(native.queue).toHaveLength(1);
  });

  it('adds the entries to the Inbox, and clears the queue only afterwards', async () => {
    render({ dataLoaded: true });
    await flush();
    expect(inbox.map(t => t.id)).toEqual(['old', 'q1']);
    expect(native.acked).toEqual([]); // still queued while the save happens
    await vi.advanceTimersByTimeAsync(3000);
    expect(native.acked).toEqual(['q1']);
  });

  it('read again before the ack (the app died), nothing is added twice', async () => {
    render({ dataLoaded: true });
    await flush();
    const onVisible = document.addEventListener.mock.calls.find(([type]) => type === 'visibilitychange')[1];
    onVisible();
    await flush();
    expect(inbox.map(t => t.id)).toEqual(['old', 'q1']);
  });

  it('waits for a sync cycle in flight, whose apply would replace the Inbox', async () => {
    syncing = true;
    render({ dataLoaded: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(inbox.map(t => t.id)).toEqual(['old']);
    syncing = false;
    await vi.advanceTimersByTimeAsync(200);
    expect(inbox.map(t => t.id)).toEqual(['old', 'q1']);
  });

  it('an entry the state lost after all stays queued and is added again', async () => {
    render({ dataLoaded: true });
    await flush();
    inbox = [{ id: 'old', title: 'Steuer' }]; // an apply replaced the Inbox
    render();
    await vi.advanceTimersByTimeAsync(3000);
    expect(native.acked).toEqual([]);
    expect(inbox.map(t => t.id)).toEqual(['old', 'q1']);
    await vi.advanceTimersByTimeAsync(3000);
    expect(native.acked).toEqual(['q1']);
  });

  it('an entry with nothing to add is cleared, not read forever', async () => {
    native.queue = [{ id: 'blank', title: '  ' }];
    render({ dataLoaded: true });
    await vi.advanceTimersByTimeAsync(3000);
    expect(native.acked).toEqual(['blank']);
  });
});
