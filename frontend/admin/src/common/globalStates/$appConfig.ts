import { createThemeAtoms } from '@shared/theme/theme-atoms'
import { readStoredMode, type ThemeMode } from '@shared/theme/theme-mode'
import { atomWithStorage } from 'jotai/utils'
import { type SyncStorage } from 'jotai/vanilla/utils/atomWithStorage'

import config from '../../config/config'

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
    // Not the OS preference resolved to a boolean: "system" stays a live
    // subscription rather than one reading of the OS frozen into storage.
    themeMode: 'system'
  },
  {
    getItem: (key: string) => {
      const value = localStorage.getItem(key)
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
      localStorage.removeItem(key)
    },
    setItem: (key: string, newValue: Partial<AppConfigType>) => {
      localStorage.setItem(key, JSON.stringify(newValue))
    }
  } as SyncStorage<AppConfigType>,
  // Read storage at init, not on mount: the boot script has already painted the
  // stored theme before React runs, and a first render from the defaults would
  // flip it back for a frame before the mount-time re-read corrects it.
  { getOnInit: true }
)

export const { $isDarkTheme, $themeMode } = createThemeAtoms($appConfig)
