import { type ComponentType } from 'react'

/**
 * Further settings above the list, if a plugin adds any.
 *
 * A declaration, not a component: this plugin names its departments itself, and
 * says so by being `null`. The screen checks before it renders, so an empty
 * slot costs no markup.
 *
 * Anything drawn here keeps its own option and its own endpoint, and saves
 * itself.
 */
// eslint-disable-next-line unicorn/no-null -- the slot is declared empty, and the caller tests for it
const NamingExtras: ComponentType | null = null

export default NamingExtras
