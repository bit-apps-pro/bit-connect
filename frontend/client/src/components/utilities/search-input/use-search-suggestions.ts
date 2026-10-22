import { type Topic } from '@features/topic-modal/shared/type'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import get from '@utils/request/get'
import { useMemo } from 'react'

import { type MentionCandidate, searchMembers } from '@/components/quilTextEditor/mention-source'
import config, { type PortalArchive } from '@/config/config'
import { useAuthStore } from '@/store/auth.zustand'
import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

import { type SearchScope } from './use-search-scope'

/** Shorter than this, a term matches too much to be worth a request. */
export const MIN_SUGGEST_LENGTH = 2

const TOPIC_LIMIT = 5
const TERM_LIMIT = 4
const PEOPLE_LIMIT = 3

export interface TermSuggestion {
  archive: PortalArchive
  count: number
  name: string
  slug: string
}

/**
 * What the search box offers while someone types: matching topics from the
 * server, the archive terms (tags, types, stages, and any a plugin adds) whose
 * name contains the term, and members by display name.
 *
 * Terms are matched here rather than asked for: the layout has already loaded
 * every taxonomy, so they appear on the keystroke instead of after a request.
 * Members only for someone logged in — the lookup the "@" picker uses answers
 * nobody else, and a section that always comes back empty is worse than none.
 *
 * Inside a scope — the group or tag the reader is searching in — topics come
 * from that archive only. Terms and members are not filed under one, so they
 * are offered as before.
 */
export default function useSearchSuggestions(term: string, scope?: SearchScope) {
  const query = term.trim()
  const enabled = query.length >= MIN_SUGGEST_LENGTH
  const isLoggedIn = useAuthStore(state => state.isLoggedIn)
  const taxonomies = useTaxonomiesStoreSelect()

  const topics = useQuery({
    enabled,
    // Holds the previous term's rows while the next arrive, so the panel does
    // not collapse and regrow on every keystroke.
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const response = await get<{ data?: Topic[] }>('topics', {
        queryParam: {
          page: 1,
          per_page: TOPIC_LIMIT,
          search: query,
          ...(scope ? { [scope.archive.filter]: scope.slug } : {})
        },
        signal
      })

      return Array.isArray(response?.data?.data) ? response.data.data : []
    },
    queryKey: ['search-suggestions', 'topics', query, scope?.archive.filter ?? '', scope?.slug ?? ''],
    staleTime: 30_000
  })

  const people = useQuery<MentionCandidate[]>({
    enabled: enabled && isLoggedIn,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => searchMembers(query, signal),
    queryKey: ['search-suggestions', 'people', query],
    staleTime: 30_000
  })

  const terms = useMemo<TermSuggestion[]>(() => {
    if (!enabled || !taxonomies) return []

    const needle = query.toLowerCase()

    return Object.values(config.PORTAL_ARCHIVES)
      .flatMap(archive =>
        (taxonomies[archive.taxonomy] ?? [])
          .filter(item => item.name.toLowerCase().includes(needle))
          .map(item => ({ archive, count: item.count, name: item.name, slug: item.slug }))
      )
      // A name that starts with the term before one that merely contains it,
      // then the busier term first.
      .sort(
        (a, b) =>
          Number(b.name.toLowerCase().startsWith(needle)) - Number(a.name.toLowerCase().startsWith(needle)) ||
          b.count - a.count
      )
      .slice(0, TERM_LIMIT)
  }, [enabled, query, taxonomies])

  return {
    enabled,
    isFetching: topics.isFetching,
    people: enabled && isLoggedIn ? (people.data ?? []).slice(0, PEOPLE_LIMIT) : [],
    terms,
    topics: enabled ? (topics.data ?? []) : []
  }
}
