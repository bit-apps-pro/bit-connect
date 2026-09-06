import { type ResponseType } from '@common/request/types'
import { wpApi } from '@common/request/wp-api'
import { useQuery } from '@tanstack/react-query'

import { type Tag } from '../shared/types'

export default function useTags() {
  const { data, isError, isFetching, isPending, refetch } = useQuery<ResponseType<Tag[]>, Error, Tag[]>({
    queryFn: ({ signal }) =>
      wpApi('bit-connect-tags', { method: 'GET', queryParam: { per_page: 100 }, signal }),
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
