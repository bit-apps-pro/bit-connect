import { create } from 'zustand'

interface TagStore {
  actions: {
    setIsCreateModalOpen: (isOpen: boolean) => void
    setIsEditModalOpen: (isOpen: boolean) => void
  }
  isCreateModalOpen: boolean
  isEditModalOpen: boolean
}

const useTagStore = create<TagStore>(set => ({
  actions: {
    setIsCreateModalOpen: (isOpen: boolean) => set({ isCreateModalOpen: isOpen }),
    setIsEditModalOpen: (isOpen: boolean) => set({ isEditModalOpen: isOpen })
  },
  isCreateModalOpen: false,
  isEditModalOpen: false
}))

export const useIsCreateModalOpenSelect = () => useTagStore(state => state.isCreateModalOpen)
export const useTagStoreActions = () => useTagStore(state => state.actions)
export const useIsEditModalOpenSelect = () => useTagStore(state => state.isEditModalOpen)
