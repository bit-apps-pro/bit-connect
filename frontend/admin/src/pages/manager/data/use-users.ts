import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

import { type UsersResponse } from '../shared/types'

interface UseUsersParams {
  page?: number
  perPage?: number
  search?: string
}

export default function useUsers({ page = 1, perPage = 20, search = '' }: UseUsersParams = {}) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    ...(search ? { search } : {})
  })

  const { data, isError, isFetching, isPending } = useQuery<
    ResponseType<UsersResponse>,
    Error,
    UsersResponse
  >({
    queryFn: ({ signal }) =>
      request<never, UsersResponse>(`users?${params.toString()}`, { method: 'GET', signal }),
    queryKey: ['users', page, perPage, search],
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
