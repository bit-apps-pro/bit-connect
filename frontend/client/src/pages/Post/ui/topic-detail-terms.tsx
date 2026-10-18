import { type Topic } from '@features/topic-modal/shared/type'
import { type ComponentType } from 'react'

/**
 * Chips in the topic page's "Topic details" panel for the terms a topic carries
 * in a taxonomy a plugin adds, after its type.
 *
 * A declaration, not a component: the panel already shows the type and tags,
 * which are every term of this plugin's own a reader would follow, so there is
 * nothing more to render and this says so by being `null`.
 */
// eslint-disable-next-line unicorn/no-null -- the slot is declared empty, and the caller tests for it
const TopicDetailTerms: ComponentType<{ topic: Topic }> | null = null

export default TopicDetailTerms
