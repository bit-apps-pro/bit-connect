import { create } from 'zustand'

/** What is being reported. Mirrors ReportService's target types. */
export type ReportTargetType = 'comment' | 'post'

interface ReportTarget {
  /** Shown in the modal so the reporter can see what they are about to report. */
  excerpt?: string
  id: number
  type: ReportTargetType
}

interface ReportModalStore {
  close: () => void
  isOpen: boolean
  open: (target: ReportTarget) => void
  target: ReportTarget | undefined
}

/**
 * One modal for the whole portal rather than one per comment.
 *
 * A thread renders hundreds of comments; mounting a modal inside each would
 * build hundreds of dialogs to show at most one. The row opens this with its own
 * target instead.
 */
const useReportModalStore = create<ReportModalStore>(set => ({
  close: () => set({ isOpen: false, target: undefined }),
  isOpen: false,
  open: target => set({ isOpen: true, target }),
  target: undefined
}))

export default useReportModalStore
