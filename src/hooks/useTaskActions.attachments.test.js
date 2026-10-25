import { describe, it, expect, vi, beforeEach } from 'vitest';
import useTaskActions from './useTaskActions.js';
import { parseRecurringId } from '../utils/recurringId.js';
import { recurringTaskInstance } from '../utils/expandRecurringTasks.js';
import { readOrphans } from '../utils/attachmentOrphans.js';
import { mergeSyncData } from '../mergeSync.js';

const IMG = { id: 'a1', name: 'foto.jpg', mime: 'image/jpeg', kind: 'image', size: 300000 };
const PDF = { id: 'a2', name: 'beleg.pdf', mime: 'application/pdf', kind: 'pdf', size: 80000 };

const memoryStorage = () => {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
};
beforeEach(() => { globalThis.localStorage = memoryStorage(); });

const build = ({ tasks = [], unscheduled = [], recurring = [], newTask } = {}) => {
  const state = { tasks, unscheduled, recurring };
  const deps = {
    tasks, unscheduledTasks: unscheduled, recurringTasks: recurring, parseRecurringId,
    setTasks: vi.fn(fn => { state.tasks = fn(state.tasks); }),
    setUnscheduledTasks: vi.fn(fn => { state.unscheduled = fn(state.unscheduled); }),
    setRecurringTasks: vi.fn(fn => { state.recurring = fn(state.recurring); }),
    pushUndo: vi.fn(() => 'said'), setUndoToast: vi.fn(), playUISound: vi.fn(),
    setSyncNotification: vi.fn(), setShowAddTask: vi.fn(), setNewTask: vi.fn(), setShowRecurrencePicker: vi.fn(),
    onboardingProgress: { hasUsedActionButtons: true, hasCreatedRecurring: true, hasDraggedToTimeline: true }, setOnboardingProgress: vi.fn(),
    selectedDate: new Date('2026-11-01T12:00:00'),
    getAdjustedTimeForImportedConflicts: () => ({ conflicted: false, adjustedStartTime: '09:00' }),
    newTask, colors: [{ class: 'bg-blue-500' }], goals: [], addProject: vi.fn(),
    swipeSchedulingInboxTaskId: { current: null },
  };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return { actions: useTaskActions(deps), state };
};

describe('attachments on tasks', () => {
  it('writes the list to a scheduled task, an Inbox entry and a series template', () => {
    const { actions, state } = build({
      tasks: [{ id: 't', title: 'Zahnarzt' }],
      unscheduled: [{ id: 'i', title: 'Steuer' }],
      recurring: [{ id: 's', title: 'Gießen', recurrence: { type: 'daily', startDate: '2026-11-01' } }],
    });
    actions.updateTaskAttachments('t', [IMG], false);
    actions.updateTaskAttachments('i', [PDF], true);
    actions.updateTaskAttachments('recurring-s-2026-11-03', [IMG, PDF], false);
    expect(state.tasks[0].attachments).toEqual([IMG]);
    expect(state.unscheduled[0].attachments).toEqual([PDF]);
    expect(state.recurring[0].attachments).toEqual([IMG, PDF]);
    expect(state.recurring[0].lastModified).toEqual(expect.any(String));
    // Every occurrence shows the series' attachments.
    expect(recurringTaskInstance(state.recurring[0], '2026-11-05').attachments).toEqual([IMG, PDF]);
  });

  it('a removed attachment is only marked: its file goes later, if nothing needs it', () => {
    const { actions, state } = build({ tasks: [{ id: 't', title: 'Zahnarzt', attachments: [IMG, PDF] }] });
    actions.updateTaskAttachments('t', [PDF], false);
    expect(state.tasks[0].attachments).toEqual([PDF]);
    expect(Object.keys(readOrphans())).toEqual(['a1']);
    actions.updateTaskAttachments('t', [], false);
    expect('attachments' in state.tasks[0]).toBe(false);
  });

  it('a new task keeps the attachments added before it was saved', () => {
    const { actions, state } = build({ newTask: { title: 'Rechnung', openInInbox: true, duration: 30, priority: 0, attachments: [PDF] } });
    actions.addTask(true);
    expect(state.unscheduled[0].attachments).toEqual([PDF]);
  });

  it('the list rides with the task through the file-tier merge', () => {
    const empty = { tasks: [], unscheduledTasks: [], recycleBin: [], recurringTasks: [], completedTaskUids: [], deletedTaskIds: {}, routineDefinitions: {}, todayRoutines: [], routinesDate: '', minimizedSections: {} };
    const local = { ...empty, tasks: [{ id: 't', title: 'Zahnarzt', lastModified: '2026-11-01T10:00:00Z' }] };
    const remote = { ...empty, tasks: [{ id: 't', title: 'Zahnarzt', attachments: [IMG], lastModified: '2026-11-02T10:00:00Z' }] };
    expect(mergeSyncData(local, remote).data.tasks[0].attachments).toEqual([IMG]);
  });
});
