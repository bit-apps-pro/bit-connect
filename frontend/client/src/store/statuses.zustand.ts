import { type Topic } from '@features/topic-modal/shared/type'
import { create } from 'zustand'

import { fetchStatusesApi, type Status } from './data/fetch-statuses-api'
import { updatePostStatusApi } from './data/update-post-status-api'

interface StatusesStore {
  error: string | undefined
  fetchStatuses: () => Promise<void>
  getStatusByTermId: (termId: number) => Status | undefined
  isLoading: boolean
  isUpdatingStatus: boolean
  setError: (error: string | undefined) => void
  setLoading: (isLoading: boolean) => void
  statuses: Status[]
  updatePostStatus: (postId: number, statusIds: number) => Promise<Topic>
}

export const useStatusesStore = create<StatusesStore>((set, get) => ({
  error: undefined,
  isLoading: false,
  isUpdatingStatus: false,
  statuses: [],

  fetchStatuses: async () => {
    set({ error: undefined, isLoading: true })

    try {
      const statuses = await fetchStatusesApi()

      set({
        isLoading: false,
        statuses
      })
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to fetch statuses'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  updatePostStatus: async (postId: number, statusTermId: number) => {
    set({ error: undefined, isUpdatingStatus: true })

    try {
      const updatedTopic = await updatePostStatusApi(postId, statusTermId)

      set({
        isUpdatingStatus: false
      })
      return updatedTopic
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to update post status'
      set({ error: errorMessage, isUpdatingStatus: false })
      throw error
    }
  },

  getStatusByTermId: (termId: number) => {
    // Helper function to find a status by its term_id
    // Use this with post.terms.statuses.term_id to get the full status object
    const { statuses: allStatuses } = get()
    return allStatuses.find(status => status.id === termId)
  },

  setError: error => set({ error }),
  setLoading: isLoading => set({ isLoading })
}))
