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
 * A further entry for the topic's ⋯ menu, after its lock entry.
 *
 * The menu already holds every action this plugin takes on a topic, so this
 * adds none, and `undefined` leaves the menu as it was.
 */
// eslint-disable-next-line unicorn/no-useless-undefined -- the slot is declared empty, and the header tests for it
const useTopicPinItem: (post: Topic) => TopicMenuItem | undefined = () => undefined

export default useTopicPinItem
