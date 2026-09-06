import { create } from 'zustand'

interface ProductStore {
  actions: {
    setIsProductCreateModalOpen: (isOpen: boolean) => void
    setIsProductEditModalOpen: (isOpen: boolean) => void
  }
  isProductCreateModalOpen: boolean
  isProductEditModalOpen: boolean
}

const useProductStore = create<ProductStore>(set => ({
  actions: {
    setIsProductCreateModalOpen: (isOpen: boolean) => set(() => ({ isProductCreateModalOpen: isOpen })),
    setIsProductEditModalOpen: (isOpen: boolean) => set(() => ({ isProductEditModalOpen: isOpen }))
  },
  isProductCreateModalOpen: false,
  isProductEditModalOpen: false
}))

export const useProductStoreActions = () => useProductStore(state => state.actions)
export const useIsProductCreateModalOpen = () => useProductStore(state => state.isProductCreateModalOpen)
export const useIsProductEditModalOpen = () => useProductStore(state => state.isProductEditModalOpen)
