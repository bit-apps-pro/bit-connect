import { type ComponentType } from 'react'

/**
 * A strip between the phone's search row and the list, if a plugin adds one.
 *
 * A declaration, not a component: this plugin draws nothing there, so the list
 * starts right under the search row and this says so by being `null`. The list
 * checks before it renders, so an empty slot costs no markup and no gap.
 */
// eslint-disable-next-line unicorn/no-null -- the slot is declared empty, and the caller tests for it
const TopicListBanners: ComponentType | null = null

export default TopicListBanners
