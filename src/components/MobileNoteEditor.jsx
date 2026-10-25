import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, SlidersHorizontal } from 'lucide-react';
import { useDayPlannerCtx } from '../context/DayPlannerContext.jsx';
import NotesSubtasksPanel from './NotesSubtasksPanel.jsx';
import useKeyboardInset from '../hooks/useKeyboardInset.js';
import { revealCaret } from '../utils/textareaCaret.js';

/**
 * A note open for writing (the Notes tab, utils/notes.js), over the whole
 * screen like the task editors: its title, its text and checklist, and the
 * quick-format row (NoteFormatBar) at the bottom while the text is edited.
 *
 * The keyboard: the Android shell does not resize the page for it, so the
 * editor takes the keyboard's height off its own (useKeyboardInset) and the
 * format row sits on the keyboard. The text grows with what is typed; the body
 * scrolls, with a scrollbar, and follows the caret (utils/textareaCaret.js).
 */
const MobileNoteEditor = ({ note, onClose }) => {
  const { t } = useTranslation();
  const {
    renameNote, openMobileEditTask,
    updateTaskNotes, addSubtask, toggleSubtask, deleteSubtask, updateSubtaskTitle,
    darkMode, textPrimary, textSecondary,
  } = useDayPlannerCtx();
  const keyboard = useKeyboardInset();
  const [title, setTitle] = useState(note.title || '');
  const [barTarget, setBarTarget] = useState(null);
  const bodyRef = useRef(null);

  // A title changed elsewhere (sync, the settings editor) shows here while
  // the field is not being typed in.
  const titleFocused = useRef(false);
  useEffect(() => { if (!titleFocused.current) setTitle(note.title || ''); }, [note.title]);

  // Keep the caret in view: on typing, on a format button, and when the
  // keyboard opens or closes under it.
  const follow = () => {
    const el = document.activeElement;
    if (el?.tagName === 'TEXTAREA' && bodyRef.current?.contains(el)) revealCaret(el, bodyRef.current);
  };
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const onEvent = () => requestAnimationFrame(follow);
    for (const type of ['input', 'click', 'keyup', 'focusin', 'dg-caret']) body.addEventListener(type, onEvent);
    return () => { for (const type of ['input', 'click', 'keyup', 'focusin', 'dg-caret']) body.removeEventListener(type, onEvent); };
  }, []);
  useEffect(() => { requestAnimationFrame(follow); }, [keyboard]);

  const saveTitle = () => {
    titleFocused.current = false;
    if (title.trim()) renameNote(note.id, title);
    else setTitle(note.title || '');
  };

  const pageBg = darkMode ? 'bg-gray-900' : 'bg-white';
  return (
    <div
      className={`fixed inset-x-0 top-0 z-50 flex flex-col ${pageBg}`}
      style={{ height: `calc(100% - ${keyboard}px)` }}
      data-note-editor
    >
      <div className={`flex items-center gap-1 px-2 py-2 border-b ${darkMode ? 'border-gray-700' : 'border-stone-200'}`}>
        <button
          type="button"
          onClick={onClose}
          className={`p-2 rounded-lg ${textSecondary}`}
          aria-label={t('common.back')}
          data-note-back
        >
          <ChevronLeft size={22} />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => { titleFocused.current = true; }}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          aria-label={t('task.title')}
          className={`flex-1 min-w-0 bg-transparent text-lg font-semibold outline-none ${textPrimary}`}
          data-note-title
        />
        <button
          type="button"
          onClick={() => { onClose(); openMobileEditTask(note, true); }}
          className={`p-2 rounded-lg ${textSecondary}`}
          aria-label={t('notes.settings')}
          title={t('notes.settings')}
        >
          <SlidersHorizontal size={20} />
        </button>
      </div>

      <div ref={bodyRef} className="note-editor-scroll flex-1 min-h-0 overflow-y-auto px-3 py-3" data-note-body>
        <div className={`h-1.5 w-12 rounded-full mb-3 ${note.color || ''}`} aria-hidden="true" />
        <NotesSubtasksPanel
          task={note}
          isInbox={true}
          darkMode={darkMode}
          updateTaskNotes={updateTaskNotes}
          addSubtask={addSubtask}
          toggleSubtask={toggleSubtask}
          deleteSubtask={deleteSubtask}
          updateSubtaskTitle={updateSubtaskTitle}
          compact={false}
          noAutoFocus
          fullPage
          formatBarTarget={barTarget}
        />
      </div>

      <div ref={setBarTarget} />
    </div>
  );
};

export default MobileNoteEditor;
