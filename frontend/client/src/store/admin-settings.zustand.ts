import { create } from 'zustand'

import { type AdminSettingsStore } from './admin-settings.type'
import {
  defaultSettings,
  fetchAdminSettingsApi,
  updateAdminSettingsApi
} from './data/admin-settings-api'

export const useAdminSettingsStore = create<AdminSettingsStore>(set => ({
  error: undefined,
  isLoading: false,
  isUpdating: false,
  settings: defaultSettings,

  fetchSettings: async () => {
    set({ error: undefined, isLoading: true })

    try {
      const settings = await fetchAdminSettingsApi()

      set({
        isLoading: false,
        settings
      })
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to fetch admin settings'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  updateSettings: async settings => {
    set({ error: undefined, isUpdating: true })

    try {
      const updatedSettings = await updateAdminSettingsApi(settings)

      set({
        isUpdating: false,
        settings: updatedSettings
      })
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to update admin settings'
      set({ error: errorMessage, isUpdating: false })
      throw error
    }
  },

  setError: error => set({ error }),
  setLoading: isLoading => set({ isLoading })
}))
