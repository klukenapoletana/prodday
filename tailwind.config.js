/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // dayGLANCE wordmark (Lora, self-hosted). Georgia/serif fallback
        // renders immediately while the woff2 loads (font-display: swap).
        brand: ['Lora', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      colors: {
        // dayGLANCE brand orange (the "GLANCE" in the wordmark).
        brand: '#fe8b00',
        // The dark theme's grays read CSS variables, so the OLED theme can turn
        // them black and neutral (src/index.css, html.oled) without touching the
        // hundreds of `darkMode ? 'bg-gray-800' : …` sites. The defaults are
        // Tailwind's own grays; opacity modifiers (bg-gray-700/50) keep working.
        gray: {
          600: 'rgb(var(--gray-600) / <alpha-value>)',
          700: 'rgb(var(--gray-700) / <alpha-value>)',
          800: 'rgb(var(--gray-800) / <alpha-value>)',
          900: 'rgb(var(--gray-900) / <alpha-value>)',
          950: 'rgb(var(--gray-950) / <alpha-value>)',
        },
        // Pastel task-colour presets (TASK_COLORS in src/utils/colorUtils.js,
        // which also carries the same hex values for the widgets).
        pastel: {
          rose: '#f7c5cf',
          peach: '#fbd4b6',
          butter: '#f6e7a1',
          mint: '#bfe6cf',
          sage: '#d2e0bb',
          sky: '#bddcf4',
          peri: '#ccd1f5',
          lavender: '#dfccf1',
          sand: '#e7dccb',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
