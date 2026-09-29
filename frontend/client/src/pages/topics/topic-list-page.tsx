import { type ComponentProps } from 'react'

import TopicListAside from './topic-list-aside'
import Topics from './topics'

/**
 * The topic list, with whatever sits beside it.
 *
 * Kept apart from Topics so that component stays about the list itself. With
 * nothing beside it, this is the list and nothing more.
 */
export default function TopicListPage(props: ComponentProps<typeof Topics>) {
  if (!TopicListAside) return <Topics {...props} />

  return (
    <div className="bc-flex">
      <div className="bc-min-w-0 bc-flex-1">
        <Topics {...props} />
      </div>
      <TopicListAside />
    </div>
  )
}
