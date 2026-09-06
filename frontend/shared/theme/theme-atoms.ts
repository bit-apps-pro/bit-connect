import { atom, type PrimitiveAtom, type WritableAtom } from 'jotai'

import { resolveIsDark, systemPrefersDark, type ThemeMode, watchSystemTheme } from './theme-mode'

/**
 * Jotai wiring for the theme, built on top of whichever persisted app-config
 * atom the app already has.
 *
 * A factory rather than a module-level atom because the two apps persist under
 * different keys and the client's storage has to survive a server render — but
 * the derivation on top of it is identical, and duplicating it is how the admin
 * and the portal end up disagreeing about what "system" means.
 */

/** The slice of app config this module needs; each app's is a superset. */
export interface ThemeConfig {
  themeMode: ThemeMode
}

/**
 * Tracks the OS preference live.
 *
 * `onMount` is what makes "system" mean *system* rather than "whatever the OS
 * said when the tab opened" — without a subscription, a visitor on system mode
 * keeps the daytime theme until they reload.
 */
export const $systemPrefersDark = atom(false)
$systemPrefersDark.onMount = set => {
  set(systemPrefersDark())
  return watchSystemTheme(set)
}

export function createThemeAtoms<T extends ThemeConfig>($appConfig: PrimitiveAtom<T>) {
  const $themeMode: WritableAtom<ThemeMode, [ThemeMode], void> = atom(
    get => get($appConfig).themeMode,
    (get, set, mode: ThemeMode) => set($appConfig, { ...get($appConfig), themeMode: mode })
  )

  /**
   * Read-only on purpose. The mode is the stored decision and the boolean is a
   * view of it; a writable boolean would let a caller set dark without saying
   * whether that overrides the OS or follows it, and the next flip of the OS
   * would then either stick or not depending on which code path wrote last.
   */
  const $isDarkTheme = atom(get => resolveIsDark(get($themeMode), get($systemPrefersDark)))

  /** Cycles light → dark → system, the order the toggle button steps through. */
  // eslint-disable-next-line unicorn/no-null -- jotai's write-only atom convention
  const $cycleThemeMode = atom(null, (get, set) => {
    const next: Record<ThemeMode, ThemeMode> = { dark: 'system', light: 'dark', system: 'light' }
    set($themeMode, next[get($themeMode)])
  })

  return { $cycleThemeMode, $isDarkTheme, $themeMode }
}
