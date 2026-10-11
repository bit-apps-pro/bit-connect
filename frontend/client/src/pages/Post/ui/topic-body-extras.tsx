import { type Topic } from '@features/topic-modal/shared/type'
import { type ReactNode } from 'react'

/**
 * What a topic shows below its description, before the row of tags and
 * files — for content that belongs to the topic's body without being written
 * in it.
 *
 * Nothing here: this plugin's topic body is its description.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the contract a body section is drawn against
export default function TopicBodyExtras(_props: { post: Topic }): ReactNode {
  return
}
