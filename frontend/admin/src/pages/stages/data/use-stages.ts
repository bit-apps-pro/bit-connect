import { type ResponseType } from '@common/request/types'
import { wpApi } from '@common/request/wp-api'
import { useQuery } from '@tanstack/react-query'
import { sortByOrder } from '@utilities/term-order'
import { useCallback } from 'react'

import { type Stage } from '../shared/types'

/**
 * Shared so an empty result keeps the same identity between renders. The stages
 * table mirrors this array into local state to reorder it optimistically, and a
 * fresh `[]` each render would resync — and undo the drag — on every render.
 */
const NO_STAGES: Stage[] = []

export default function useStages() {
  // Memoised for the same reason: react-query re-runs `select` whenever the
  // function identity changes, which for an inline arrow is every render.
  const select = useCallback((response: ResponseType<Stage[]>) => {
    const stages = response?.data ?? response
    if (Array.isArray(stages)) {
      return sortByOrder(
        stages.map(stage => ({
          ...stage,
          meta: stage.meta || {}
        }))
      )
    }
    return NO_STAGES
  }, [])

  const { data, isError, isFetching, isPending, refetch } = useQuery<
    ResponseType<Stage[]>,
    Error,
    Stage[]
  >({
    queryFn: ({ signal }) =>
      wpApi('bit-connect-stages', { method: 'GET', queryParam: { per_page: 100 }, signal }),
    queryKey: ['stages'],
    select
  })

  return {
    isStagesError: isError,
    isStagesFetching: isFetching,
    isStagesPending: isPending,
    refetchStages: refetch,
    stages: isError ? NO_STAGES : (data ?? NO_STAGES)
  }
}
