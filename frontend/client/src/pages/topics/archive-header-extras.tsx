import { type TaxonomyTerm } from '@features/topic-modal/data/use-taxonomies'
import { type ComponentType } from 'react'

import { type PortalArchive } from '@/config/config'

/**
 * More about a term archive, under its heading and description, if a plugin
 * adds any.
 *
 * A declaration, not a component: this plugin says all it has to say about a
 * term in the heading itself, so this is `null` rather than a component that
 * draws nothing. The heading checks before it renders, so an empty slot costs
 * no markup and no gap.
 */
// eslint-disable-next-line unicorn/no-null -- the slot is declared empty, and the caller tests for it
const ArchiveHeaderExtras: ComponentType<{ archive: PortalArchive; term: TaxonomyTerm }> | null = null

export default ArchiveHeaderExtras
