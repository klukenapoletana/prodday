import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Inbox, StickyNote, X } from 'lucide-react';
import { useDayPlannerCtx } from '../context/DayPlannerContext.jsx';
import { renderTitle } from '../utils/textFormatting.jsx';

const AREAS = {
  timeline: { Icon: Calendar, label: 'common.timeline' },
  inbox: { Icon: Inbox, label: 'settings.inbox' },
  notes: { Icon: StickyNote, label: 'notes.title' },
};
const ORDER = ['inbox', 'timeline', 'notes'];

/**
 * The sheet a right swipe on an entry opens (useDragDrop's moveMenu): the two
 * areas it is not in, Inbox, timeline or notes (utils/notes.js). Sending one
 * to the timeline opens the editor to pick its day, as scheduling an Inbox
 * entry always has.
 */
const MoveToAreaSheet = () => {
  const { t } = useTranslation();
  const {
    moveMenu, setMoveMenu, scheduleUnscheduledTask,
    moveToInbox, moveToNotes, moveNoteToInbox,
    tasks, unscheduledTasks,
    cardBg, borderClass, textPrimary, textSecondary, darkMode,
  } = useDayPlannerCtx();
  if (!moveMenu) return null;

  const { taskId, from } = moveMenu;
  const task = (from === 'timeline' ? tasks : unscheduledTasks).find(x => x.id === taskId);
  const close = () => setMoveMenu(null);
  if (!task) return null;

  const go = (to) => {
    close();
    if (to === 'timeline') scheduleUnscheduledTask(taskId);
    else if (to === 'notes') moveToNotes(taskId);
    else if (from === 'notes') moveNoteToInbox(taskId);
    else moveToInbox(taskId);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={close} data-move-sheet>
      <div className="bg-black/30 absolute inset-0" />
      <div
        className={`relative ${cardBg} rounded-t-2xl shadow-xl`}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t('notes.moveTo')}
      >
        <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${borderClass}`}>
          <div className="min-w-0">
            <div className={`text-xs ${textSecondary}`}>{t('notes.moveTo')}</div>
            <div className={`font-medium ${textPrimary} truncate`}>{renderTitle(task.title)}</div>
          </div>
          <button onClick={close} className={`p-1 rounded-lg ${textSecondary}`} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4">
          {ORDER.filter(area => area !== from).map(area => {
            const { Icon, label } = AREAS[area];
            return (
              <button
                key={area}
                type="button"
                onClick={() => go(area)}
                data-move-to={area}
                className={`flex flex-col items-center justify-center gap-2 py-5 rounded-xl border ${borderClass} ${
                  darkMode ? 'bg-gray-700 text-gray-100 active:bg-gray-600' : 'bg-stone-50 text-stone-800 active:bg-stone-100'
                }`}
              >
                <Icon size={26} className="text-blue-500" />
                <span className="text-sm font-medium">{t(label)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MoveToAreaSheet;
