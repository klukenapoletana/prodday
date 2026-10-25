// The theme preference (#2075, docs/settings-redesign.md "Theme: System"):
// 'light', 'dark', 'oled' (dark on true black, for OLED screens), or 'system'
// (follow the OS, live). The resolved boolean keeps living in `day-planner-darkmode`,
// because the tray popup, the subscription wall, backups and the Electron
// window colour all read it; the preference is stored beside it.
//
// No device's theme changes on update: a device that already has a stored
// light or dark keeps it as an explicit choice. Only a device with nothing
// stored (a fresh install) starts on 'system'.

export const THEME_PREF_KEY = 'day-planner-theme-pref';
export const LEGACY_DARK_KEY = 'day-planner-darkmode';
export const THEME_PREFS = ['light', 'dark', 'oled', 'system'];

export const isThemePref = (value) => THEME_PREFS.includes(value);

/** The stored preference, migrating a stored light/dark to an explicit one. */
export function readThemePref(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(THEME_PREF_KEY);
    if (isThemePref(saved)) return saved;
    const legacy = storage?.getItem(LEGACY_DARK_KEY);
    if (legacy !== null && legacy !== undefined) return JSON.parse(legacy) === true ? 'dark' : 'light';
  } catch { /* unreadable storage: follow the OS */ }
  return 'system';
}

export function systemPrefersDark(win = globalThis.window) {
  try { return !!win?.matchMedia?.('(prefers-color-scheme: dark)').matches; } catch { return false; }
}

export function resolveDarkMode(pref, systemDark) {
  return pref === 'dark' || pref === 'oled' || (pref === 'system' && !!systemDark);
}

/**
 * Whether the dark theme draws on true black. 'oled' is the dark theme with
 * its grays swapped through CSS variables (the `oled` class on <html>, see
 * index.css and tailwind.config.js), so every dark-mode reader stays as it is.
 */
export const isOledTheme = (pref) => pref === 'oled';

/** The label for a preference: Light, Dark, OLED or System. */
export function themeLabel(t, pref) {
  if (pref === 'system') return t('settings.themeSystem', 'System');
  if (pref === 'oled') return t('settings.themeOled', 'OLED');
  return pref === 'dark' ? t('settings.darkMode', 'Dark') : t('settings.lightMode', 'Light');
}

/** The mobile quick tile's cycle: Light → Dark → OLED → System → Light. */
export function nextThemePref(pref) {
  return THEME_PREFS[(THEME_PREFS.indexOf(pref) + 1) % THEME_PREFS.length] ?? 'light';
}

/**
 * What a restored backup sets the preference to: its own when it carries one,
 * else an explicit light or dark from its resolved theme; null leaves the
 * device's preference alone (a backup with no theme at all).
 */
export function restoredThemePref(data) {
  if (isThemePref(data?.themePref)) return data.themePref;
  if (data?.deviceSettings && isThemePref(data.deviceSettings[THEME_PREF_KEY])) return data.deviceSettings[THEME_PREF_KEY];
  if (data?.darkMode !== undefined) return data.darkMode ? 'dark' : 'light';
  return null;
}
