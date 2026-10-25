import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, CheckSquare, Plus, Settings, StickyNote, X } from 'lucide-react';
import { useDayPlannerCtx } from '../context/DayPlannerContext.jsx';
import { useFeaturesCtx } from '../context/FeaturesContext.jsx';
import { renderTitle } from '../utils/textFormatting.jsx';
import { isNote, notePreview, sortNotes } from '../utils/notes.js';
import NotesSubtasksPanel from './NotesSubtasksPanel.jsx';

/**
 * The Notes tab (utils/notes.js): the notes as cards, newest first, each
 * showing its first lines. A tap opens the note's text and checklist; the
 * swipes are the app's own, left to edit and right to move it to the Inbox or
 * the timeline (components/MoveToAreaSheet.jsx). The + makes a new note.
 */
const MobileNotesView = () => {
  const { t } = useTranslation();
  const {
    unscheduledTasks, openNewNote,
    handleMobileTaskTouchStart, handleMobileTaskTouchMove, handleMobileTaskTouchEnd,
    updateTaskNotes, addSubtask, toggleSubtask, deleteSubtask, updateSubtaskTitle,
    cardBg, borderClass, textPrimary, textSecondary, darkMode,
  } = useDayPlannerCtx();
  const { isVisibleForUser } = useFeaturesCtx();
  const [openNoteId, setOpenNoteId] = useState(null);

  const notes = useMemo(
    () => sortNotes((unscheduledTasks || []).filter(n => isNote(n) && !n.isExample && (isVisibleForUser ? isVisibleForUser(n) : true))),
    [unscheduledTasks, isVisibleForUser],
  );
  const openNote = notes.find(n => n.id === openNoteId);

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
              onClick={openNewNote}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white active:bg-amber-600 transition-colors"
            >
              <Plus size={16} />
              {t('notes.newNote')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map(note => {
              const preview = notePreview(note.notes);
              const subtasks = note.subtasks || [];
              const done = subtasks.filter(s => s.completed).length;
              return (
                <div key={note.id} className="notes-panel-container" data-task-id={note.id} data-note-card>
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
                      onClick={() => setOpenNoteId(note.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setOpenNoteId(note.id); }}
                      onTouchStart={(e) => handleMobileTaskTouchStart(e, note, 'note')}
                      onTouchMove={(e) => handleMobileTaskTouchMove(e)}
                      onTouchEnd={(e) => handleMobileTaskTouchEnd(e, note.id, 'note')}
                      className={`relative select-none ${note.color} rounded-lg px-3 py-3 shadow-sm text-white`}
                    >
                      <div className="font-medium text-sm">{renderTitle(note.title)}</div>
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
              );
            })}
          </div>
        )}
      </div>

      {openNote && (
        <div className="notes-panel-container fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setOpenNoteId(null)} data-note-open>
          <div className="bg-black/30 absolute inset-0" />
          <div
            className={`relative ${cardBg} rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto`}
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between p-4 border-b ${borderClass}`}>
              <div className={`font-medium ${textPrimary} truncate flex-1`}>{renderTitle(openNote.title)}</div>
              <button onClick={() => setOpenNoteId(null)} className="p-1 rounded-lg" aria-label={t('common.close')}>
                <X size={18} className={textSecondary} />
              </button>
            </div>
            <div className="p-4">
              <div className={`${openNote.color || ''} rounded-lg`}>
                <NotesSubtasksPanel
                  task={openNote}
                  isInbox={true}
                  darkMode={darkMode}
                  updateTaskNotes={updateTaskNotes}
                  addSubtask={addSubtask}
                  toggleSubtask={toggleSubtask}
                  deleteSubtask={deleteSubtask}
                  updateSubtaskTitle={updateSubtaskTitle}
                  noAutoFocus
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-40 pointer-events-none">
        <button
          onClick={openNewNote}
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
