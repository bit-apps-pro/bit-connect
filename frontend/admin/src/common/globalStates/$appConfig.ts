import { createThemeAtoms } from '@shared/theme/theme-atoms'
import { DEFAULT_THEME_MODE, readStoredMode, type ThemeMode } from '@shared/theme/theme-mode'
import { atomWithStorage } from 'jotai/utils'
import { type SyncStorage } from 'jotai/vanilla/utils/atomWithStorage'

import config from '../../config/config'

interface AppConfigType {
  isSidebarCollapsed: boolean
  isWpMenuCollapsed: boolean
  preferNodeDetailsInDrawer: boolean
  themeMode: ThemeMode
}

const $appConfig = atomWithStorage<AppConfigType>(
  `${config.PLUGIN_SLUG}-config`,
  {
    isSidebarCollapsed: false,
    isWpMenuCollapsed: false,
    preferNodeDetailsInDrawer: false,
    // A mode, not the OS preference resolved to a boolean: a visitor who picks
    // "system" keeps a live subscription rather than one frozen reading.
    themeMode: DEFAULT_THEME_MODE
  },
  {
    getItem: (key: string) => {
      const value = localStorage.getItem(key)
      const savedValue = value ? JSON.parse(value) : undefined

      return {
        ...(savedValue as Partial<AppConfigType>),
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
