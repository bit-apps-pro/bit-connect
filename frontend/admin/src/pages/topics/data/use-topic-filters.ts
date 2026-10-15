import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

import { type FilterTaxonomy, type TopicAbilities } from '../shared/types'

interface TopicFiltersResponse {
  abilities: TopicAbilities
  taxonomies: FilterTaxonomy[]
}

const NO_TAXONOMIES: FilterTaxonomy[] = []

/** Until the server answers, offer nothing that needs a capability. */
const NO_ABILITIES: TopicAbilities = { delete_any: false, lock: false, pin: false }

/**
 * The taxonomies another plugin files topics under, as filters, and which of
 * the pin, lock and delete actions this moderator may take.
 */
export default function useTopicFilters() {
  const { data } = useQuery<ResponseType<TopicFiltersResponse>, Error, TopicFiltersResponse | undefined>({
    queryFn: ({ signal }) =>
      request<never, TopicFiltersResponse>('moderation/topic-filters', { method: 'GET', signal }),
    queryKey: ['moderation-topic-filters'],
    retry: false,
    select: response => response?.data,
    staleTime: 5 * 60 * 1000
  })

  return {
    abilities: data?.abilities ?? NO_ABILITIES,
    taxonomies: Array.isArray(data?.taxonomies) ? data.taxonomies : NO_TAXONOMIES
  }
}
