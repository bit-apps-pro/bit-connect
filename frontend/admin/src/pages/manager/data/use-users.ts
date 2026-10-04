import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

import { type UsersResponse } from '../shared/types'
import { managerKeys } from './query-keys'

interface UseUsersParams {
  page?: number
  perPage?: number
  search?: string
}

export default function useUsers({ page = 1, perPage = 20, search = '' }: UseUsersParams = {}) {
  const queryParam = {
    page,
    per_page: perPage,
    ...(search ? { search } : {})
  }

  const { data, isError, isFetching, isPending } = useQuery<
    ResponseType<UsersResponse>,
    Error,
    UsersResponse
  >({
    queryFn: ({ signal }) =>
      request<never, UsersResponse>('users', { method: 'GET', queryParam, signal }),
    queryKey: managerKeys.usersPage(page, perPage, search),
    retry: false,
    select: response => response?.data
  })

  return {
    isUsersError: isError,
    isUsersFetching: isFetching,
    isUsersPending: isPending,
    usersData: data
  }
}
