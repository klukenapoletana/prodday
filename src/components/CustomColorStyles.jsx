import React, { useMemo } from 'react';
import { customColorCss, isCustomColor } from '../utils/customColors.js';
import useSavedColors from '../hooks/useSavedColors.js';

/** Every free colour the user's own tasks, series and saved list carry. */
export function collectCustomColors(lists, saved = []) {
  const out = new Set(saved.filter(isCustomColor));
  for (const list of lists) {
    for (const item of list || []) {
      // Calendar imports draw their own colour (nativeCalendarColor); only the
      // user's own items are filled from here.
      if (!item || item.imported) continue;
      if (isCustomColor(item.color)) out.add(item.color);
      for (const ex of Object.values(item.exceptions || {})) {
        if (isCustomColor(ex?.color)) out.add(ex.color);
      }
    }
  }
  return [...out].sort();
}

/**
 * The rules that fill the free colours (utils/customColors.js). A card names
 * its colour as a class, as it does a preset, so the cards themselves do not
 * know the difference; this stylesheet is what makes "#7ab3e0" a fill.
 */
export default function CustomColorStyles({ tasks, unscheduledTasks, recurringTasks }) {
  const { saved } = useSavedColors();
  const css = useMemo(
    () => customColorCss(collectCustomColors([tasks, unscheduledTasks, recurringTasks], saved)),
    [tasks, unscheduledTasks, recurringTasks, saved],
  );
  return css ? <style data-custom-colors>{css}</style> : null;
}
