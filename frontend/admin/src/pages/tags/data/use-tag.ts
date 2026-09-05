import { type ResponseType } from '@common/request/types'
import { wpApi } from '@common/request/wp-api'
import { useQuery } from '@tanstack/react-query'

import { type Tag } from '../shared/types'

export function useTag(id: number) {
  const { data, isError, isFetching, isPending, refetch } = useQuery<ResponseType<Tag>, Error, Tag>({
    enabled: !!id && id > 0,
    queryFn: ({ signal }) => wpApi(`bit-connect-tags/${id}`, { method: 'GET', signal }),
    queryKey: ['tag', id]
  })

  return {
    isTagError: isError,
    isTagFetching: isFetching,
    isTagPending: isPending,
    refetchTag: refetch,
    tag: data
  }
}
