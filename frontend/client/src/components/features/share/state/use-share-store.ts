import { create } from 'zustand'

import { type ShareTarget } from '../shared/share-targets'

interface ShareStore {
  close: () => void
  isOpen: boolean
  open: (target: ShareTarget) => void
  target: ShareTarget | undefined
}

/**
 * One share dialog for the whole page, opened with whatever is being shared.
 *
 * Same reason the report dialog works this way: a thread renders hundreds of
 * comments, and a dialog mounted inside each row would build hundreds of them
 * to show at most one.
 */
const useShareStore = create<ShareStore>(set => ({
  close: () => set({ isOpen: false, target: undefined }),
  isOpen: false,
  open: target => set({ isOpen: true, target }),
  target: undefined
}))

export default useShareStore
