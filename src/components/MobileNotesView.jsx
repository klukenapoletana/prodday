import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, CheckSquare, FileText, Pencil, Pin, PinOff, Plus, Settings, StickyNote, Trash2 } from 'lucide-react';
import { useDayPlannerCtx } from '../context/DayPlannerContext.jsx';
import { useFeaturesCtx } from '../context/FeaturesContext.jsx';
import { renderTitle } from '../utils/textFormatting.jsx';
import { isNote, notePreview, sortNotes } from '../utils/notes.js';
import MobileNoteEditor from './MobileNoteEditor.jsx';

/**
 * A note's menu, opened by holding it (or a right click): the actions the
 * Inbox and timeline menus offer, as they apply to a note, and pinning.
 */
const NoteContextMenu = ({ menu, onClose, actions }) => {
  const { t } = useTranslation();
  const { cardBg, borderClass, textPrimary, hoverBg } = useDayPlannerCtx();
  const { note, x, y } = menu;
  const items = [
    { key: 'pin', Icon: note.pinned ? PinOff : Pin, label: t(note.pinned ? 'notes.unpin' : 'notes.pin'), run: actions.pin },
    { key: 'open', Icon: FileText, label: t('notes.open'), run: actions.open },
    { key: 'edit', Icon: Pencil, label: t('common.edit'), run: actions.edit },
    { key: 'move', Icon: ArrowRightLeft, label: t('notes.moveTo'), run: actions.move },
    { key: 'delete', Icon: Trash2, label: t('common.delete'), run: actions.remove, danger: true },
  ];
  const width = 200;
  const height = items.length * 40 + 8;
  const left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - height - 8));
  return (
    <div className="fixed inset-0 z-[70]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} data-note-menu>
      <div
        className={`absolute ${cardBg} rounded-lg shadow-xl border ${borderClass} py-1`}
        style={{ left, top, width }}
        onClick={(e) => e.stopPropagation()}
        role="menu"
      >
        {items.map(({ key, Icon, label, run, danger }) => (
          <button
            key={key}
            type="button"
            role="menuitem"
            data-note-menu-item={key}
            onClick={() => { onClose(); run(note); }}
            className={`w-full text-left px-3 py-2.5 text-sm ${danger ? 'text-red-500' : textPrimary} ${hoverBg} transition-colors flex items-center gap-2`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * The Notes tab (utils/notes.js): the notes as cards, pinned ones first and
 * then the rest, newest first, each showing its first lines. A tap opens the
 * note; holding it opens its menu (NoteContextMenu); the swipes are the app's
 * own, left to edit and right to move it to the Inbox or the timeline
 * (components/MoveToAreaSheet.jsx). The + makes a new note.
 */
const MobileNotesView = () => {
  const { t } = useTranslation();
  const {
    unscheduledTasks, openNewNote, showAddTask,
    handleMobileTaskTouchStart, handleMobileTaskTouchMove, handleMobileTaskTouchEnd,
    togglePinNote, openMobileEditTask, setMoveMenu, moveToRecycleBin,
    textPrimary, textSecondary, darkMode,
  } = useDayPlannerCtx();
  const [menu, setMenu] = useState(null);
  // Holding a card opens its menu; the tap that ends the hold must not open
  // the note as well.
  const menuOpenedAt = useRef(0);
  const openMenu = (e, note) => {
    e.preventDefault();
    menuOpenedAt.current = Date.now();
    setMenu({ note, x: e.clientX, y: e.clientY });
  };
  const menuActions = {
    pin: (note) => togglePinNote(note.id),
    open: (note) => setOpenNoteId(note.id),
    edit: (note) => openMobileEditTask(note, true),
    move: (note) => setMoveMenu({ taskId: note.id, from: 'notes' }),
    remove: (note) => moveToRecycleBin(note.id, true),
  };
  const { isVisibleForUser } = useFeaturesCtx();
  const [openNoteId, setOpenNoteId] = useState(null);

  const notes = useMemo(
    () => sortNotes((unscheduledTasks || []).filter(n => isNote(n) && !n.isExample && (isVisibleForUser ? isVisibleForUser(n) : true))),
    [unscheduledTasks, isVisibleForUser],
  );
  const openNote = notes.find(n => n.id === openNoteId);
  const pinnedCount = notes.filter(n => n.pinned).length;

  // The + names a new note in the editor; once it is saved, it opens here
  // for writing. The ids known when + was pressed tell the new one apart.
  const awaitingNewRef = useRef(null);
  const startNewNote = () => {
    awaitingNewRef.current = new Set(notes.map(n => n.id));
    openNewNote();
  };
  useEffect(() => {
    const known = awaitingNewRef.current;
    if (!known || showAddTask) return;
    awaitingNewRef.current = null;
    const created = notes.find(n => !known.has(n.id));
    if (created) setOpenNoteId(created.id);
  }, [notes, showAddTask]);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col" data-notes-view>
      <div data-notes-list className="px-4 pt-3 pb-24 mobile-tab-fade-in flex-1 min-h-0 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className={`w-16 h-16 rounded-2xl ${darkMode ? 'bg-amber-500/15' : 'bg-amber-50'} flex items-center justify-center mb-4`}>
              <StickyNote size={28} className={darkMode ? 'text-amber-400' : 'text-amber-500'} />
            </div>
            <p className={`text-base font-semibold ${textPrimary} mb-1`}>{t('notes.empty')}</p>
            <p className={`text-sm ${textSecondary} text-center mb-5`}>{t('notes.emptyHint')}</p>
            <button
              onClick={startNewNote}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white active:bg-amber-600 transition-colors"
            >
              <Plus size={16} />
              {t('notes.newNote')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note, i) => {
              const preview = notePreview(note.notes);
              // Headings only where they tell the groups apart.
              const heading = pinnedCount > 0 && pinnedCount < notes.length && (i === 0 || i === pinnedCount)
                ? t(i === 0 ? 'notes.pinned' : 'notes.others')
                : null;
              const subtasks = note.subtasks || [];
              const done = subtasks.filter(s => s.completed).length;
              return (
                <React.Fragment key={note.id}>
                {heading && (
                  <div className={`text-xs font-semibold uppercase tracking-wide ${textSecondary} ${i === 0 ? '' : 'pt-3'} px-1`} data-notes-heading>
                    {heading}
                  </div>
                )}
                <div className="notes-panel-container" data-task-id={note.id} data-note-card data-pinned={note.pinned ? 'true' : undefined}>
                  <div className="relative rounded-lg overflow-hidden">
                    <div data-swipe-strip="right" style={{ display: 'none' }} className={`absolute inset-0 ${darkMode ? 'bg-blue-900/80 text-blue-300' : 'bg-blue-100 text-blue-600'} rounded-lg flex items-center pl-3 text-xs font-medium`}>
                      <ArrowRightLeft size={14} className="mr-1" />{t('notes.move')}
                    </div>
                    <div data-swipe-strip="left" style={{ display: 'none' }} className={`absolute inset-0 ${darkMode ? 'bg-amber-900/80 text-amber-300' : 'bg-amber-100 text-amber-600'} rounded-lg flex items-center justify-end pr-3 text-xs font-medium`}>
                      {t('common.edit')}<Settings size={14} className="ml-1" />
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => { if (Date.now() - menuOpenedAt.current > 600) setOpenNoteId(note.id); }}
                      onContextMenu={(e) => openMenu(e, note)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setOpenNoteId(note.id); }}
                      onTouchStart={(e) => handleMobileTaskTouchStart(e, note, 'note')}
                      onTouchMove={(e) => handleMobileTaskTouchMove(e)}
                      onTouchEnd={(e) => handleMobileTaskTouchEnd(e, note.id, 'note')}
                      className={`relative select-none ${note.color} rounded-lg px-3 py-3 shadow-sm text-white`}
                    >
                      <div className="font-medium text-sm flex items-start gap-1.5">
                        <span className="flex-1 min-w-0">{renderTitle(note.title)}</span>
                        {note.pinned && <Pin size={13} className="flex-shrink-0 mt-0.5 opacity-80" aria-label={t('notes.pinned')} />}
                      </div>
                      {preview && (
                        <div className="text-xs opacity-90 mt-1 whitespace-pre-line line-clamp-3">{preview}</div>
                      )}
                      {subtasks.length > 0 && (
                        <div className="text-[11px] opacity-90 mt-1.5 flex items-center gap-1">
                          <CheckSquare size={11} />{done}/{subtasks.length}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {openNote && <MobileNoteEditor note={openNote} onClose={() => setOpenNoteId(null)} />}
      {menu && <NoteContextMenu menu={menu} onClose={() => setMenu(null)} actions={menuActions} />}

      <div className="absolute bottom-4 right-4 z-40 pointer-events-none">
        <button
          onClick={startNewNote}
          className="pointer-events-auto w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 active:bg-blue-800 flex items-center justify-center transition-colors"
          aria-label={t('notes.newNote')}
          title={t('notes.newNote')}
          data-new-note
        >
          <Plus size={28} />
        </button>
      </div>
    </div>
  );
};

export default MobileNotesView;
