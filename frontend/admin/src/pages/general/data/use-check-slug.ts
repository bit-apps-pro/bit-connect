import useDebounceState from '@common/hooks/useDebounceState'
import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

export interface SlugCheck {
  /** A published page answers to this slug. */
  exists: boolean
  /** …and it contains the [bit-connect] shortcode. */
  hasShortcode: boolean
  /** …and it is the page carrying the portal today. */
  isPortal: boolean
  slug: string
  url: string
}

/** What is at a slug right now — the live hint under a slug field. */
export default function useCheckSlug(slug: string) {
  const trimmed = slug.trim()
  // Typing must not fire one request per keystroke — the check runs once the slug settles.
  const settled = useDebounceState(trimmed, 400)
  const isEnabled = settled.length >= 1
  // The typed slug has outrun the debounced one, so no verdict covers it yet.
  const isSettling = trimmed !== settled

  const { data, isFetching } = useQuery<ResponseType<SlugCheck>, Error, SlugCheck>({
    enabled: isEnabled,
    queryFn: ({ signal }) =>
      request<never, SlugCheck>(`portal-page/check?slug=${encodeURIComponent(settled)}`, {
        method: 'GET',
        signal
      }),
    queryKey: ['portal-slug-check', settled],
    retry: false,
    select: response => response?.data ?? (response as unknown as SlugCheck),
    staleTime: 10_000
  })

  return {
    // Never report the previous slug's verdict for the slug being typed.
    check: isEnabled && !isSettling ? data : undefined,
    isChecking: trimmed.length >= 1 && (isSettling || isFetching)
  }
}
