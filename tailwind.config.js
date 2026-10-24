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
