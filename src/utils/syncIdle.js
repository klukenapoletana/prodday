// Entries that arrive from outside the app (the Quick add widget, files shared
// from another app) are added to the Inbox or the notes while the app starts,
// which is when a sync cycle runs. The file tier's cycle builds its payload at
// the start and replaces the task lists with the merged result at the end, so
// an entry added in between is in neither and is dropped from state (the
// vault tier merges mid-cycle writes back, sync/commitMerge.js; the file tier
// does not). Such an entry waits for the cycle to finish, and is only taken
// off its queue on the device once it has been seen in the app's state.

const POLL_MS = 200;
// A cycle that has not finished by then is stuck (a hung request): the entry
// is added anyway, and the check before acknowledging still guards it.
const MAX_WAIT_MS = 60000;

/**
 * Resolves once `isBusy()` is false (at once when it already is), or after
 * `maxMs` at the latest. Resolves true when the sync went idle.
 */
export function waitForSyncIdle(isBusy, { pollMs = POLL_MS, maxMs = MAX_WAIT_MS } = {}) {
  const busy = () => { try { return !!isBusy?.(); } catch { return false; } };
  if (!busy()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (!busy()) { clearInterval(timer); resolve(true); return; }
      if (Date.now() - started >= maxMs) { clearInterval(timer); resolve(false); }
    }, pollMs);
  });
}

/** The ids of `wanted` that are present in `list` (by task id). */
export function presentIds(list, wanted) {
  const have = new Set((list || []).map((t) => t?.id));
  return (wanted || []).filter((id) => have.has(id));
}
