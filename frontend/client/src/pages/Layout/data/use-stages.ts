import { create } from 'zustand'

import { fetchStagesApi } from '@/store/data/fetch-stages-api'

export interface Stage {
  description?: string
  iconFileName?: string
  id: number
  meta?: {
    /** The stage's badge on topic cards. */
    bit_connect_color?: string
    /** Optional dark-mode override; falls back to `icon_url`. */
    bit_connect_icon_dark_id?: number
    bit_connect_icon_dark_url?: string
    bit_connect_icon_id?: number
    bit_connect_icon_url?: string
    /** Admin-defined position, set by dragging rows on the Stages screen. */
    bit_connect_order?: number
  }
  name: string
  slug: string
}

interface StagesStore {
  error: string | undefined
  fetchStages: () => Promise<void>
  isLoading: boolean
  setError: (error: string | undefined) => void
  setLoading: (isLoading: boolean) => void
  stages: Stage[]
}

export const useStagesStore = create<StagesStore>((set, get) => ({
  error: undefined,
  fetchStages: async () => {
    if (get().stages.length > 0) return

    set({ error: undefined, isLoading: true })
    try {
      set({ isLoading: false, stages: await fetchStagesApi<Stage>() })
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to fetch stages'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },
  // Loading from the start: the sidebar fetches on mount, and its placeholder
  // rows should cover that first frame rather than pop in one frame late.
  isLoading: true,
  setError: error => set({ error }),
  setLoading: isLoading => set({ isLoading }),
  stages: []
}))
