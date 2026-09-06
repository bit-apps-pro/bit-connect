import { useMemo } from 'react'
import { useParams } from 'react-router'

import Error404 from '../Error404'
import Topics from './topics'

/**
 * URL segment -> the topics filter it pins.
 *
 * Mirrors PortalTaxonomies::map() on the server. A segment missing here renders
 * the not-found page rather than an unfiltered list: the server only claims URLs
 * whose term it resolved, so anything else reaching this route is not an archive.
 */
const SEGMENT_FILTER: Record<string, string> = {
  department: 'departments',
  stage: 'stages',
  status: 'statuses',
  tag: 'tags',
  topic: 'topic-types'
}

/**
 * A term archive, e.g. `/tag/api` or `/topic/question`.
 *
 * The filter comes from the path, not the query string, so the canonical URL the
 * server advertised survives hydration unchanged.
 */
export default function TopicArchive() {
  const { archiveSegment = '', termSlug = '' } = useParams()

  const filterKey = SEGMENT_FILTER[archiveSegment]

  const archiveFilter = useMemo(
    () => (filterKey && termSlug ? { [filterKey]: termSlug } : undefined),
    [filterKey, termSlug]
  )

  if (!archiveFilter) return <Error404 />

  return <Topics archiveFilter={archiveFilter} />
}
