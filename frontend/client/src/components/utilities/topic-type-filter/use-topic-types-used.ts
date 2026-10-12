import queryRequest, { type Response } from '@common/helpers/request'
import { useQuery } from '@tanstack/react-query'

/**
 * Slugs of the topic types the topics under an archive are filed as, or
 * undefined while unknown — no archive, still loading, or the request failed.
 *
 * Unknown means "every type": the chips fall back to the full row rather than
 * an empty one.
 */
export default function useTopicTypesUsed(scope?: Record<string, string>): string[] | undefined {
  const { data } = useQuery<Response<string[]>, Error, string[]>({
    enabled: scope !== undefined,
    queryFn: ({ signal }) => queryRequest<string[]>('topic-types-used', undefined, scope, 'GET', { signal }),
    queryKey: ['topic-types-used', scope],
    retry: false,
    select: response => response.data,
    staleTime: 60_000
  })

  return scope === undefined ? undefined : data
}
