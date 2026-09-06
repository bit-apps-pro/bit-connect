/**
 * Theme mode: the one place that decides whether the UI is painted dark.
 *
 * There are three modes, not two. "system" is a real, persisted choice rather
 * than the absence of one: a visitor who never touches the control should keep
 * following their OS as it flips at sunset, and collapsing that to a boolean at
 * first load freezes them into whichever value the OS happened to report then.
 * So the stored value is the *mode* and the boolean is derived on every read.
 *
 * Both the admin panel and the portal use this, which is why it lives in
 * `frontend/shared`: the portal's toggle and the admin's have to agree on the
 * stored shape or a visitor who is also an admin gets two different answers out
 * of the same browser.
 *
 * Everything here is written to survive a server render, where there is no
 * `window`, no `matchMedia` and no `document`. The portal is prerendered, so
 * this module is evaluated in Node during the build.
 */

export type ThemeMode = 'dark' | 'light' | 'system'

const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system']

/** The class Tailwind's `darkMode: 'class'` looks for (see tailwind.config.mjs). */
export const DARK_CLASS = 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export const isThemeMode = (value: unknown): value is ThemeMode =>
  typeof value === 'string' && (THEME_MODES as string[]).includes(value)

/**
 * Whether the OS currently asks for dark.
 *
 * Falls back to light off the browser: a server render has no visitor to ask,
 * and light is the value the markup is styled for, so guessing dark would flash
 * every visitor who is actually on light.
 */
export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(DARK_QUERY).matches
}

/** The boolean the UI actually renders from. */
export function resolveIsDark(mode: ThemeMode, prefersDark = systemPrefersDark()): boolean {
  if (mode === 'system') return prefersDark
  return mode === 'dark'
}

/**
 * Calls back whenever the OS preference changes; returns an unsubscribe.
 *
 * Subscribed unconditionally rather than only while the mode is "system" — the
 * listener is free, and gating it means the first flip after a visitor switches
 * back to "system" is missed until something else re-renders.
 */
const noop = () => {
  /* nothing to unsubscribe */
}

export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return noop

  const query = window.matchMedia(DARK_QUERY)
  const handler = (event: MediaQueryListEvent) => onChange(event.matches)

  query.addEventListener('change', handler)
  return () => query.removeEventListener('change', handler)
}

/**
 * Paints the decision onto `<html>`.
 *
 * Two things are set, and both matter. The class is what every `dark:` Tailwind
 * utility keys off. `color-scheme` is what the *browser* keys off, and without
 * it form controls, scrollbars and the canvas behind the page stay light — the
 * white flash between panels that no amount of CSS reaches.
 */
export function applyThemeToDocument(isDark: boolean, root?: HTMLElement): void {
  const element = root ?? (typeof document === 'undefined' ? undefined : document.documentElement)
  if (!element) return

  element.classList.toggle(DARK_CLASS, isDark)
  element.style.colorScheme = isDark ? 'dark' : 'light'
}

/**
 * Reads the mode out of the persisted app-config blob.
 *
 * The blob is shared with unrelated preferences and is written by
 * `atomWithStorage`, so it can be absent, malformed, or from a build before
 * this field existed. Every one of those means "system".
 *
 * `isDarkTheme` is read as a fallback for exactly that last case: installs that
 * persisted the old boolean keep the theme they chose instead of being silently
 * reset the first time they load a build with modes in it.
 */
export function readStoredMode(raw: null | string | undefined): ThemeMode {
  if (!raw) return 'system'

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return 'system'

    const { isDarkTheme, themeMode } = parsed as { isDarkTheme?: unknown; themeMode?: unknown }
    if (isThemeMode(themeMode)) return themeMode
    if (typeof isDarkTheme === 'boolean') return isDarkTheme ? 'dark' : 'light'
    return 'system'
  } catch {
    return 'system'
  }
}
