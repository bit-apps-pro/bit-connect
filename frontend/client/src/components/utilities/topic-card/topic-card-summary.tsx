import { type Topic } from '@features/topic-modal/shared/type'
import { type ReactNode } from 'react'

/**
 * A line under a card's excerpt for something the topic carries besides its
 * words, so the list says what the topic holds without opening it.
 *
 * Nothing here: in this plugin a topic is its words, its files and its terms,
 * and the card already shows each.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the contract a summary is drawn against
export default function TopicCardSummary(_props: { topic: Topic }): ReactNode {
  return
}
