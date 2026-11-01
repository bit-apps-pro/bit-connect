import { ARCHIVE_SEGMENT_FILTER } from '@utils/listing-path'
import { useLocation } from 'react-router'

import config, { type PortalArchive } from '@/config/config'
import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

export interface SearchScope {
  archive: PortalArchive
  /** The term's name as the site shows it; its slug until the taxonomies load. */
  name: string
  slug: string
}

/**
 * The term archive the reader is on — a group, a tag, a topic type — which
 * the search box offers to search inside, as a chip the reader can remove.
 *
 * Read from the path alone, so it is whatever archive the server advertises:
 * one a plugin adds is scoped the same way as the plugin's own.
 */
export default function useSearchScope(): SearchScope | undefined {
  const { pathname } = useLocation()
  const taxonomies = useTaxonomiesStoreSelect()

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length !== 2) return undefined

  const [segment, rawSlug] = segments
  // hasOwn, not `in`: a topic slugged `constructor` is not an archive.
  if (!Object.hasOwn(ARCHIVE_SEGMENT_FILTER, segment)) return undefined

  const archive = config.PORTAL_ARCHIVES[segment]
  if (!archive) return undefined

  let slug = rawSlug
  try {
    slug = decodeURIComponent(rawSlug)
  } catch {
    // A malformed escape is the archive's own 404 to show; keep the raw slug.
  }

  const name = taxonomies?.[archive.taxonomy]?.find(term => term.slug === slug)?.name || slug

  return { archive, name, slug }
}
