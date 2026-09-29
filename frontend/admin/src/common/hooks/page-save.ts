import { createContext, useContext, useEffect, useRef } from 'react'

/** A card's own unsaved values, and how to write them. */
export interface SaveParticipant {
  isDirty: boolean
  save: () => Promise<unknown>
}

type ReportParticipant = (key: string, participant?: SaveParticipant) => void

/**
 * How a card joins its page's one Save button.
 *
 * Most of a settings page is state the page itself holds. A card whose values
 * are stored somewhere else reports them here instead, and Save writes them
 * alongside — so the screen never has a second button that saves only part of
 * it. The page provides the context; Notifications and General both do.
 */
// Undefined outside the page, where a card has no Save to join.
export const PageSaveContext = createContext<ReportParticipant | undefined>(undefined)

/**
 * Registers a card's unsaved values with the page's Save.
 *
 * Keyed, so two cards editing the same stored record share one entry and it is
 * written once. `save` is read through a ref: it closes over the latest draft,
 * and re-reporting on every keystroke would re-render the whole page for it.
 */
export function useSaveParticipant(key: string, isDirty: boolean, save: () => Promise<unknown>) {
  const report = useContext(PageSaveContext)
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    report?.(key, { isDirty, save: () => saveRef.current() })
  }, [isDirty, key, report])

  useEffect(() => () => report?.(key), [key, report])
}
