import { type ComponentType, type ReactNode } from 'react'

/**
 * A page a plugin lays out around a term archive's topic list.
 *
 * `list` is this plugin's own list for the archive — filters, cards, paging —
 * without the archive's heading, which the page draws its own way. The page
 * decides where the list goes and what sits around it.
 */
export type ArchivePage = ComponentType<{ list: ReactNode; termSlug: string }>

/**
 * The page for an archive, by the filter it narrows (`tags`, `topic-types`, or
 * a plugin's own), if a plugin lays one out.
 *
 * A declaration, not a function: every archive here is its heading over its
 * list, so this is `null` rather than a function that always says "none". The
 * archive route checks before it asks.
 */
// eslint-disable-next-line unicorn/no-null -- the slot is declared empty, and the caller tests for it
const archivePageFor: ((filter: string) => ArchivePage | null) | null = null

export default archivePageFor
