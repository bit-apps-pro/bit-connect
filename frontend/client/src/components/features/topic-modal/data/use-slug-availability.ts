import queryRequest, { type Response } from '@common/helpers/request'
import useDebounceState from '@common/hooks/useDebounceState'
import { useQuery } from '@tanstack/react-query'
import { slugify } from '@utils/slug'

interface SlugCheckResponse {
  available: boolean
  /** The sanitized form of what was asked about, so a stale answer is detectable. */
  requested: string
  /** What the save would really store — the requested slug plus a `-2` if taken. */
  slug: string
}

export interface SlugAvailability {
  /**
   * False only for a settled verdict from the server. Anything unknown — still
   * typing, still in flight, request failed — reads as available, because the
   * check is advisory and must never be the reason a save looks blocked.
   */
  isAvailable: boolean
  isChecking: boolean
  /** The slug the save would store. Equals the typed one unless it is taken. */
  resolved: string
}

/**
 * Ask the server what would become of a slug if it were saved now.
 *
 * Advisory, not a reservation: two authors can both be told a slug is free and
 * the second save still gets the `-2`. The modals disclose the slug the server
 * actually returned, which is what closes that gap.
 *
 * @param value   the raw field text, not yet normalized — the input is only
 *                slugified on blur, so this does it before asking
 * @param topicId the topic being edited, so its own slug is not a clash
 */
export default function useSlugAvailability(value: string, topicId?: number): SlugAvailability {
  const slug = slugify(value)
  // Otherwise this is one request per letter of the slug as it is typed.
  const settled = useDebounceState(slug, 400)
  const isSettling = slug !== settled

  const { data, isFetching } = useQuery<Response<SlugCheckResponse>, Error, SlugCheckResponse>({
    enabled: settled.length > 0,
    queryFn: ({ signal }) =>
      queryRequest<SlugCheckResponse>(
        'topic-slug-check',
        undefined,
        topicId ? { slug: settled, topic_id: topicId } : { slug: settled },
        'GET',
        { signal }
      ),
    queryKey: ['topic-slug-check', settled, topicId ?? 0],
    retry: false,
    select: response => response.data,
    staleTime: 30_000
  })

  // A verdict only ever covers the slug it was asked about. Matching on
  // `requested` rather than trusting the query key keeps the previous slug's
  // answer off screen while the next one is still in flight.
  const verdict = !isSettling && data?.requested === slug ? data : undefined

  return {
    isAvailable: verdict?.available ?? true,
    isChecking: slug.length > 0 && (isSettling || isFetching),
    resolved: verdict?.slug ?? slug
  }
}
