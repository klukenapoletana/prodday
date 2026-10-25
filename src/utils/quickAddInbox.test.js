import { describe, it, expect } from 'vitest';
import { quickAddToInboxTasks } from './quickAddInbox.js';

describe('quickAddToInboxTasks', () => {
  const entries = [
    { id: 'q1', title: '  Milch kaufen ', createdAt: '2026-11-01T08:00:00.000Z' },
    { id: 'q2', title: 'Arzt anrufen', createdAt: '2026-11-01T08:05:00.000Z' },
  ];

  it('makes one Inbox task per entry, keyed by the entry', () => {
    const tasks = quickAddToInboxTasks(entries, [], { color: 'bg-blue-500' });
    expect(tasks).toEqual([
      expect.objectContaining({ id: 'q1', title: 'Milch kaufen', color: 'bg-blue-500', priority: 0, duration: 30, createdAt: '2026-11-01T08:00:00.000Z' }),
      expect.objectContaining({ id: 'q2', title: 'Arzt anrufen' }),
    ]);
    expect(tasks[0].isNote).toBeUndefined();
  });

  it('reading the same queue again adds nothing twice', () => {
    expect(quickAddToInboxTasks(entries, ['q1', 'q2'], { color: 'x' })).toEqual([]);
    expect(quickAddToInboxTasks([...entries, entries[0]], [], { color: 'x' }).map(t => t.id)).toEqual(['q1', 'q2']);
  });

  it('skips broken entries', () => {
    expect(quickAddToInboxTasks([{ id: 'a', title: '   ' }, { title: 'ohne id' }, null], [], { color: 'x' })).toEqual([]);
  });
});
