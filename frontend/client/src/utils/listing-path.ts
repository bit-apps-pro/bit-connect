/**
 * URL segment -> the topics filter a term archive pins.
 *
 * Mirrors PortalTaxonomies::map() on the server. A segment missing here renders
 * the not-found page rather than an unfiltered list: the server only claims URLs
 * whose term it resolved, so anything else reaching that route is not an archive.
 */
export const ARCHIVE_SEGMENT_FILTER: Record<string, string> = {
  department: 'departments',
  stage: 'stages',
  status: 'statuses',
  tag: 'tags',
  topic: 'topic-types'
}

/**
 * Whether a router path renders the topic list: the portal root, a deeper page
 * of it (`/page/2`), or a term archive (`/stage/planned`, `/tag/api`).
 *
 * Router paths never carry the portal basename, but may carry a trailing slash
 * when the site's permalinks end in one — see route-path.ts.
 */
export function isListingPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return true
  if (segments.length !== 2) return false

  // hasOwn, not `in`: a topic slugged `constructor` is not an archive.
  return segments[0] === 'page' || Object.hasOwn(ARCHIVE_SEGMENT_FILTER, segments[0])
}
