// Entries added from outside the app (the Quick add widget, files shared from
// another app) arrive while the app starts, which is when a sync cycle runs.
// The file tier's cycle builds its payload at the start and replaces the task
// lists with the merged result at the end (applyEngineData), so an entry added
// in between is in neither, and the apply would drop it from state. The vault
// tier merges mid-cycle writes back itself (sync/commitMerge.js); the file
// tier does not.
//
// Such an entry is registered here when it is added. Until a merged result
// carries it, the apply rescues it like a device-local task
// (utils/rescueUnsyncedTasks.js, whose tombstone guard still applies), so it
// is added at once rather than after the cycle. Once a result carries it, the
// merge governs it like any other task. The registry is memory only: after a
// restart the entry is in the stored lists, and the payload carries it.

const pending = new Set();

/** Register ids just added to the task lists from outside the app. */
export function markPendingLocalAdds(ids) {
  for (const id of ids || []) if (id != null) pending.add(String(id));
}

/** Whether `task` was added from outside the app and no merge has carried it yet. */
export const isPendingLocalAdd = (task) => !!task && pending.has(String(task.id));

/** Settle the ids a merged result carries (`liveIds`, a Set of string ids). */
export function settlePendingLocalAdds(liveIds) {
  for (const id of [...pending]) if (liveIds.has(id)) pending.delete(id);
}

/** Tests only. */
export const resetPendingLocalAdds = () => pending.clear();

/**
 * The ids of `wanted` present in `list` (by task id): what the hooks check
 * before taking entries off their queue on the device.
 */
export function presentIds(list, wanted) {
  const have = new Set((list || []).map((t) => t?.id));
  return (wanted || []).filter((id) => have.has(id));
}
