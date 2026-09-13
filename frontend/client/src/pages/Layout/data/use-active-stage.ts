import config from '@config/config'
import { isSameSlug } from '@utils/slug'
import { matchPath, useLocation, useSearchParams } from 'react-router'

import { useSinglePostStore } from '@/store/single-post.zustand'

/**
 * The path segments of the term archives that are not stages — the same set
 * pages/topics/archive.tsx routes, minus `stage`, which is handled above.
 * Listed so `/page/2` and `/user/someone` are not mistaken for archives.
 */
const TERM_ARCHIVE_SEGMENTS = new Set(['department', 'status', 'tag', 'topic'])

/** The parts of the loaded topic the sidebar needs to place it in a stage. */
export interface ActiveTopic {
  post_name: string
  /** Slug of its stage term, or undefined for a topic that is in none. */
  stage?: string
}

/**
 * Which stage the sidebar marks as current, for a given location.
 *
 * Kept apart from the hook so the routing rules can be exercised without a
 * router or a store.
 *
 * @param defaultStage the stage the listing falls back to when nothing names one
 * @param pathname     the router's current path, basename already stripped
 * @param stageParam   `?stage=` from the URL, or null
 * @param topic        the topic currently held by the single-post store
 */
export function resolveActiveStage({
  defaultStage,
  pathname,
  spansAllStages = false,
  stageParam,
  topic
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
  topic?: ActiveTopic
}): string | undefined {
  // The listing is the one page whose stage the reader picked rather than one
  // the URL implies, so its query string wins wherever it appears.
  if (stageParam) return stageParam

  // A stage archive (`/stage/publish`) is that stage, stated in the path
  // instead of the query string.
  const archive = matchPath('/stage/:termSlug', pathname)
  if (archive) return archive.params.termSlug

  // Any other term archive (`/tag/api`, `/topic/question`) lists that term's
  // topics from every stage, and so does a listing that is searching or
  // filtering by tag. No stage applies, so none is marked — lighting up the
  // default would claim a filter the list is not applying.
  const termArchive = matchPath('/:archiveSegment/:termSlug', pathname)
  if ((termArchive && TERM_ARCHIVE_SEGMENTS.has(termArchive.params.archiveSegment ?? '')) || spansAllStages) {
    return undefined
  }

  // A topic URL names no stage, but a topic sits in exactly one and the listing
  // it was opened from was filtered to that stage — so the topic's own term is
  // the stage the reader came through, and the one to keep marked. Falling back
  // to the default here is what used to throw the highlight onto a stage the
  // reader had never been in.
  const single = matchPath('/:postName', pathname)
  if (single?.params.postName) {
    // Until the topic under *this* URL has loaded, mark nothing: the store may
    // still hold the previously read topic, and lighting up its stage for a
    // frame is the same wrong answer in a shorter window.
    return topic && isSameSlug(topic.post_name, single.params.postName) ? topic.stage : undefined
  }

  // Everything else — a user profile, the notifications page — is not a stage
  // context, and the default is the listing those pages link back to.
  return defaultStage
}

/**
 * The stage slug the sidebar should show as current.
 *
 * Undefined where no stage applies yet, which leaves every nav item unmarked.
 */
export default function useActiveStage(): string | undefined {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const post = useSinglePostStore(state => state.post)

  return resolveActiveStage({
    defaultStage: config.DEFAULT_STAGE_SLUG,
    pathname,
    // Mirrors the rule in pages/topics/topics.tsx.
    spansAllStages: Boolean(searchParams.get('search') || searchParams.get('tags')),
    stageParam: searchParams.get('stage'),
    topic: post && { post_name: post.post_name, stage: post.terms?.stages?.slug }
  })
}
