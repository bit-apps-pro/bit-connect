import { parseMaybeGmt } from '@common/helpers/globalHelpers'
import { type Topic } from '@features/topic-modal/shared/type'
import { type InfiniteData } from '@tanstack/react-query'

import config, { type PortalArchive } from '@/config/config'
import { type TopicsPage } from '@/store/data/fetch-all-posts-api'
import { type Vote } from '@/store/helper/vote-flip'

/** Cards a column shows at first. */
export const COLUMN_SIZE = 20

/** Cards each "Show more" adds. COLUMN_SIZE must be a multiple of it — see nextPageParam. */
export const MORE_SIZE = 10

export interface RoadmapPageParam {
  page: number
  perPage: number
}

export const FIRST_PAGE: RoadmapPageParam = { page: 1, perPage: COLUMN_SIZE }

/**
 * The archives the board can be narrowed by: the topic type, and any a plugin
 * adds (a topic's board, say). Stages are the columns themselves, and tags and
 * statuses are not one-per-topic, so a picker of them would not partition it.
 */
export const OWN_TAXONOMIES = new Set(['bit-connect-stages', 'bit-connect-statuses', 'bit-connect-tags'])

/** This plugin's own taxonomies; every other archive is one a plugin added. */
const FREE_TAXONOMIES = new Set(['bit-connect-topic-types', ...OWN_TAXONOMIES])

/**
 * The archives a plugin adds — a topic's board, say — whose term each card
 * names as the place it was posted. Read from the server's archive map, so
 * this plugin names none of them itself.
 */
export const placeArchives = (): PortalArchive[] =>
  Object.values(config.PORTAL_ARCHIVES).filter(archive => !FREE_TAXONOMIES.has(archive.taxonomy))

/**
 * The page after those loaded, or undefined once the stage is exhausted.
 *
 * The API pages by number, so the first COLUMN_SIZE cards are one page of that
 * size and every load after is a page of MORE_SIZE counted from the start:
 * with 20 then 10, page 3 of 10 is cards 21–30.
 */
export function nextPageParam(last: TopicsPage, pages: TopicsPage[]): RoadmapPageParam | undefined {
  const loaded = COLUMN_SIZE + MORE_SIZE * (pages.length - 1)

  return loaded < last.pagination.total ? { page: loaded / MORE_SIZE + 1, perPage: MORE_SIZE } : undefined
}

/**
 * Every topic loaded so far, once each, most votes first.
 *
 * Once each: votes cast by others between two loads can shift a card across
 * the page boundary, and offset paging would then hand it back twice. Sorted
 * again here only so a vote just cast moves its card at once rather than on
 * the next fetch — stably, so equal counts keep the server's newest-first order.
 */
export function mergeTopics(pages: TopicsPage[]): Topic[] {
  const seen = new Set<number>()

  return pages
    .flatMap(page => page.topics)
    .filter(topic => {
      if (seen.has(topic.ID)) return false
      seen.add(topic.ID)
      return true
    })
    .sort((a, b) => (b.vote?.total ?? 0) - (a.vote?.total ?? 0))
}

/** A column's cached pages with one topic's vote replaced, wherever it was loaded. */
export function withVote(
  data: InfiniteData<TopicsPage> | undefined,
  postId: number,
  vote: Vote
): InfiniteData<TopicsPage> | undefined {
  if (!data) return data

  return {
    ...data,
    pages: data.pages.map(page => ({
      ...page,
      topics: page.topics.map(topic => (topic.ID === postId ? { ...topic, vote } : topic))
    }))
  }
}

/**
 * "Sep 28", or "Sep 28, 2025" outside the current year — in the page's own
 * language, which WordPress sets on the document. '' for a date it cannot read.
 */
export function shortDate(
  gmt: string,
  { lang = document.documentElement.lang || undefined, now = new Date() }: { lang?: string; now?: Date } = {}
): string {
  const date = parseMaybeGmt(gmt)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString(lang, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' })
  })
}

/** The term names a topic is filed under in each of these archives, by archive. */
export function placeNames(topic: Topic, archives: PortalArchive[]): { label: string; name: string }[] {
  return archives.flatMap(archive => {
    const term = topic.terms?.[archive.filter]
    const terms = Array.isArray(term) ? term : term ? [term] : []

    return terms.map(item => ({ label: archive.label, name: item.name }))
  })
}
