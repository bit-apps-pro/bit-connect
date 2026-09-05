import { type ResponseType } from '@common/request/types'
import { wpApi } from '@common/request/wp-api'
import { useQuery } from '@tanstack/react-query'

import { type Status } from '../shared/types'

export default function useStatus(id: number) {
  const { data, error, isFetching, isPending, refetch } = useQuery<ResponseType<Status>, Error, Status>({
    enabled: !!id && id > 0,
    queryFn: ({ signal }) => wpApi(`bit-connect-statuses/${id}`, { method: 'GET', signal }),
    queryKey: ['bit-connect-statuses', id]
  })
  return {
    error,
    isFetching,
    isPending,
    refetch,
    status: data
  }
}
