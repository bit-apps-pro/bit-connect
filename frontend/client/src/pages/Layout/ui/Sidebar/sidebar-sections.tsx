import { type ComponentType } from 'react'

/**
 * Further groups of links below the sidebar's Stages, if a plugin adds any.
 *
 * A declaration, not a component: the stages are this plugin's whole
 * navigation, so there is nothing more to render and this says so by being
 * `null` rather than by being a component that draws nothing. The sidebar
 * checks before it renders, so an empty slot costs no markup.
 */
// eslint-disable-next-line unicorn/no-null -- the slot is declared empty, and the caller tests for it
const SidebarSections: ComponentType | null = null

export default SidebarSections
