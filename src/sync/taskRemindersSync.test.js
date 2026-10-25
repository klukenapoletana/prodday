import { describe, it, expect } from 'vitest';
import { shredState, reassembleState } from './dbAdapter.js';
import { mergeSyncData } from '../mergeSync.js';
import { withReminders } from '../utils/taskReminders.js';

// Reminders are a field the user edits on the task, so they ride last-writer-
// wins with the rest of it on both tiers: no carry, no merge.

const R1 = { id: 'r1', kind: 'before', minutes: 15 };
const R2 = { id: 'r2', kind: 'day', daysBefore: 1, time: '18:00' };
const T1 = '2026-11-01T10:00:00.000Z';
const T2 = '2026-11-02T10:00:00.000Z';

const emptyData = (extra = {}) => ({
  tasks: [], unscheduledTasks: [], recycleBin: [], recurringTasks: [],
  completedTaskUids: [], deletedTaskIds: {},
  syncUrl: null, taskCalendarUrl: null,
  routineDefinitions: {}, todayRoutines: [], routinesDate: '',
  minimizedSections: {}, use24HourClock: false,
  ...extra,
});
const task = (reminders, lastModified) => withReminders(
  { id: 't1', title: 'Zahnarzt', date: '2026-11-20', startTime: '10:00', duration: 30, completed: false, lastModified },
  reminders,
);
const series = (reminders, lastModified) => withReminders({
  id: 's1', title: 'Gießen', startTime: '08:00', duration: 15,
  recurrence: { type: 'daily', interval: 3, startDate: '2026-11-01' },
  completedDates: [], exceptions: {}, lastModified,
}, reminders);

describe('file tier', () => {
  it('a reminder added on one device reaches the other, on tasks, inbox and series', () => {
    const phone = emptyData({
      tasks: [task([R1, R2], T2)],
      unscheduledTasks: [withReminders({ id: 'i1', title: 'Steuer', lastModified: T2 }, [{ id: 'r3', kind: 'at', at: '2026-11-06T17:00' }])],
      recurringTasks: [series([R1], T2)],
    });
    const pc = emptyData({
      tasks: [task(null, T1)],
      unscheduledTasks: [{ id: 'i1', title: 'Steuer', lastModified: T1 }],
      recurringTasks: [series(null, T1)],
    });
    const { data } = mergeSyncData(pc, phone);
    expect(data.tasks[0].reminders).toEqual([R1, R2]);
    expect(data.unscheduledTasks[0].reminders).toHaveLength(1);
    expect(data.recurringTasks[0].reminders).toEqual([R1]);
  });

  it('removing every reminder on the newer copy removes them everywhere', () => {
    const { data } = mergeSyncData(emptyData({ tasks: [task([R1], T1)] }), emptyData({ tasks: [task([], T2)] }));
    expect(data.tasks[0].reminders).toBeUndefined();
  });
});

describe('vault tier', () => {
  it('a task row carries its reminders through shred and reassemble', () => {
    const rows = shredState(emptyData({ tasks: [task([R1, R2], T1)], recurringTasks: [series([R2], T1)] }));
    const back = reassembleState(rows);
    expect(back.tasks[0].reminders).toEqual([R1, R2]);
    expect(back.recurringTasks[0].reminders).toEqual([R2]);
  });
});
