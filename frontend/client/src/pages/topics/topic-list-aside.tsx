import { type ComponentType } from 'react'

/**
 * A column beside the topic list, if a plugin adds one.
 *
 * A declaration, not a component: this plugin draws nothing beside the list, so
 * the list takes the full width and this says so by being `null` rather than a
 * component that renders an empty column. The list page checks before it
 * renders, so an empty slot costs no markup and no space.
 */
// eslint-disable-next-line unicorn/no-null -- the slot is declared empty, and the caller tests for it
const TopicListAside: ComponentType | null = null

export default TopicListAside
