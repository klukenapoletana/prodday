import React from 'react';
import { useDayPlannerCtx } from '../context/DayPlannerContext.jsx';
import { parseRecurringId } from '../utils/recurringId.js';
import { attachmentsOf } from '../utils/attachments.js';
import AttachmentsField from './AttachmentsField.jsx';

/**
 * The task editors' Attachments field: on a task that exists (being edited,
 * or an Inbox task being scheduled) it reads and writes that task's list at
 * once, as the notes panel does, a series' on its template; on a new task it
 * fills the draft, which the save takes over (useTaskActions addTaskFrom).
 */
const TaskAttachmentsField = () => {
  const {
    newTask, setNewTask, mobileEditingTask, mobileEditIsInbox,
    tasks, unscheduledTasks, recurringTasks, updateTaskAttachments,
    darkMode, textSecondary, borderClass,
  } = useDayPlannerCtx();

  const editingId = mobileEditingTask?.id ?? newTask.schedulingFromInboxId ?? null;
  let live = null;
  let isInbox = false;
  if (editingId) {
    const parsed = typeof editingId === 'string' && editingId.startsWith('recurring-') ? parseRecurringId(editingId) : null;
    if (parsed) live = recurringTasks.find(t => t.id === parsed.templateId) || null;
    else {
      const inbox = unscheduledTasks.find(t => t.id === editingId);
      isInbox = !!inbox || (!!mobileEditingTask && mobileEditIsInbox);
      live = inbox || tasks.find(t => t.id === editingId) || null;
    }
  }

  const attachments = live ? attachmentsOf(live) : attachmentsOf(newTask);
  const onChange = live
    ? (list) => updateTaskAttachments(editingId, list, isInbox)
    : (list) => setNewTask(prev => ({ ...prev, attachments: list }));

  return (
    <AttachmentsField
      attachments={attachments}
      onChange={onChange}
      darkMode={darkMode}
      textSecondary={textSecondary}
      borderClass={borderClass}
    />
  );
};

export default TaskAttachmentsField;
