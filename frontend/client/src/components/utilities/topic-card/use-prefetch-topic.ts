import { type Topic } from '@features/topic-modal/shared/type'
import { useEffect, useRef } from 'react'

import { prefetchTopic } from '@/store/helper/topic-cache'
import { useSinglePostStore } from '@/store/single-post.zustand'

/**
 * How long the pointer rests on a card before the topic is loaded. A pointer
 * that only crosses the list on its way somewhere else asks for nothing.
 */
const HOVER_DELAY = 150

/**
 * Event handlers for a topic link that load the topic and its first comments
 * while the reader is about to open it, so the page often has them by the click.
 *
 * Touch and keyboard focus start at once: on those, the click follows quickly
 * and there is no hover to wait on.
 */
export default function usePrefetchTopic(topic: Pick<Topic, 'ID' | 'post_name'>) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const start = () => {
    // The page's own code too: it is a separate chunk, and on a first visit
    // its download is a wait of its own before the data even matters.
    void import('@pages/Post/PostDetailsPage').catch(() => {
      // Only a head start. The route loads it again on the click.
    })
    prefetchTopic(topic, useSinglePostStore.getState().sortOption)
  }

  return {
    onFocus: start,
    onMouseEnter: () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(start, HOVER_DELAY)
    },
    onMouseLeave: () => clearTimeout(timer.current),
    onTouchStart: start
  }
}
