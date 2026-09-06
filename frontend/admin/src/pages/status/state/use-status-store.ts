import { create } from 'zustand'

interface StatusStore {
  actions: {
    setIsCreateStatusModalOpen: (isOpen: boolean) => void
    setIsEditStatusModalOpen: (isOpen: boolean) => void
  }
  isCreateStatusModalOpen: boolean
  isEditStatusModalOpen: boolean
}

const useStatusStore = create<StatusStore>(set => ({
  actions: {
    setIsCreateStatusModalOpen: (isOpen: boolean) => set({ isCreateStatusModalOpen: isOpen }),
    setIsEditStatusModalOpen: (isOpen: boolean) => set({ isEditStatusModalOpen: isOpen })
  },
  isCreateStatusModalOpen: false,
  isEditStatusModalOpen: false
}))

export const useIsCreateStatusModalOpen = () => useStatusStore(state => state.isCreateStatusModalOpen)
export const useIsEditStatusModalOpen = () => useStatusStore(state => state.isEditStatusModalOpen)
export const useStatusStoreActions = () => useStatusStore(state => state.actions)
