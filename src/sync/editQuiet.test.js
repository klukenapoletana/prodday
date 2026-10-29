import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INTERACTION_WINDOW_MS, MAX_HOLD_MS, QUIET_MS,
  editedDuringCycle, markCycleBuilt, markInteraction, noteDataChange, quietRemainingMs, resetEditQuiet, runWhenQuiet,
} from './editQuiet.js';

beforeEach(() => resetEditQuiet());

describe('what counts as an edit', () => {
  it('a change right after a touch or key is one', () => {
    markInteraction(1000);
    noteDataChange(1000 + INTERACTION_WINDOW_MS);
    expect(quietRemainingMs(1000 + INTERACTION_WINDOW_MS)).toBe(QUIET_MS);
  });

  it('a change nobody made by hand (a calendar refresh, startup) is not', () => {
    noteDataChange(5000);
    expect(quietRemainingMs(5000)).toBe(0);
    markInteraction(1000);
    noteDataChange(1000 + INTERACTION_WINDOW_MS + 1);
    expect(quietRemainingMs(1000 + INTERACTION_WINDOW_MS + 1)).toBe(0);
  });
});

describe('automatic cycles wait for a quiet minute', () => {
  const clock = () => {
    let t = 0;
    const timers = [];
    return {
      now: () => t,
      setTimer: (fn, ms) => { const timer = { at: t + ms, fn }; timers.push(timer); return timer; },
      clearTimer: (timer) => { const i = timers.indexOf(timer); if (i !== -1) timers.splice(i, 1); },
      advance(ms) {
        t += ms;
        for (;;) {
          const due = timers.filter(x => x.at <= t).sort((a, b) => a.at - b.at)[0];
          if (!due) break;
          timers.splice(timers.indexOf(due), 1);
          due.fn();
        }
      },
      edit() { markInteraction(t); noteDataChange(t); },
    };
  };

  it('runs at once when nothing was edited', () => {
    const c = clock();
    const run = vi.fn();
    runWhenQuiet(run, c);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs a minute after the last edit, once, however often it was asked', () => {
    const c = clock();
    const run = vi.fn();
    c.edit();
    runWhenQuiet(run, c);
    c.advance(30000);
    c.edit(); // still working: the minute starts again
    runWhenQuiet(run, c);
    c.advance(59000);
    expect(run).not.toHaveBeenCalled();
    c.advance(1000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('never holds a cycle longer than the cap, for someone who never stops', () => {
    const c = clock();
    const run = vi.fn();
    c.edit();
    runWhenQuiet(run, c);
    for (let i = 0; i < 20 && !run.mock.calls.length; i += 1) { c.advance(20000); c.edit(); }
    expect(run).toHaveBeenCalledTimes(1);
    expect(c.now()).toBeLessThanOrEqual(MAX_HOLD_MS);
  });
});

describe('a cycle during which something was edited', () => {
  it('is told apart from one that ran undisturbed', () => {
    markCycleBuilt(1000);
    expect(editedDuringCycle()).toBe(false);
    markInteraction(1500);
    noteDataChange(1500);
    expect(editedDuringCycle()).toBe(true);
    markCycleBuilt(2000); // the next cycle builds from the edited state
    expect(editedDuringCycle()).toBe(false);
  });
});
