import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

interface Member {
  id: number
  name: string
}

const NO_MEMBERS: Member[] = []

/**
 * Members whose display name matches what was typed, for the author filter.
 * The editor's "@" picker answers the same question, so it is asked there.
 */
export default function useAuthorSearch(term: string) {
  const [debounced, setDebounced] = useState(term)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 300)
    return () => clearTimeout(timer)
  }, [term])

  const { data, isFetching } = useQuery<ResponseType<Member[]>, Error, Member[]>({
    enabled: debounced !== '',
    queryFn: ({ signal }) =>
      request<never, Member[]>('mentions/search', { method: 'GET', queryParam: { q: debounced }, signal }),
    queryKey: ['moderation-author-search', debounced],
    retry: false,
    select: response => (Array.isArray(response?.data) ? response.data : NO_MEMBERS)
  })

  return { authors: debounced === '' ? NO_MEMBERS : (data ?? NO_MEMBERS), isSearching: isFetching }
}
