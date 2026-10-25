// The Quick add widget (Android: widget/QuickAddWidget, widget/QuickAddActivity):
// a line typed on the home screen becomes an Inbox entry. The shell queues the
// entries; the app turns each into an Inbox task here, keyed by the entry's own
// id, so reading the same queue twice (the app died before acknowledging it)
// adds nothing twice.

/**
 * The Inbox tasks to add for `entries`: one per entry with a title, skipping
 * ids the app already has.
 */
export function quickAddToInboxTasks(entries, existingIds, { color }) {
  const seen = new Set(existingIds);
  const out = [];
  for (const entry of entries || []) {
    const id = typeof entry?.id === 'string' ? entry.id : '';
    const title = typeof entry?.title === 'string' ? entry.title.trim() : '';
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const createdAt = typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString();
    out.push({
      id,
      title,
      duration: 30,
      color,
      priority: 0,
      completed: false,
      notes: '',
      subtasks: [],
      createdAt,
      lastModified: createdAt,
    });
  }
  return out;
}
