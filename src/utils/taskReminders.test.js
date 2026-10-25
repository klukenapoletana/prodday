import { describe, it, expect } from 'vitest';
import {
  normalizeReminder, remindersOf, withReminders, sameReminder, reminderTime, upcomingReminders,
} from './taskReminders.js';

const local = (s) => new Date(s); // 'YYYY-MM-DDTHH:MM' without a zone is local time
const iso = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

describe('normalizeReminder', () => {
  it('keeps the three kinds and drops anything else', () => {
    expect(normalizeReminder({ id: 'a', kind: 'before', minutes: 15, extra: 1 })).toEqual({ id: 'a', kind: 'before', minutes: 15 });
    expect(normalizeReminder({ id: 'b', kind: 'day', daysBefore: 1, time: '18:00' })).toEqual({ id: 'b', kind: 'day', daysBefore: 1, time: '18:00' });
    expect(normalizeReminder({ id: 'c', kind: 'at', at: '2026-11-06T17:00' })).toEqual({ id: 'c', kind: 'at', at: '2026-11-06T17:00' });
    for (const bad of [null, {}, { id: 'x', kind: 'before', minutes: -5 }, { id: 'x', kind: 'before', minutes: 1.5 },
      { id: 'x', kind: 'day', daysBefore: 0, time: '25:00' }, { id: 'x', kind: 'at', at: '2026-11-06' },
      { kind: 'before', minutes: 5 }, { id: 'x', kind: 'later' }]) {
      expect(normalizeReminder(bad)).toBeNull();
    }
  });

  it('remindersOf reads a missing or broken field as none', () => {
    expect(remindersOf({})).toEqual([]);
    expect(remindersOf({ reminders: 'x' })).toEqual([]);
    expect(remindersOf({ reminders: [{ id: 'a', kind: 'before', minutes: 0 }, { id: 'b' }] })).toHaveLength(1);
  });

  it('withReminders writes the list, and removes the key when it is empty', () => {
    const r = { id: 'a', kind: 'before', minutes: 0 };
    expect(withReminders({ id: 't' }, [r])).toEqual({ id: 't', reminders: [r] });
    expect(withReminders({ id: 't', reminders: [r] }, [])).toEqual({ id: 't' });
    expect('reminders' in withReminders({ id: 't' }, null)).toBe(false);
    // Not loaded is not empty: a save that never read them keeps them.
    expect(withReminders({ id: 't', reminders: [r] }, undefined)).toEqual({ id: 't', reminders: [r] });
  });

  it('sameReminder compares the moment, not the id', () => {
    expect(sameReminder({ id: 'a', kind: 'before', minutes: 5 }, { id: 'b', kind: 'before', minutes: 5 })).toBe(true);
    expect(sameReminder({ id: 'a', kind: 'before', minutes: 5 }, { id: 'b', kind: 'before', minutes: 10 })).toBe(false);
    expect(sameReminder({ id: 'a', kind: 'day', daysBefore: 0, time: '09:00' }, { id: 'b', kind: 'day', daysBefore: 0, time: '09:00' })).toBe(true);
  });
});

describe('reminderTime', () => {
  const timed = { date: '2026-11-06', startTime: '14:30', isAllDay: false };
  const allDay = { date: '2026-11-06', startTime: '00:00', isAllDay: true };

  it('before: minutes before a timed start, across midnight and days', () => {
    expect(iso(reminderTime({ id: 'a', kind: 'before', minutes: 0 }, timed))).toBe('2026-11-06T14:30');
    expect(iso(reminderTime({ id: 'a', kind: 'before', minutes: 15 }, timed))).toBe('2026-11-06T14:15');
    expect(iso(reminderTime({ id: 'a', kind: 'before', minutes: 1440 }, timed))).toBe('2026-11-05T14:30');
    expect(iso(reminderTime({ id: 'a', kind: 'before', minutes: 30 }, { date: '2026-11-06', startTime: '00:10' }))).toBe('2026-11-05T23:40');
  });

  it('before does not apply to an all-day or undated task', () => {
    expect(reminderTime({ id: 'a', kind: 'before', minutes: 5 }, allDay)).toBeNull();
    expect(reminderTime({ id: 'a', kind: 'before', minutes: 5 }, { title: 'Inbox' })).toBeNull();
  });

  it('day: on the day or days before, at a time, timed or all-day', () => {
    expect(iso(reminderTime({ id: 'a', kind: 'day', daysBefore: 0, time: '09:00' }, allDay))).toBe('2026-11-06T09:00');
    expect(iso(reminderTime({ id: 'a', kind: 'day', daysBefore: 1, time: '18:00' }, timed))).toBe('2026-11-05T18:00');
    expect(iso(reminderTime({ id: 'a', kind: 'day', daysBefore: 7, time: '08:00' }, allDay))).toBe('2026-10-30T08:00');
  });

  it('at: the fixed moment, dated or not', () => {
    expect(iso(reminderTime({ id: 'a', kind: 'at', at: '2026-12-24T17:00' }, {}))).toBe('2026-12-24T17:00');
  });
});

describe('upcomingReminders', () => {
  const from = local('2026-11-01T08:00');
  const to = local('2026-12-01T08:00');
  const rem = (id, extra) => ({ id, ...extra });

  it('collects scheduled and inbox tasks in the window, soonest first', () => {
    const list = upcomingReminders({
      tasks: [
        { id: 't1', title: 'Zahnarzt', date: '2026-11-20', startTime: '10:00', reminders: [rem('r1', { kind: 'before', minutes: 60 }), rem('r2', { kind: 'day', daysBefore: 1, time: '19:00' })] },
        { id: 't2', title: 'Vorbei', date: '2026-10-20', startTime: '10:00', reminders: [rem('r3', { kind: 'before', minutes: 0 })] },
        { id: 't3', title: 'Zu weit', date: '2027-01-20', startTime: '10:00', reminders: [rem('r4', { kind: 'before', minutes: 0 })] },
      ],
      unscheduledTasks: [{ id: 'i1', title: 'Steuer', reminders: [rem('r5', { kind: 'at', at: '2026-11-06T17:00' })] }],
      from, to,
    });
    expect(list.map((r) => [r.key, iso(new Date(r.at))])).toEqual([
      ['rem-r5-i1', '2026-11-06T17:00'],
      ['rem-r2-t1', '2026-11-19T19:00'],
      ['rem-r1-t1', '2026-11-20T09:00'],
    ]);
    expect(list[2]).toMatchObject({ taskId: 't1', title: 'Zahnarzt', startTime: '10:00', date: '2026-11-20' });
  });

  it('a completed task reminds of nothing', () => {
    expect(upcomingReminders({
      tasks: [{ id: 't', completed: true, date: '2026-11-20', startTime: '10:00', reminders: [rem('r', { kind: 'before', minutes: 0 })] }],
      from, to,
    })).toEqual([]);
  });

  it('a series reminds on every open occurrence, by instance id, with its overrides', () => {
    const template = {
      id: 's', title: 'Gießen', startTime: '08:00', isAllDay: false,
      recurrence: { type: 'weekly', daysOfWeek: [1], startDate: '2026-11-02' },
      completedDates: ['2026-11-02'],
      exceptions: { '2026-11-09': { startTime: '09:00' }, '2026-11-16': { skipped: true }, '2026-11-23': { title: 'Kakteen' } },
      reminders: [rem('r', { kind: 'before', minutes: 10 }), rem('x', { kind: 'at', at: '2026-11-03T10:00' })],
    };
    const list = upcomingReminders({ recurringTasks: [template], from, to });
    expect(list.map((r) => [r.taskId, iso(new Date(r.at)), r.title])).toEqual([
      ['recurring-s-2026-11-09', '2026-11-09T08:50', 'Gießen'],
      ['recurring-s-2026-11-23', '2026-11-23T07:50', 'Kakteen'],
      ['recurring-s-2026-11-30', '2026-11-30T07:50', 'Gießen'],
    ]);
  });

  it('a day-before reminder of an occurrence just past the window still fires inside it', () => {
    const template = {
      id: 's', title: 'Müll', isAllDay: true, recurrence: { type: 'daily', interval: 7, startDate: '2026-11-08' },
      reminders: [rem('r', { kind: 'day', daysBefore: 3, time: '18:00' })],
    };
    const list = upcomingReminders({ recurringTasks: [template], from, to: local('2026-11-06T00:00') });
    expect(list.map((r) => r.taskId)).toEqual(['recurring-s-2026-11-08']);
  });

  it('stops at the limit', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`, date: '2026-11-10', startTime: `1${i}:00`.slice(-5), reminders: [rem(`r${i}`, { kind: 'before', minutes: 0 })],
    }));
    expect(upcomingReminders({ tasks, from, to, limit: 3 })).toHaveLength(3);
  });
});
