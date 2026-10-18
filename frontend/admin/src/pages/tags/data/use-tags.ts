import { wpApiAll } from '@common/request/wp-api-all'
import { useQuery } from '@tanstack/react-query'

import { type Tag } from '../shared/types'

export default function useTags() {
  // Every tag, not the first page: the screen searches and counts what is
  // pending over the whole list.
  const { data, isError, isFetching, isPending, refetch } = useQuery<Tag[]>({
    queryFn: ({ signal }) => wpApiAll<Tag>('bit-connect-tags', { signal }),
    queryKey: ['tags']
  })

  return {
    isTagsError: isError,
    isTagsFetching: isFetching,
    isTagsPending: isPending,
    refetchTags: refetch,
    tags: isError ? [] : data
  }
}
