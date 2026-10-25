import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isCustomColor } from '../utils/customColors.js';
import useSavedColors from '../hooks/useSavedColors.js';
import ColorWheelModal from './ColorWheelModal.jsx';

/**
 * The free colours in a task's colour picker, after the presets: the saved
 * ones (and the task's own, when it carries one that is not saved), then the
 * button that opens the colour wheel. Rendered inside the picker's own grid or
 * row, so it takes the presets' swatch size through `swatchClass`.
 *
 * @param {{ value: string, onSelect: (hex: string) => void, swatchClass: string,
 *   selectedClass?: string, darkMode: boolean }} props
 */
export default function CustomColorSwatches({ value, onSelect, swatchClass, selectedClass = '', darkMode }) {
  const { t } = useTranslation();
  const { saved } = useSavedColors();
  const [wheelOpen, setWheelOpen] = useState(false);
  const own = isCustomColor(value) && !saved.includes(value) ? [value] : [];

  return (
    <>
      {[...own, ...saved].map((hex) => (
        <button
          type="button"
          key={hex}
          onClick={() => onSelect(hex)}
          title={hex}
          aria-label={hex}
          data-custom-swatch={hex}
          className={`${swatchClass} ${value === hex ? selectedClass : ''}`}
          style={{ backgroundColor: hex }}
        />
      ))}
      <button
        type="button"
        onClick={() => setWheelOpen(true)}
        title={t('colorWheel.open')}
        aria-label={t('colorWheel.open')}
        data-open-color-wheel
        className={`${swatchClass} flex items-center justify-center`}
        style={{ background: 'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
      >
        <span className="w-1/2 h-1/2 rounded-full bg-white/90 flex items-center justify-center text-stone-700">
          <Plus size={12} strokeWidth={3} />
        </span>
      </button>
      {wheelOpen && (
        <ColorWheelModal
          initial={isCustomColor(value) ? value : null}
          darkMode={darkMode}
          onClose={() => setWheelOpen(false)}
          onApply={(hex) => { setWheelOpen(false); onSelect(hex); }}
        />
      )}
    </>
  );
}
