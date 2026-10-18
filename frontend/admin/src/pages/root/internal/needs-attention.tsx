import { __ } from '@common/helpers/i18nWrap'
import { Grid } from 'antd'
import { type ReactNode } from 'react'
import { LuArrowRight } from 'react-icons/lu'
import { Link } from 'react-router'

import { fullDate, timeAgo } from '@/utils/format'

import { type DashboardAttention, type UnansweredTopic } from '../shared/types'
import DashboardCard from './dashboard-card'
import TopicTable, { type TopicColumn } from './topic-table'
import TopicTitleLink from './topic-title-link'

interface QueueProps {
  action: string
  count: number
  /** The first tile lines up with the card title; the others sit after a rule. */
  first?: boolean
  label: string
  /** An admin route, or an absolute wp-admin URL, which opens in the same tab. */
  /** One under another, on a screen too narrow for three side by side. */
  stacked?: boolean
  to: string
  /** Drawn in the warning colour while it is not zero. */
  urgent?: boolean
}

/**
 * One queue as a count and the way to work through it. The whole tile is the
 * link, so the number itself can be clicked.
 */
function Queue({ action, count, first, label, stacked, to, urgent }: QueueProps) {
  // One padding per tile rather than a base and an `sm:` override: in the admin
  // the base utility wins over the responsive one on the same property. On a
  // phone the tiles stack, ruled off above rather than beside each other.
  const rule = stacked ? 'bc-border-t' : 'bc-border-l'
  const className = `bc-group bc-flex bc-min-w-0 bc-flex-col bc-gap-1 bc-py-4 bc-pr-4 bc-text-inherit bc-no-underline hover:bc-bg-surface-hover ${
    first ? 'bc-pl-6' : `bc-border-0 ${rule} bc-border-solid bc-border-line ${stacked ? 'bc-pl-6' : 'bc-pl-4'}`
  }`
  const content: ReactNode = (
    <>
      <span
        className={`bc-text-2xl bc-font-semibold bc-leading-tight bc-tabular-nums ${
          urgent && count > 0 ? 'bc-text-negative' : 'bc-text-ink'
        }`}
      >
        {count.toLocaleString()}
      </span>
      <span className="bc-text-sm bc-text-ink-muted">{label}</span>
      <span className="bc-mt-1 bc-inline-flex bc-items-center bc-gap-1 bc-text-xs bc-font-medium bc-text-primary group-hover:bc-underline">
        {action}
        <LuArrowRight aria-hidden />
      </span>
    </>
  )

  if (/^https?:\/\//.test(to)) {
    return (
      <a className={className} href={to}>
        {content}
      </a>
    )
  }

  return (
    <Link className={className} to={to}>
      {content}
    </Link>
  )
}

interface NeedsAttentionProps {
  attention: DashboardAttention
  className?: string
  topics: UnansweredTopic[]
}

/**
 * What is waiting on someone: the moderation queues as counts that lead to
 * them, then the topics that have waited longest for a first comment, so the
 * dashboard names them instead of only counting them.
 */
export default function NeedsAttention({ attention, className, topics }: NeedsAttentionProps) {
  const isClear = attention.reports === 0 && attention.pendingReplies === 0 && attention.unanswered === 0
  const stacked = !Grid.useBreakpoint().sm

  const columns: TopicColumn<UnansweredTopic>[] = [
    {
      className: 'bc-min-w-48',
      key: 'title',
      render: topic => <TopicTitleLink title={topic.title} url={topic.url} />,
      title: __('Oldest waiting for a comment')
    },
    {
      key: 'author',
      render: topic => <span className="bc-text-ink-muted">{topic.author ?? __('Deleted member')}</span>,
      title: __('Author')
    },
    {
      align: 'right',
      className: 'bc-whitespace-nowrap',
      key: 'waiting',
      render: topic => (
        <time className="bc-text-ink-muted" dateTime={topic.created_at} title={fullDate(topic.created_at)}>
          {timeAgo(topic.created_at)}
        </time>
      ),
      title: __('Posted')
    }
  ]

  return (
    <DashboardCard
      className={className}
      flush
      subtitle={isClear ? __('Nothing is waiting on you right now.') : undefined}
      title={__('Needs attention')}
    >
      {/* Three across from sm; below it each label wrapped a word to a line. */}
      <div
        className="bc-grid bc-border-0 bc-border-b bc-border-solid bc-border-line"
        style={{ gridTemplateColumns: stacked ? '1fr' : 'repeat(3, minmax(0, 1fr))' }}
      >
        <Queue
          action={__('Review reports')}
          count={attention.reports}
          first
          label={__('Reported items')}
          to="reports"
          urgent
        />
        <Queue
          action={__('Approve comments')}
          count={attention.pendingReplies}
          label={__('Comments awaiting approval')}
          stacked={stacked}
          to={attention.pendingRepliesUrl}
          urgent
        />
        <Queue
          action={__('Open posts')}
          count={attention.unanswered}
          label={__('Posts that wait for a comment')}
          stacked={stacked}
          to="posts"
        />
      </div>

      <TopicTable columns={columns} empty={__('No post waits for a comment.')} rowKey={topic => topic.id} rows={topics} />
    </DashboardCard>
  )
}
