import { cn } from '@common/helpers/globalHelpers'
import { __, sprintf } from '@common/helpers/i18nWrap'
import usePageTitle from '@common/hooks/usePageTitle'
import { type Topic } from '@features/topic-modal/shared/type'
import { type Stage, useStagesStore } from '@pages/Layout/data/use-stages'
import { listingLink } from '@pages/Layout/ui/Sidebar/listing-link'
import { useQuery } from '@tanstack/react-query'
import { Tag } from 'antd'
import { useEffect } from 'react'
import { LuArrowUp, LuMessageCircle } from 'react-icons/lu'
import { Link } from 'react-router'

import config from '@/config/config'
import { fetchAllPostsApi } from '@/store/data/fetch-all-posts-api'
import { routePath } from '@/utils/route-path'
import useChipProps from '@/utils/use-chip-props'

/** Cards a column shows before handing over to the stage's own listing. */
const COLUMN_SIZE = 20

/**
 * The stages laid side by side, one column each, so how far every topic has
 * come reads at a glance. The stage new topics land in is left out: it is the
 * inbox, not a step of the plan, and the listing already opens on it.
 */
export default function Roadmap() {
  const { fetchStages, stages } = useStagesStore()

  useEffect(() => {
    fetchStages()
  }, [fetchStages])

  usePageTitle(__('Roadmap'))

  const columns = stages.filter(stage => stage.slug !== config.DEFAULT_STAGE_SLUG)

  return (
    <div className="bc-flex bc-flex-col bc-gap-5 bc-p-4 sm:bc-p-3 lg:bc-p-6">
      <header className="bc-flex bc-flex-col bc-gap-1">
        <h1 className="bc-m-0 bc-text-2xl bc-font-semibold bc-text-ink">{__('Roadmap')}</h1>
        <p className="bc-m-0 bc-text-sm bc-text-ink-muted">
          {__('What is planned, being worked on and done. Open a topic to vote or comment on it.')}
        </p>
      </header>

      {columns.length === 0 ? (
        <p className="bc-m-0 bc-text-ink-muted">{__('Nothing is on the roadmap yet.')}</p>
      ) : (
        // One row that scrolls sideways once the columns no longer fit, rather
        // than stacking: the board's point is the stages side by side.
        <div
          className="bc-grid bc-auto-cols-[minmax(17rem,1fr)] bc-grid-flow-col bc-items-start bc-gap-4 bc-overflow-x-auto bc-pb-2"
          style={{ scrollbarWidth: 'thin' }}
        >
          {columns.map(stage => (
            <RoadmapColumn key={stage.id} stage={stage} />
          ))}
        </div>
      )}
    </div>
  )
}

function RoadmapColumn({ stage }: { stage: Stage }) {
  const { data, isError, isPending } = useQuery({
    queryFn: () => fetchAllPostsApi({ page: 1, per_page: COLUMN_SIZE, sortBy: 'newest', stages: stage.slug }),
    queryKey: ['roadmap', stage.slug]
  })

  const topics = data?.topics ?? []
  const total = data?.pagination.total ?? 0
  // The raw hue: a dot carries no text, so it needs none of a chip's contrast.
  const dot = stage.meta?.bit_connect_color || undefined

  return (
    <section
      aria-label={stage.name}
      className="bc-flex bc-flex-col bc-gap-3 bc-rounded-lg bc-bg-surface-sunken bc-p-3"
    >
      <header className="bc-flex bc-items-center bc-gap-2 bc-px-1">
        <span
          aria-hidden
          // The fallback class only when there is no hue: the utilities are
          // `!important`, so beside it the inline colour would never show.
          className={cn(['bc-h-2.5 bc-w-2.5 bc-shrink-0 bc-rounded-full', !dot && 'bc-bg-ink-subtle'])}
          style={dot ? { backgroundColor: dot } : undefined}
        />
        <h2 className="bc-m-0 bc-min-w-0 bc-truncate bc-text-base bc-font-semibold bc-text-ink">{stage.name}</h2>
        {!isPending && (
          <span className="bc-rounded-full bc-bg-surface bc-px-2 bc-text-xs bc-font-semibold bc-text-ink-muted">
            {total}
          </span>
        )}
      </header>

      {isPending && <p className="bc-m-0 bc-px-1 bc-text-sm bc-text-ink-muted">{__('Loading…')}</p>}
      {isError && <p className="bc-m-0 bc-px-1 bc-text-sm bc-text-ink-muted">{__('Failed to load topics')}</p>}
      {!isPending && !isError && topics.length === 0 && (
        <p className="bc-m-0 bc-px-1 bc-text-sm bc-text-ink-muted">{__('No topics yet')}</p>
      )}

      {topics.map(topic => (
        <RoadmapCard key={topic.ID} topic={topic} />
      ))}

      {total > topics.length && (
        <Link className="bc-px-1 bc-text-sm bc-font-medium" to={listingLink({ stage: stage.slug })}>
          {/* translators: %d: how many topics the stage holds. */}
          {sprintf(__('See all %d'), total)}
        </Link>
      )}
    </section>
  )
}

function RoadmapCard({ topic }: { topic: Topic }) {
  const { chipTagProps } = useChipProps()
  const type = topic.terms.topic_types

  return (
    <Link
      className="bc-flex bc-flex-col bc-gap-2 bc-rounded-md bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-3 bc-text-ink bc-no-underline bc-transition-colors hover:bc-border-line-strong"
      to={routePath(`/${topic.post_name}`)}
    >
      <span className="bc-text-[15px] bc-font-semibold bc-leading-snug">{topic.post_title}</span>
      <span className="bc-flex bc-items-center bc-gap-3 bc-text-xs bc-text-ink-muted">
        <span className="bc-inline-flex bc-items-center bc-gap-1" title={__('Votes')}>
          <LuArrowUp aria-hidden size={14} />
          {topic.vote.total}
        </span>
        <span className="bc-inline-flex bc-items-center bc-gap-1" title={__('Comments')}>
          <LuMessageCircle aria-hidden size={14} />
          {topic.comments_count}
        </span>
        {type && (
          <Tag className="bc-m-0 bc-ml-auto bc-max-w-[60%] bc-truncate" {...chipTagProps(type.meta.color)}>
            {type.name}
          </Tag>
        )}
      </span>
    </Link>
  )
}
