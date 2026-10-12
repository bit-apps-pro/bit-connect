import { ARCHIVE_SEGMENT_FILTER as SEGMENT_FILTER } from '@utils/listing-path'
import { useMemo } from 'react'
import { useParams } from 'react-router'

import Error404 from '../Error404'
import archivePageFor from './archive-page-for'
import Topics from './topic-list-page'
import TopicList from './topics'

/**
 * A term archive, e.g. `/tag/api` or `/topic/question`.
 *
 * The filter comes from the path, not the query string, so the canonical URL the
 * server advertised survives hydration unchanged.
 *
 * Its heading over its list — unless a plugin lays the archive out as a page
 * of its own, which is then handed the list to place.
 */
export default function TopicArchive() {
  const { archiveSegment = '', termSlug = '' } = useParams()

  const filterKey = SEGMENT_FILTER[archiveSegment]

  const archiveFilter = useMemo(
    () => (filterKey && termSlug ? { [filterKey]: termSlug } : undefined),
    [filterKey, termSlug]
  )

  if (!archiveFilter) return <Error404 />

  const Page = archivePageFor?.(filterKey)

  if (Page) {
    return <Page list={<TopicList archiveFilter={archiveFilter} showArchiveHeader={false} />} termSlug={termSlug} />
  }

  return <Topics archiveFilter={archiveFilter} />
}
