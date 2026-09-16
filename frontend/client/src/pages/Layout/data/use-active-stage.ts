import config from '@config/config'
import { matchPath, useLocation, useSearchParams } from 'react-router'

/**
 * Which stage the sidebar marks as current, for a given location.
 *
 * Only the two routes that *are* a stage listing mark one: the portal root,
 * which lists the default stage, and a stage archive, which names its own. A
 * topic, a profile, the notifications page and the other term archives mark
 * nothing — the sidebar says which listing you are in, and none of those is a
 * listing. Marking a stage there would claim a filter the page is not applying,
 * and on a topic it would point at a stage the reader may never have been in.
 *
 * Kept apart from the hook so the routing rules can be exercised without a
 * router.
 *
 * @param defaultStage the stage the portal root lists when nothing names one
 * @param pathname     the router's current path, basename already stripped
 * @param stageParam   `?stage=` from the URL, or null
 */
export function resolveActiveStage({
  defaultStage,
  pathname,
  spansAllStages = false,
  stageParam
}: {
  defaultStage: string
  pathname: string
  /**
   * The listing is answering a search or a tag filter, which the topics page
   * runs across every stage rather than the default one.
   */
  spansAllStages?: boolean
  /** Absent on the routes that carry no query string; `get()` yields null. */
  stageParam?: null | string
}): string | undefined {
  // `?stage=` is no longer the form the sidebar hands out — it links the stage
  // archives below — but it stays the most explicit answer available: it is
  // what links shared before the change carry, and what the listing route uses
  // when a reader names a stage on a page that is not an archive. So it still
  // wins wherever it appears.
  if (stageParam) return stageParam

  // A stage archive (`/stage/planned`) is that stage, stated in the path. This
  // is the sidebar's own link target, so it is the branch that marks the nav on
  // an ordinary click. Matched with and without a trailing slash, because the
  // server redirects to the site's permalink form before this ever runs.
  const archive = matchPath('/stage/:termSlug', pathname)
  if (archive) return archive.params.termSlug

  // A search or a tag filter is a question about the whole forum, which the
  // listing answers across every stage — so the root is no longer the default
  // stage's listing while one is running.
  if (spansAllStages) return undefined

  // The portal root, and the deeper pages of it that exist as a crawl path.
  // Everything else is not a stage listing and marks nothing.
  const listing = matchPath('/', pathname) ?? matchPath('/page/:pageNumber', pathname)

  return listing ? defaultStage : undefined
}

/**
 * The stage slug the sidebar should show as current.
 *
 * Undefined on every route that is not a stage listing, which leaves each nav
 * item unmarked.
 */
export default function useActiveStage(): string | undefined {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()

  return resolveActiveStage({
    defaultStage: config.DEFAULT_STAGE_SLUG,
    pathname,
    // Mirrors the rule in pages/topics/topics.tsx.
    spansAllStages: Boolean(searchParams.get('search') || searchParams.get('tags')),
    stageParam: searchParams.get('stage')
  })
}
