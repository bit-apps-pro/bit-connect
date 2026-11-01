import { type ComponentType } from 'react'

/**
 * A notice above every admin screen, if a plugin adds one.
 *
 * A declaration, not a component: this plugin draws nothing there, so each
 * screen starts at the top of the content area and this says so by being
 * `null`. The layout checks before it renders, so an empty slot costs no markup.
 */
// eslint-disable-next-line unicorn/no-null -- the slot is declared empty, and the caller tests for it
const ScreenNotices: ComponentType | null = null

export default ScreenNotices
