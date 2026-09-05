import { type Topic } from '@features/topic-modal/shared/type'
import { wpApi } from '@utils/request/wp-api'
import sortByOrder from '@utils/sort-by-order'
import { create } from 'zustand'

import { updatePostStageApi } from './data/update-post-stage-api'

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
  getStageByTermId: (termId: number) => Stage | undefined
  isLoading: boolean
  isUpdatingStage: boolean
  setError: (error: string | undefined) => void
  setLoading: (isLoading: boolean) => void
  stages: Stage[]
  updatePostStage: (postId: number, stageTermId: number) => Promise<Topic>
}

export const useStagesStore = create<StagesStore>((set, get) => ({
  error: undefined,
  isLoading: false,
  isUpdatingStage: false,
  stages: [],

  fetchStages: async () => {
    set({ error: undefined, isLoading: true })

    try {
      const response = await wpApi<never, Stage[]>('bit-connect-stages', {
        method: 'GET',
        queryParam: { per_page: 100 }
      })

      const stages = Array.isArray(response.data) ? sortByOrder(response.data) : []

      set({
        isLoading: false,
        stages
      })
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to fetch stages'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  updatePostStage: async (postId: number, stageTermId: number) => {
    set({ error: undefined, isUpdatingStage: true })

    try {
      const updatedTopic = await updatePostStageApi(postId, stageTermId)

      set({
        isUpdatingStage: false
      })

      return updatedTopic
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to update post stage'
      set({ error: errorMessage, isUpdatingStage: false })
      throw error
    }
  },

  getStageByTermId: (termId: number) => {
    const { stages: allStages } = get()
    return allStages.find(stage => stage.id === termId)
  },

  setError: error => set({ error }),
  setLoading: isLoading => set({ isLoading })
}))
