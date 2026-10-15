import { type Topic } from '@features/topic-modal/shared/type'
import { type ReactNode } from 'react'

/** One entry for the topic's ⋯ menu, shaped like the header's own. */
export interface TopicMenuItem {
  danger?: boolean
  icon: ReactNode
  key: string
  label: string
  onClick: () => void
}

/**
 * The topic's ⋯ menu gains no pin entry.
 *
 * Topics are pinned from the admin's Topics screen. The header adds whatever
 * this returns after its lock entry, so `undefined` leaves the menu as it was.
 */
// eslint-disable-next-line unicorn/no-useless-undefined -- the slot is declared empty, and the header tests for it
const useTopicPinItem: (post: Topic) => TopicMenuItem | undefined = () => undefined

export default useTopicPinItem
