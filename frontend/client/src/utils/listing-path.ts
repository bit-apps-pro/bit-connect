import config from '@config/config'

import { routePath } from './route-path'

/**
 * URL segment -> the topics filter a term archive pins.
 *
 * Mirrors PortalTaxonomies::map() on the server, which sends it — an archive a
 * plugin adds arrives under whatever segment it serves. A segment missing here
 * renders the not-found page rather than an unfiltered list: the server only
 * claims URLs whose term it resolved, so anything else reaching that route is
 * not an archive.
 */
export const ARCHIVE_SEGMENT_FILTER: Record<string, string> = Object.fromEntries(
  Object.entries(config.PORTAL_ARCHIVES).map(([segment, archive]) => [segment, archive.filter])
)

/**
 * Router path of a term's archive, from the topics filter it pins — `/tag/api`
 * for `('tags', 'api')`.
 *
 * The one page the server advertises for the term, so every link to a term
 * lands there rather than on a filtered listing that canonicalises to it. A
 * filter no archive serves falls back to that listing, which is the only page
 * there is for it.
 */
export function archivePath(filter: string, slug: string): string {
  const segment = Object.entries(config.PORTAL_ARCHIVES).find(([, archive]) => archive.filter === filter)?.[0]

  return routePath(segment ? `/${segment}/${slug}` : `/?${filter}=${encodeURIComponent(slug)}`)
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
