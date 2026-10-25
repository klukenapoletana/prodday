import { beforeEach, describe, expect, it, vi } from 'vitest';

// Reminders set on a task (utils/taskReminders.js) through the real engine:
// they fire in the foreground, are handed to the native layer for the next
// 30 days whatever the global settings say, and a snooze brings the reminder
// back without moving the task.

const react = vi.hoisted(() => ({ slots: [], cursor: 0, effects: [] }));
vi.mock('react', () => ({
  useRef: (initial) => {
    const i = react.cursor++;
    return react.slots[i] ??= { current: initial };
  },
  useState: (initial) => {
    const i = react.cursor++;
    const slot = react.slots[i] ??= { value: initial };
    return [slot.value, (value) => { slot.value = typeof value === 'function' ? value(slot.value) : value; }];
  },
  useEffect: (effect, deps) => {
    const i = react.cursor++;
    const slot = react.slots[i] ??= {};
    if (!slot.deps || !deps || deps.some((d, n) => d !== slot.deps[n])) {
      react.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect(); });
      slot.deps = deps;
    }
  },
}));
const native = vi.hoisted(() => ({ synced: [], shown: [] }));
vi.mock('../native.js', () => ({
  isNativeAndroid: () => true,
  isNativeApp: () => true,
  nativeShowNotification: vi.fn(),
  nativeShowTaskNotification: (r) => native.shown.push(r),
  nativeSyncReminders: (list) => native.synced.push(list),
}));
vi.mock('../utils/trayMode.js', () => ({ isTrayMode: false }));
import useReminderEngine from './useReminderEngine.js';

const at = (s) => new Date(s);
const render = (props) => {
  react.cursor = 0;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const api = useReminderEngine({
    reminderSettings: { enabled: false, categories: {}, inAppToasts: true, hyperGlance: { enabled: false } },
    tasks: [], expandedRecurringTasks: [], recurringTasks: [], unscheduledTasks: [],
    playUISound: vi.fn(), pushUndo: vi.fn(), setTasks: vi.fn(), setRecurringTasks: vi.fn(),
    parseRecurringId: () => null, setShowWeeklyReviewReminder: vi.fn(),
    weeklyReviewDismissedRef: { current: null }, lastWeeklyReviewFiredRef: { current: null },
    ...props,
  });
  const effects = react.effects.splice(0);
  effects.forEach((run) => run());
  react.cursor = 0;
  return api;
};
const activeOf = () => react.slots[0].value;

const dentist = {
  id: 't1', title: 'Zahnarzt', date: '2026-11-20', startTime: '10:00', duration: 30, color: 'bg-blue-500',
  reminders: [{ id: 'r1', kind: 'before', minutes: 60 }],
};

beforeEach(() => {
  vi.stubGlobal('window', {});
  react.slots = []; react.effects = []; native.synced = []; native.shown = [];
});

describe('useReminderEngine: reminders set on a task', () => {
  it('hands the native layer the reminders of the next 30 days, with the global toggle off', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at('2026-11-01T08:00'));
    const inbox = { id: 'i1', title: 'Steuer', reminders: [{ id: 'r2', kind: 'at', at: '2026-11-06T17:00' }] };
    const farOff = { ...dentist, id: 't2', date: '2027-02-01' };
    render({ currentTime: at('2026-11-01T08:00'), tasks: [dentist, farOff], unscheduledTasks: [inbox] });
    const custom = native.synced.at(-1).filter((r) => r.type === 'custom');
    expect(custom.map((r) => [r.id, r.taskId, r.title, new Date(r.triggerAtMillis).getTime()])).toEqual([
      ['rem-r2-i1', 'i1', 'Steuer', at('2026-11-06T17:00').getTime()],
      ['rem-r1-t1', 't1', 'Zahnarzt', at('2026-11-20T09:00').getTime()],
    ]);
    vi.useRealTimers();
  });

  it('fires once when due, as a toast and a notification', () => {
    render({ currentTime: at('2026-11-20T09:00'), tasks: [dentist] });
    expect(activeOf()).toHaveLength(1);
    expect(activeOf()[0]).toMatchObject({ taskId: 't1', type: 'custom', taskTitle: 'Zahnarzt', startTime: '10:00' });
    expect(native.shown).toHaveLength(1);
    render({ currentTime: at('2026-11-20T09:01'), tasks: [dentist] });
    expect(native.shown).toHaveLength(1);
  });

  it('a completed task stays quiet', () => {
    render({ currentTime: at('2026-11-20T09:00'), tasks: [{ ...dentist, completed: true }] });
    expect(native.shown).toHaveLength(0);
  });

  it('snooze brings it back in 15 minutes and leaves the task alone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at('2026-11-20T09:00'));
    const setTasks = vi.fn();
    const api = render({ currentTime: at('2026-11-20T09:00'), tasks: [dentist], setTasks });
    api.snoozeReminder(activeOf()[0]);
    expect(setTasks).not.toHaveBeenCalled();
    expect(activeOf()).toHaveLength(0);
    render({ currentTime: at('2026-11-20T09:10'), tasks: [dentist], setTasks });
    expect(native.shown).toHaveLength(1);
    render({ currentTime: at('2026-11-20T09:15'), tasks: [dentist], setTasks });
    expect(native.shown).toHaveLength(2);
    expect(activeOf()).toHaveLength(1);
    vi.useRealTimers();
  });
});
