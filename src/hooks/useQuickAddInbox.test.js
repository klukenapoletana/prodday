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
const setUnscheduledTasks = (fn) => { inbox = fn(inbox); };
const render = (props) => {
  react.cursor = 0;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useQuickAddInbox({ setUnscheduledTasks, defaultColor: 'bg-blue-500', ...props });
  react.effects.splice(0).forEach((run) => run());
};

beforeEach(() => {
  vi.useFakeTimers();
  react.slots = []; react.effects = [];
  native.queue = [{ id: 'q1', title: 'Milch kaufen', createdAt: '2026-11-01T08:00:00.000Z' }];
  native.acked = [];
  inbox = [{ id: 'old', title: 'Steuer' }];
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

describe('useQuickAddInbox', () => {
  it('reads nothing before the data has loaded', () => {
    render({ dataLoaded: false });
    expect(inbox.map(t => t.id)).toEqual(['old']);
    expect(native.queue).toHaveLength(1);
  });

  it('adds the entries to the Inbox, and clears the queue only afterwards', () => {
    render({ dataLoaded: true });
    expect(inbox.map(t => t.id)).toEqual(['old', 'q1']);
    expect(native.acked).toEqual([]); // still queued while the save happens
    vi.advanceTimersByTime(3000);
    expect(native.acked).toEqual(['q1']);
  });

  it('read again before the ack (the app died), nothing is added twice', () => {
    render({ dataLoaded: true });
    const onVisible = document.addEventListener.mock.calls.find(([type]) => type === 'visibilitychange')[1];
    onVisible();
    expect(inbox.map(t => t.id)).toEqual(['old', 'q1']);
  });
});
