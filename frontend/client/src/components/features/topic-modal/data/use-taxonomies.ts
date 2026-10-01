import queryRequest from '@common/helpers/request'
import { type ThemedIconMeta } from '@shared/theme/themed-icon'
import { useQuery } from '@tanstack/react-query'

import { useTaxonomiesStoreActions } from '@/store/use-taxonomies-store'

export interface TaxonomyTerm {
  count: number
  id: number
  /** Only on the taxonomies that carry icons — stages, statuses, and any added one that does. */
  meta?: ThemedIconMeta
  name: string
  parent: number
  slug: string
}

/**
 * Every taxonomy topics are filed under, by name: this plugin's own, and any a
 * plugin adds on the topic post type, which the endpoint returns alongside.
 */
export interface TaxonomiesResponse {
  [taxonomy: string]: TaxonomyTerm[] | undefined
  'bit-connect-stages': TaxonomyTerm[]
  'bit-connect-statuses': TaxonomyTerm[]
  'bit-connect-tags': TaxonomyTerm[]
  'bit-connect-topic-types': TaxonomyTerm[]
}

export default function useTaxonomies() {
  const { setTaxonomies } = useTaxonomiesStoreActions()
  const { data, error, isError, isLoading, isPending } = useQuery({
    queryFn: async ({ signal }) =>
      queryRequest<TaxonomiesResponse>(`taxonomies`, {}, undefined, 'GET', { signal }),
    queryKey: ['taxonomies'],
    select: res => {
      setTaxonomies(res?.data || undefined)
      return res?.data
    }
  })

  if (isError) {
    console.error(error)
  }

  return {
    isLoadingTaxonomies: isLoading,
    isPendingTaxonomies: isPending,
    taxonomies: data
  }
}
