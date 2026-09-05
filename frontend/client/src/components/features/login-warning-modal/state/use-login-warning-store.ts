import { create } from 'zustand'

interface LoginWarningStore {
  close: () => void
  isOpen: boolean
  open: () => void
}

const useLoginWarningStore = create<LoginWarningStore>(set => ({
  close: () => set({ isOpen: false }),
  isOpen: false,
  open: () => set({ isOpen: true })
}))

export default useLoginWarningStore
