import { wpApiAll } from '@common/request/wp-api-all'
import { useQuery } from '@tanstack/react-query'
import { sortByOrder } from '@utilities/term-order'
import { useCallback } from 'react'

import { type TopicType } from '../shared/topic-type-types'

/**
 * Shared so an empty result keeps the same identity between renders. The table
 * mirrors this array into local state to reorder it optimistically, and a fresh
 * `[]` each render would resync — and undo the drag — on every render.
 */
const NO_TOPIC_TYPES: TopicType[] = []

export default function useTopicTypes() {
  // Memoised for the same reason: react-query re-runs `select` whenever the
  // function identity changes, which for an inline arrow is every render.
  const select = useCallback((topicTypes: TopicType[]) => {
    if (Array.isArray(topicTypes)) {
      return sortByOrder(topicTypes.map(topicType => ({ ...topicType, meta: topicType.meta || {} })))
    }
    return NO_TOPIC_TYPES
  }, [])

  const { data, isError, isFetching, isPending, refetch } = useQuery<TopicType[], Error, TopicType[]>({
    queryFn: ({ signal }) => wpApiAll<TopicType>('bit-connect-topic-types', { signal }),
    queryKey: ['topicTypes'],
    select
  })

  return {
    isTopicTypesError: isError,
    isTopicTypesFetching: isFetching,
    isTopicTypesPending: isPending,
    refetchTopicTypes: refetch,
    topicTypes: isError ? NO_TOPIC_TYPES : (data ?? NO_TOPIC_TYPES)
  }
}
