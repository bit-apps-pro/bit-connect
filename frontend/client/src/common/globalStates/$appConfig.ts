import { createThemeAtoms } from '@shared/theme/theme-atoms'
import { readStoredMode, type ThemeMode } from '@shared/theme/theme-mode'
import { atomWithStorage } from 'jotai/utils'
import { type SyncStorage } from 'jotai/vanilla/utils/atomWithStorage'

import config from '../../config/config'

const hasLocalStorage = () => globalThis.localStorage !== undefined

interface AppConfigType {
  isPro: boolean
  isSidebarCollapsed: boolean
  isWpMenuCollapsed: boolean
  preferNodeDetailsInDrawer: boolean
  themeMode: ThemeMode
}

const $appConfig = atomWithStorage<AppConfigType>(
  `${config.PLUGIN_SLUG}-config`,
  {
    isPro: config.IS_PRO,
    isSidebarCollapsed: false,
    isWpMenuCollapsed: false,
    preferNodeDetailsInDrawer: false,
    // Not `getColorPreference()`. Resolving the OS preference into the default
    // would bake one reading of it into storage the first time anything writes
    // this blob; "system" stays a live subscription instead — see
    // `@shared/theme/theme-atoms`.
    themeMode: 'system'
  },
  {
    // There is no localStorage during a server render, and reading it would throw
    // before anything is emitted. Falling back to the defaults also keeps the
    // server's first paint deterministic: the persisted theme is a per-visitor
    // value the server cannot know, so it must not influence server markup or
    // hydration would mismatch on every visitor who changed it.
    getItem: (key: string) => {
      const value = hasLocalStorage() ? localStorage.getItem(key) : null
      const savedValue = value ? JSON.parse(value) : undefined

      return {
        ...(savedValue as Partial<AppConfigType>),
        isPro: config.IS_PRO,
        // Parsed rather than spread through, so a blob written by a build that
        // stored the old `isDarkTheme` boolean still carries that choice over.
        themeMode: readStoredMode(value)
      }
    },
    removeItem: (key: string) => {
      if (hasLocalStorage()) localStorage.removeItem(key)
    },
    setItem: (key: string, newValue: Partial<AppConfigType>) => {
      if (hasLocalStorage()) localStorage.setItem(key, JSON.stringify(newValue))
    }
  } as SyncStorage<AppConfigType>,
  // Read storage at init, not on mount: the boot script has already painted the
  // stored theme before React runs, and a first render from the defaults would
  // flip it back for a frame before the mount-time re-read corrects it.
  { getOnInit: true }
)

export const { $isDarkTheme, $themeMode } = createThemeAtoms($appConfig)
