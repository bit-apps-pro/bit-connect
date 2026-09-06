import queryRequest from '@common/helpers/request'
import { useQuery } from '@tanstack/react-query'

import { useTaxonomiesStoreActions } from '@/store/use-taxonomies-store'

export interface TaxonomyTerm {
  count: number
  id: number
  name: string
  parent: number
  slug: string
}

export interface TaxonomiesResponse {
  'bit-connect-departments': TaxonomyTerm[]
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
