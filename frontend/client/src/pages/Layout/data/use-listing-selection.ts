import config from '@config/config'
import { useLocation, useSearchParams } from 'react-router'

/**
 * The department and stage a reader chose for the listing, read off the URL.
 *
 * `department` is the one whose archive this is (`/department/bit-crm`, under
 * the segment the server names), or `?product=` on links shared before the
 * sidebar took the choice over from the toolbar's picker. `stage` is one the
 * reader named — `?stage=` or a stage archive. The root's default stage is not
 * named, so opening a department from `/` lands on its bare archive, the URL
 * search indexes, rather than on a `?stage=` view of it. Both are '' when
 * nothing is chosen.
 *
 * No department is ever open while an admin has the department filter switched
 * off. Its archive still exists — a topic links to its own — but with the list
 * hidden there is nothing to leave it by, so the stage links must not keep it.
 */
export default function useListingSelection() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const [segment, termSlug = ''] = pathname.split('/').filter(Boolean)

  const department =
    segment === config.DEPARTMENT_NAMING.slug ? termSlug : (searchParams.get('product') ?? '')

  return {
    department: config.PORTAL_FILTERS.product ? department : '',
    stage: searchParams.get('stage') || (segment === 'stage' ? termSlug : '')
  }
}
