import { wpApi } from '@utils/request/wp-api'
import sortByOrder from '@utils/sort-by-order'
import { create } from 'zustand'

interface Stage {
  description?: string
  iconFileName?: string
  id: number
  meta?: {
    /** Optional dark-mode override; falls back to `icon_url`. */
    icon_dark_id?: number
    icon_dark_url?: string
    icon_id?: number
    icon_url?: string
    /** Admin-defined position, set by dragging rows on the Stages screen. */
    order?: number
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
      const response = await wpApi<'', Stage[]>('bit-connect-stages', {
        method: 'GET',
        queryParam: { per_page: 100 }
      })
      set({ isLoading: false, stages: sortByOrder(response.data || []) })
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to fetch stages'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },
  isLoading: false,
  setError: error => set({ error }),
  setLoading: isLoading => set({ isLoading }),
  stages: []
}))
