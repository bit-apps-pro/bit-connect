import { type Topic } from '@features/topic-modal/shared/type'
import { type ComponentType } from 'react'

/**
 * Chips on a topic card's meta line for the terms a topic carries in a
 * taxonomy a plugin adds, beside its type.
 *
 * A declaration, not a component: the card already shows every term of this
 * plugin's own that it has room for, so there is nothing more to render and
 * this says so by being `null`. The card checks before it renders.
 */
// eslint-disable-next-line unicorn/no-null -- the slot is declared empty, and the caller tests for it
const TopicCardTerms: ComponentType<{ topic: Topic }> | null = null

export default TopicCardTerms
