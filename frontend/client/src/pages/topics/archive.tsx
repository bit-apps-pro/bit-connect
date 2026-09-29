import { ARCHIVE_SEGMENT_FILTER as SEGMENT_FILTER } from '@utils/listing-path'
import { useMemo } from 'react'
import { useParams } from 'react-router'

import Error404 from '../Error404'
import Topics from './topic-list-page'

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
