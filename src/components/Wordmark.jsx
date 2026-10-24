import React from 'react';

/**
 * prodday text wordmark.
 *
 * "prod" renders in a neutral gray that adapts to the theme; "day" is italic
 * in the pastel mint of the app icon (a deeper mint on light surfaces, where
 * the pastel itself would be too faint to read). Uses the self-hosted Lora
 * serif (see the @font-face rules in index.css). Scale is controlled by the
 * font-size passed via `className` (e.g. "text-4xl"). Pass `dayClassName` to
 * override the "prod" color (e.g. make it white on a dark surface); the prop
 * keeps its old name so every call site stays as it is.
 */
export default function Wordmark({ className = '', darkMode = false, dayClassName }) {
  const prodColor = dayClassName ?? (darkMode ? 'text-gray-200' : 'text-stone-600');
  const accentColor = darkMode ? 'text-pastel-mint' : 'text-emerald-600';
  return (
    <span className={`font-brand leading-none tracking-tight whitespace-nowrap select-none ${className}`}>
      <span className={`font-medium ${prodColor}`}>prod</span>
      <span className={`font-bold italic ${accentColor}`}>day</span>
    </span>
  );
}
