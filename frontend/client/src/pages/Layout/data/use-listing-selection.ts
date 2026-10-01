import { useLocation, useSearchParams } from 'react-router'

import { type ListingSelection } from './listing-selection'

/**
 * The stage a reader chose for the listing, read off the URL.
 *
 * `stage` is one the reader named — `?stage=` or a stage archive. The root's
 * default stage is not named, so it is '' there, as it is when nothing is
 * chosen.
 *
 * `scope` is the archive the stages narrow, which this plugin never sets: its
 * listing is the whole forum, one stage at a time.
 */
export default function useListingSelection(): ListingSelection {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const [segment, termSlug = ''] = pathname.split('/').filter(Boolean)

  return {
    scope: '',
    stage: searchParams.get('stage') || (segment === 'stage' ? termSlug : '')
  }
}
