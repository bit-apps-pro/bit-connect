import { create } from 'zustand'

interface TopicTypeStore {
  actions: {
    setIsTopicTypeCreateModalOpen: (isOpen: boolean) => void
    setIsTopicTypeEditModalOpen: (isOpen: boolean) => void
  }
  isTopicTypeCreateModalOpen: boolean
  isTopicTypeEditModalOpen: boolean
}

const useTopicTypeStore = create<TopicTypeStore>(set => ({
  actions: {
    setIsTopicTypeCreateModalOpen: (isOpen: boolean) =>
      set(() => ({ isTopicTypeCreateModalOpen: isOpen })),
    setIsTopicTypeEditModalOpen: (isOpen: boolean) => set(() => ({ isTopicTypeEditModalOpen: isOpen }))
  },
  isTopicTypeCreateModalOpen: false,
  isTopicTypeEditModalOpen: false
}))

export const useTopicTypeStoreActions = () => useTopicTypeStore(state => state.actions)
export const useIsTopicTypeCreateModalOpen = () =>
  useTopicTypeStore(state => state.isTopicTypeCreateModalOpen)
export const useIsTopicTypeEditModalOpen = () =>
  useTopicTypeStore(state => state.isTopicTypeEditModalOpen)
