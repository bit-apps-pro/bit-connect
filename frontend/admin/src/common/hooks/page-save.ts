import { createContext, useCallback, useMemo, useState } from 'react'

/** Where one part of a screen stands with what it has been asked to save. */
export type AutoSaveStatus = 'error' | 'idle' | 'invalid' | 'pending' | 'saved' | 'saving'

export interface AutoSaveState {
  /** Why the last save failed, or why the value is not being saved. */
  error?: string
  /** Saves now, skipping the delay — also how a failed save is retried. */
  flush?: () => void
  /** The last save failed to reach the server, and is being retried. */
  retrying?: boolean
  status: AutoSaveStatus
}

type ReportSave = (key: string, state?: AutoSaveState) => void

/**
 * How a card tells its page how its saving is going.
 *
 * Every settings screen saves as it is changed, and shows one line saying
 * whether everything on it has been saved. A card whose values are stored
 * behind another endpoint saves itself through useAutoSave and reports here
 * under its own key, so that line covers it too. Undefined outside a page that
 * shows one, where a card simply saves.
 */
export const PageSaveContext = createContext<ReportSave | undefined>(undefined)

/** Worst first: the line shows the part that most needs the admin's attention. */
const PRECEDENCE: AutoSaveStatus[] = ['error', 'invalid', 'saving', 'pending', 'saved', 'idle']

/** The one state a screen shows for all of its parts. */
export function combineSaves(states: AutoSaveState[]): AutoSaveState {
  for (const status of PRECEDENCE) {
    const match = states.find(state => state.status === status)
    if (match) return match
  }

  return { status: 'idle' }
}

/**
 * Saves every part of a screen now. For a field being left — so text never
 * waits out its delay — and for the status line's Retry. A part with nothing
 * waiting does nothing.
 */
export function flushAll(states: AutoSaveState[]) {
  for (const state of states) state.flush?.()
}

/** The page's side: collects what its cards report, to provide as PageSaveContext. */
export function usePageSaves() {
  const [saves, setSaves] = useState<Record<string, AutoSaveState>>({})

  const report = useCallback<ReportSave>((key, state) => {
    setSaves(prev => {
      if (!state) {
        if (!(key in prev)) return prev
        return Object.fromEntries(Object.entries(prev).filter(([name]) => name !== key))
      }
      const current = prev[key]
      if (
        current?.status === state.status &&
        current?.error === state.error &&
        current?.retrying === state.retrying &&
        current?.flush === state.flush
      ) {
        return prev
      }
      return { ...prev, [key]: state }
    })
  }, [])

  const states = useMemo(() => Object.values(saves), [saves])

  return { report, states }
}
