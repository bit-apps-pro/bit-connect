import { cn } from '@common/helpers/globalHelpers'
import { __, sprintf } from '@common/helpers/i18nWrap'
import usePageTitle from '@common/hooks/usePageTitle'
import { type Stage, useStagesStore } from '@pages/Layout/data/use-stages'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Button } from 'antd'
import { useEffect, useMemo } from 'react'
import { LuSearchX } from 'react-icons/lu'
import { Link, useSearchParams } from 'react-router'

import config, { type PortalArchive } from '@/config/config'
import { fetchAllPostsApi } from '@/store/data/fetch-all-posts-api'
import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'
import { routePath } from '@/utils/route-path'

import ChoiceChip, { type Choice } from '../topics/choice-chip'
import RoadmapCard, { RoadmapCardSkeleton } from './roadmap-card'
import { FIRST_PAGE, mergeTopics, MORE_SIZE, nextPageParam, OWN_TAXONOMIES, placeArchives } from './roadmap-data'
import { ROADMAP_PATH } from './roadmap-path'

/** Placeholder cards a column shows while its first page loads. */
const SKELETON_CARDS = 3

function useRoadmapFilters() {
  const [searchParams] = useSearchParams()
  const taxonomies = useTaxonomiesStoreSelect()

  return useMemo(() => {
    const archives = Object.values(config.PORTAL_ARCHIVES).filter(
      archive =>
        !OWN_TAXONOMIES.has(archive.taxonomy) &&
        // The listing's own switch for the type filter covers this one too.
        (archive.filter !== 'topic-types' || config.PORTAL_FILTERS.types)
    )

    const pickers = archives
      .map(archive => ({ archive, terms: taxonomies?.[archive.taxonomy] ?? [] }))
      .filter(({ terms }) => terms.length > 0)

    const applied: Record<string, string> = {}
    for (const { archive } of pickers) {
      const value = searchParams.get(archive.filter)
      if (value) applied[archive.filter] = value
    }

    return { applied, pickers }
  }, [searchParams, taxonomies])
}

/** The roadmap's own URL with one filter set (or cleared), the others kept. */
function filterLink(searchParams: URLSearchParams, archive: PortalArchive, slug: string) {
  const next = new URLSearchParams(searchParams)
  if (slug) next.set(archive.filter, slug)
  else next.delete(archive.filter)
  const query = next.toString()

  return routePath(`${ROADMAP_PATH}${query ? `?${query}` : ''}`)
}

/**
 * The stages laid side by side, one column each, so how far every topic has
 * come reads at a glance. The stage new topics land in is left out: it is the
 * inbox, not a step of the plan, and the listing already opens on it.
 */
export default function Roadmap() {
  const { fetchStages, stages } = useStagesStore()
  const [searchParams] = useSearchParams()
  const { applied, pickers } = useRoadmapFilters()

  useEffect(() => {
    fetchStages()
  }, [fetchStages])

  usePageTitle(__('Roadmap'))

  const columns = stages.filter(stage => stage.slug !== config.DEFAULT_STAGE_SLUG)
  const isFiltered = Object.keys(applied).length > 0

  // One count across every column, asked only while a filter is on: a filter
  // that matches nothing gets one message saying so, rather than a column of
  // "No topics yet" per stage — which reads as an empty roadmap, not a filter
  // that missed. The API takes the stages as one comma-separated filter.
  const stageSlugs = columns.map(stage => stage.slug).join(',')
  const { data: matching } = useQuery({
    enabled: isFiltered && stageSlugs !== '',
    queryFn: () => fetchAllPostsApi({ ...applied, page: 1, per_page: 1, stages: stageSlugs }),
    queryKey: ['roadmap-count', stageSlugs, applied]
  })
  const nothingMatches = isFiltered && matching?.pagination.total === 0

  return (
    <div className="bc-flex bc-flex-col bc-gap-6 bc-p-4 sm:bc-p-5 lg:bc-p-8">
      <header className="bc-flex bc-flex-col bc-gap-4 md:bc-flex-row md:bc-items-start md:bc-justify-between">
        <div className="bc-flex bc-min-w-0 bc-flex-col bc-gap-1.5">
          <h1 className="bc-m-0 bc-text-[28px] bc-font-bold bc-leading-tight bc-tracking-tight bc-text-ink md:bc-text-[34px]">
            {__('Roadmap')}
          </h1>
          <p className="bc-m-0 bc-text-[15px] bc-text-ink-muted">
            {__('What we’re planning, building and have shipped. Vote on a card to move it up.')}
          </p>
        </div>
        {pickers.length > 0 && (
          <div className="bc-flex bc-shrink-0 bc-flex-wrap bc-items-center bc-gap-2">
            {pickers.map(({ archive, terms }) => {
              const current = applied[archive.filter] ?? ''
              const choices: Choice[] = [
                {
                  isSelected: current === '',
                  label: __('All'),
                  to: filterLink(searchParams, archive, '')
                },
                ...terms.map(term => ({
                  isSelected: term.slug === current,
                  label: term.name,
                  to: filterLink(searchParams, archive, term.slug)
                }))
              ]
              const title = archive.filter === 'topic-types' ? __('Type') : archive.label

              return <ChoiceChip alwaysTitled choices={choices} key={archive.filter} title={title} />
            })}
          </div>
        )}
      </header>

      {columns.length === 0 && <p className="bc-m-0 bc-text-ink-muted">{__('Nothing is on the roadmap yet.')}</p>}

      {nothingMatches && (
        <div className="bc-flex bc-flex-col bc-items-center bc-gap-3 bc-rounded-[16px] bc-border bc-border-dashed bc-border-line bc-px-6 bc-py-14 bc-text-center">
          <span className="bc-flex bc-h-12 bc-w-12 bc-items-center bc-justify-center bc-rounded-full bc-bg-surface-sunken bc-text-ink-muted">
            <LuSearchX aria-hidden size={22} />
          </span>
          <p className="bc-m-0 bc-text-base bc-font-semibold bc-text-ink">{__('No topics match these filters')}</p>
          <p className="bc-m-0 bc-text-sm bc-text-ink-muted">{__('Try another one, or see the whole roadmap.')}</p>
          <Link className="bc-text-sm bc-font-medium bc-text-primary hover:bc-underline" to={routePath(ROADMAP_PATH)}>
            {__('Clear filters')}
          </Link>
        </div>
      )}

      {columns.length > 0 && !nothingMatches && (
        // One row of equal columns, the stages side by side. Below lg it
        // scrolls sideways once they no longer fit, and on a phone each column
        // is most of the screen and snaps into place with the next peeking in.
        // From lg the columns always fit — so nothing here scrolls, and each
        // column's heading can stay pinned to the top of the page's own scroll
        // as its cards go by (a sideways scroller would trap it).
        <div
          className="bc--mx-4 bc-grid bc-snap-x bc-snap-mandatory bc-auto-cols-[85%] bc-grid-flow-col bc-items-start bc-gap-4 bc-overflow-x-auto bc-scroll-px-4 bc-px-4 bc-pb-2 sm:bc-mx-0 sm:bc-auto-cols-[minmax(18rem,1fr)] sm:bc-snap-none sm:bc-px-0 lg:bc-auto-cols-[minmax(0,1fr)] lg:bc-gap-6 lg:bc-overflow-visible"
          style={{ scrollbarWidth: 'thin' }}
        >
          {columns.map((stage, index) => (
            <RoadmapColumn filters={applied} isLast={index === columns.length - 1} key={stage.id} stage={stage} />
          ))}
        </div>
      )}
    </div>
  )
}

function RoadmapColumn({
  filters,
  isLast,
  stage
}: {
  filters: Record<string, string>
  /** The furthest stage — Shipped, say — whose cards say when they got there. */
  isLast: boolean
  stage: Stage
}) {
  const queryKey = ['roadmap', stage.slug, filters]
  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isPending } = useInfiniteQuery({
    getNextPageParam: nextPageParam,
    initialPageParam: FIRST_PAGE,
    queryFn: ({ pageParam }) =>
      // Most votes first, newest among equals — the server's order, so it
      // holds across every page "Show more" adds.
      fetchAllPostsApi({
        ...filters,
        page: pageParam.page,
        per_page: pageParam.perPage,
        sortBy: 'votes',
        stages: stage.slug
      }),
    queryKey
  })

  const topics = useMemo(() => mergeTopics(data?.pages ?? []), [data])
  const total = data?.pages[0]?.pagination.total ?? 0
  const remaining = Math.max(0, total - topics.length)
  // Not the archive the roadmap is narrowed to: with one board picked, every
  // card would name the same one.
  const places = useMemo(() => placeArchives().filter(archive => !filters[archive.filter]), [filters])
  // The raw hue: a dot carries no text, so it needs none of a chip's contrast.
  const dot = stage.meta?.bit_connect_color || undefined

  return (
    <section
      aria-busy={isPending}
      aria-label={stage.name}
      className="bc-flex bc-snap-start bc-flex-col bc-gap-3 bc-rounded-[16px] bc-bg-surface-sunken bc-px-3 bc-pb-3 sm:bc-px-4 sm:bc-pb-4"
    >
      {/* Carries the column's top padding itself, so that pinned it still
          covers the cards scrolling under it, edge to edge. */}
      <header className="bc--mx-3 bc-flex bc-items-center bc-gap-2.5 bc-rounded-t-[16px] bc-bg-surface-sunken bc-px-4 bc-pb-1 bc-pt-4 sm:bc--mx-4 sm:bc-px-5 sm:bc-pt-5 lg:bc-sticky lg:bc-top-0 lg:bc-z-20">
        <span
          aria-hidden
          // The fallback class only when there is no hue: the utilities are
          // `!important`, so beside it the inline colour would never show.
          className={cn(['bc-h-2.5 bc-w-2.5 bc-shrink-0 bc-rounded-full', !dot && 'bc-bg-ink-subtle'])}
          style={dot ? { backgroundColor: dot } : undefined}
        />
        <h2 className="bc-m-0 bc-min-w-0 bc-truncate bc-text-[17px] bc-font-semibold bc-text-ink">{stage.name}</h2>
        {isPending ? (
          <span aria-hidden className="bc-h-6 bc-w-7 bc-animate-pulse bc-rounded-full bc-bg-surface" />
        ) : (
          <span className="bc-inline-flex bc-h-6 bc-min-w-6 bc-items-center bc-justify-center bc-rounded-full bc-bg-surface bc-px-2 bc-text-xs bc-font-semibold bc-text-ink-muted">
            {total}
          </span>
        )}
      </header>

      {isPending &&
        Array.from({ length: SKELETON_CARDS }, (_, index) => <RoadmapCardSkeleton key={index} />)}
      {isError && <p className="bc-m-0 bc-px-1 bc-text-sm bc-text-ink-muted">{__('Failed to load topics')}</p>}
      {!isPending && !isError && topics.length === 0 && (
        <p className="bc-m-0 bc-rounded-[12px] bc-border bc-border-dashed bc-border-line bc-px-4 bc-py-6 bc-text-center bc-text-sm bc-text-ink-subtle">
          {__('No topics yet')}
        </p>
      )}

      {topics.map(topic => (
        <RoadmapCard
          arrived={isLast ? stage.name : ''}
          key={topic.ID}
          places={places}
          queryKey={queryKey}
          topic={topic}
        />
      ))}

      {hasNextPage && remaining > 0 && (
        <Button
          block
          className="bc-h-10 bc-rounded-[10px] bc-border-line bc-bg-surface bc-font-medium bc-text-ink hover:bc-border-primary hover:bc-text-primary"
          loading={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {/* translators: %d: how many more cards the click adds. */}
          {sprintf(__('Show %d more'), Math.min(MORE_SIZE, remaining))}
        </Button>
      )}
    </section>
  )
}
