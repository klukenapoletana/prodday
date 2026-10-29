import { describe, it, expect, vi } from 'vitest';
import useTaskActions from './useTaskActions.js';
import { notBucketed } from '../utils/bucketList.js';

// The Notes area (utils/notes.js) through the real actions: a scheduled task
// or an Inbox entry becomes a note, a note goes back to the Inbox, and a new
// note is saved as one. useTaskActions is a plain factory, called directly.
const build = ({ tasks = [], unscheduled = [], newTask } = {}) => {
  const state = { tasks, unscheduled };
  const deps = {
    tasks, unscheduledTasks: unscheduled, recurringTasks: [],
    setTasks: vi.fn(fn => { state.tasks = fn(state.tasks); }),
    setUnscheduledTasks: vi.fn(fn => { state.unscheduled = fn(state.unscheduled); }),
    setRecurringTasks: vi.fn(),
    pushUndo: vi.fn(() => 'said'), setUndoToast: vi.fn(), playUISound: vi.fn(),
    setSyncNotification: vi.fn(), setShowAddTask: vi.fn(), setNewTask: vi.fn(), setShowRecurrencePicker: vi.fn(),
    onboardingProgress: { hasUsedActionButtons: true, hasCreatedRecurring: true, hasDraggedToTimeline: true }, setOnboardingProgress: vi.fn(),
    selectedDate: new Date('2026-11-01T12:00:00'),
    newTask, colors: [{ class: 'bg-blue-500' }], goals: [], addProject: vi.fn(),
    swipeSchedulingInboxTaskId: { current: null },
    getAdjustedTimeForImportedConflicts: () => ({ conflicted: false, adjustedStartTime: '09:00' }),
  };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return { actions: useTaskActions(deps), state, deps };
};

describe('notes actions', () => {
  it('a scheduled task becomes a note: off the timeline, out of the Inbox', () => {
    const { actions, state, deps } = build({ tasks: [{ id: 't', title: 'Idee', date: '2026-11-01', startTime: '10:00', duration: 30, notes: 'x' }] });
    actions.moveToNotes('t');
    expect(state.tasks).toEqual([]);
    expect(state.unscheduled).toHaveLength(1);
    expect(state.unscheduled[0]).toMatchObject({ id: 't', title: 'Idee', notes: 'x', isNote: true, date: null, startTime: null });
    expect(notBucketed(state.unscheduled[0])).toBe(false);
    expect(deps.pushUndo).toHaveBeenCalledWith({ key: 'toNotes', taskId: 't' });
  });

  it('an Inbox entry becomes a note and back, dropping its deadline on the way', () => {
    const { actions, state } = build({ unscheduled: [{ id: 'i', title: 'Liste', deadline: '2026-11-05', priority: 2 }] });
    actions.moveToNotes('i');
    expect(state.unscheduled[0]).toMatchObject({ id: 'i', isNote: true });
    expect(state.unscheduled[0].deadline).toBeUndefined();
    const again = build({ unscheduled: state.unscheduled });
    again.actions.moveNoteToInbox('i');
    expect(again.state.unscheduled[0].isNote).toBeUndefined();
    expect(notBucketed(again.state.unscheduled[0])).toBe(true);
  });

  it('a series occurrence or a calendar event is not made a note', () => {
    const { actions, state } = build({ tasks: [{ id: 'e', title: 'Termin', imported: true, date: '2026-11-01' }] });
    actions.moveToNotes('e');
    actions.moveToNotes('recurring-s-2026-11-01');
    expect(state.tasks).toHaveLength(1);
    expect(state.unscheduled).toEqual([]);
  });

  it('a new note from the Notes tab is saved as a note', () => {
    const { actions, state } = build({ newTask: { title: 'Einkauf', isNote: true, openInInbox: true, duration: 30, priority: 0, deadline: null } });
    actions.addTask(true);
    expect(state.unscheduled).toHaveLength(1);
    expect(state.unscheduled[0]).toMatchObject({ title: 'Einkauf', isNote: true });
  });
});

describe('a new note from the full-screen editor', () => {
  it('is made with what was written first, once', () => {
    const { actions, state, deps } = build();
    actions.createNote('d1', { title: 'Reise', notes: '**Pass**' });
    expect(state.unscheduled).toEqual([expect.objectContaining({ id: 'd1', title: 'Reise', notes: '**Pass**', isNote: true, color: 'bg-blue-500', subtasks: [] })]);
    expect(notBucketed(state.unscheduled[0])).toBe(false);
    expect(deps.pushUndo).toHaveBeenCalledWith({ key: 'added', title: 'Reise' });
    // A second call in the same moment adds nothing.
    actions.createNote('d1', { notes: 'anders' });
    expect(state.unscheduled).toHaveLength(1);
    expect(state.unscheduled[0].notes).toBe('**Pass**');
  });

  it('may start without a title', () => {
    const { actions, state } = build();
    actions.createNote('d2', { title: '', subtasks: [{ id: 's', title: 'Milch', completed: false }] });
    expect(state.unscheduled[0]).toMatchObject({ id: 'd2', title: '', subtasks: [{ title: 'Milch' }] });
  });
});

describe('pinning', () => {
  it('pins a note and unpins it again, with an undo step', () => {
    const { actions, state, deps } = build({ unscheduled: [{ id: 'n', title: 'Liste', isNote: true }] });
    actions.togglePinNote('n');
    expect(state.unscheduled[0].pinned).toBe(true);
    expect(deps.pushUndo).toHaveBeenCalledWith({ key: 'pinned', taskId: 'n' });
    const again = build({ unscheduled: state.unscheduled });
    again.actions.togglePinNote('n');
    expect('pinned' in again.state.unscheduled[0]).toBe(false);
    expect(again.deps.pushUndo).toHaveBeenCalledWith({ key: 'unpinned', taskId: 'n' });
  });

  it('leaves an Inbox entry alone', () => {
    const { actions, state } = build({ unscheduled: [{ id: 'i', title: 'Steuer' }] });
    actions.togglePinNote('i');
    expect(state.unscheduled[0].pinned).toBeUndefined();
  });
});
