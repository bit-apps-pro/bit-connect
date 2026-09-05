import { type ResponseType } from '@common/request/types'
import { wpApi } from '@common/request/wp-api'
import { useQuery } from '@tanstack/react-query'

import { type TopicType } from '../shared/topic-type-types'

export default function useTopicType(id: number) {
  const { data, error, isFetching, isPending, refetch } = useQuery<
    ResponseType<TopicType>,
    Error,
    TopicType
  >({
    enabled: !!id && id > 0,
    queryFn: ({ signal }) => wpApi(`bit-connect-topic-types/${id}`, { method: 'GET', signal }),
    queryKey: ['topicTypes', id]
  })
  return {
    error,
    isFetching,
    isPending,
    refetch,
    topicType: data
  }
}
