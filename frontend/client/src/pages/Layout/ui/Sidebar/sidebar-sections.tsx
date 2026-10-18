import { type ComponentType } from 'react'

/**
 * Further places below the sidebar's own (the stages and Following), if a plugin adds
 * any — each section is a place a reader goes, never a filter on the listing.
 *
 * A declaration, not a component: the stages and Following are this plugin's whole
 * navigation, so there is nothing more to render and this says so by being
 * `null` rather than by being a component that draws nothing. The sidebar
 * checks before it renders, so an empty slot costs no markup.
 */
// eslint-disable-next-line unicorn/no-null -- the slot is declared empty, and the caller tests for it
const SidebarSections: ComponentType | null = null

/**
 * Whether a path is one of the sections' own places — so Topics, which marks
 * itself on every listing route, stands down there. None, while there are no
 * sections.
 */
// eslint-disable-next-line unicorn/no-null -- declared empty with the slot above
export const sectionOwnsPath: ((pathname: string) => boolean) | null = null

export default SidebarSections
