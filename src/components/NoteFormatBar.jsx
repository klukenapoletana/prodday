import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bold, Code, Heading, IndentDecrease, IndentIncrease, Italic, List, ListChecks,
  SquareCode, Strikethrough, Underline,
} from 'lucide-react';
import { NOTE_FORMATS } from '../utils/noteFormat.js';

const ICONS = {
  bold: Bold, italic: Italic, underline: Underline, strike: Strikethrough, code: Code,
  heading: Heading, bullet: List, checklist: ListChecks,
  indent: IndentIncrease, outdent: IndentDecrease, codeblock: SquareCode,
};

/**
 * The quick-format row under a note being edited (utils/noteFormat.js), one
 * button per format the note renders. A button never takes the focus: it
 * acts on the selection where it is, and the keyboard stays up.
 */
const NoteFormatBar = ({ onFormat, darkMode }) => {
  const { t } = useTranslation();
  return (
    <div
      role="toolbar"
      aria-label={t('noteFormat.toolbar')}
      data-note-format-bar
      className={`flex items-center gap-1 overflow-x-auto px-2 py-1.5 border-t ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-stone-100 border-stone-200'
      }`}
      style={{ scrollbarWidth: 'none' }}
    >
      {NOTE_FORMATS.map((kind) => {
        const Icon = ICONS[kind];
        return (
          <button
            key={kind}
            type="button"
            data-format={kind}
            aria-label={t(`noteFormat.${kind}`)}
            title={t(`noteFormat.${kind}`)}
            // Keep the focus (and the keyboard) in the note.
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormat(kind)}
            className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg ${
              darkMode ? 'text-gray-200 active:bg-gray-700' : 'text-stone-700 active:bg-stone-200'
            }`}
          >
            <Icon size={20} />
          </button>
        );
      })}
    </div>
  );
};

export default NoteFormatBar;
