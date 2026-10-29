// The file tier (WebDAV/Nextcloud) and the edits made while it runs.
//
// A cycle builds its payload from local state at its start and, seconds later,
// applies the merged result over the task lists whole (applyEngineData). An
// edit made in between, a checklist reordered or a block moved on the
// timeline, is in neither, and the apply puts the old order back. The vault
// tier merges mid-cycle writes back itself (sync/commitMerge.js); the file
// tier does not.
//
// Two rules close it:
//   - QUIET: the automatic cycles (the poll, the return to the app, the one
//     after an edit) wait until nothing has been edited for QUIET_MS, so a
//     cycle rarely starts while someone is working. A cycle is held at most
//     MAX_HOLD_MS, so a device that keeps changing cannot starve the sync.
//     "Sync now" is not held.
//   - NO STALE APPLY: a cycle during which an edit was made does not apply its
//     result. The edit itself arms the next cycle, which builds from the
//     edited state; the edit's newer stamp wins that merge, and the remote
//     changes this cycle carried arrive with it.
//
// An "edit" is a change of the synced data that follows a touch, click or key
// within INTERACTION_WINDOW_MS (hooks/useCloudSyncAfterEdit.js reports both).
// A change nobody made by hand, a calendar refresh or the startup's own
// housekeeping, is not one: it would hold the sync, and skip the first apply,
// with nobody working.

export const QUIET_MS = 60 * 1000;
export const MAX_HOLD_MS = 5 * 60 * 1000;
export const INTERACTION_WINDOW_MS = 3000;

let lastEditAt = -Infinity;
let lastInteractionAt = -Infinity;
let cycleBuiltAt = 0;
let heldSince = null;
let heldRun = null;
let heldTimer = null;

/** A touch, click or key in the app. */
export function markInteraction(now = Date.now()) {
  lastInteractionAt = now;
}

/** The synced data changed (not by a cycle's apply): an edit if someone just acted. */
export function noteDataChange(now = Date.now()) {
  if (now - lastInteractionAt <= INTERACTION_WINDOW_MS) lastEditAt = now;
}

/** How long until nothing has been edited for QUIET_MS (0: quiet now). */
export function quietRemainingMs(now = Date.now()) {
  return Math.max(0, lastEditAt + QUIET_MS - now);
}

/**
 * Run `run` (an automatic cycle) once edits have been quiet for QUIET_MS:
 * at once when they are, else later, the latest request replacing an earlier
 * one held. Held at most MAX_HOLD_MS from the first request held.
 */
export function runWhenQuiet(run, { now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const t = now();
  if (heldSince === null) heldSince = t;
  const wait = Math.min(quietRemainingMs(t), Math.max(0, heldSince + MAX_HOLD_MS - t));
  if (heldTimer) { clearTimer(heldTimer); heldTimer = null; }
  if (wait === 0) {
    heldSince = null;
    heldRun = null;
    run();
    return;
  }
  heldRun = run;
  heldTimer = setTimer(() => {
    heldTimer = null;
    const next = heldRun;
    heldRun = null;
    // Edits since may have moved the quiet point: ask again.
    if (next) runWhenQuiet(next, { now, setTimer, clearTimer });
  }, wait);
}

/** The file tier built its payload: the cycle's local state is as of now. */
export function markCycleBuilt(now = Date.now()) {
  cycleBuiltAt = now;
}

/** Whether a local edit was made after the running cycle built its payload. */
export const editedDuringCycle = () => lastEditAt > cycleBuiltAt;

/** Tests only. */
export function resetEditQuiet() {
  lastEditAt = -Infinity;
  lastInteractionAt = -Infinity;
  cycleBuiltAt = 0;
  heldSince = null;
  heldRun = null;
  if (heldTimer) clearTimeout(heldTimer);
  heldTimer = null;
}
