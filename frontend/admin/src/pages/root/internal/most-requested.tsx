import { __ } from '@common/helpers/i18nWrap'

import { periodColumnLabel } from '../shared/format'
import { type DashboardPeriod, type MostRequestedTopic } from '../shared/types'
import DashboardCard from './dashboard-card'
import StageChip from './stage-chip'
import TopicTable, { type TopicColumn } from './topic-table'
import TopicTitleLink from './topic-title-link'

const RANK_SYMBOL = '#'

interface MostRequestedProps {
  className?: string
  hues: Map<string, string>
  period: DashboardPeriod
  portalUrl: string
  topics: MostRequestedTopic[]
}

export default function MostRequested({ className, hues, period, portalUrl, topics }: MostRequestedProps) {
  // Bars are relative to the leader, so the list reads as a ranking even when
  // every topic has only a handful of votes.
  const maxVotes = Math.max(1, ...topics.map(topic => topic.votes))

  const columns: TopicColumn<MostRequestedTopic>[] = [
    {
      className: 'bc-w-6 bc-text-ink-subtle',
      key: 'rank',
      render: (_, index) => <span className="bc-text-ink-subtle">{index + 1}</span>,
      // A bare "#" is not something a screen reader can say usefully.
      title: <span aria-label={__('Rank')}>{RANK_SYMBOL}</span>
    },
    {
      // A floor, so on a phone the table scrolls sideways rather than
      // breaking the title a letter per line.
      className: 'bc-min-w-48',
      key: 'title',
      render: topic => <TopicTitleLink title={topic.title} url={topic.url} />,
      title: __('Post')
    },
    {
      key: 'stage',
      render: topic =>
        topic.stage ? <StageChip hue={hues.get(topic.stage.name)} name={topic.stage.name} /> : '-',
      title: __('Stage')
    },
    {
      className: 'bc-w-40',
      key: 'votes',
      render: topic => (
        <span className="bc-flex bc-items-center bc-gap-3">
          <span className="bc-w-6 bc-font-semibold">{topic.votes}</span>
          <span aria-hidden className="bc-h-1.5 bc-w-24 bc-overflow-hidden bc-rounded-full bc-bg-surface-sunken">
            <span
              className="bc-block bc-h-full bc-rounded-full bc-bg-primary"
              style={{ width: `${(topic.votes / maxVotes) * 100}%` }}
            />
          </span>
        </span>
      ),
      title: __('Votes')
    },
    {
      align: 'right',
      key: 'recent',
      render: topic =>
        topic.recentVotes > 0 ? (
          <span className="bc-font-medium bc-text-positive">+{topic.recentVotes}</span>
        ) : (
          <span className="bc-text-ink-subtle">0</span>
        ),
      title: periodColumnLabel(period)
    },
    {
      align: 'right',
      key: 'replies',
      render: topic => <span className="bc-text-ink-muted">{topic.replies}</span>,
      title: __('Comments')
    }
  ]

  return (
    <DashboardCard
      className={className}
      flush
      link={portalUrl ? { label: __('All topics'), to: portalUrl } : undefined}
      subtitle={__('Posts ranked by votes')}
      title={__('Most upvoted posts')}
    >
      <TopicTable
        columns={columns}
        empty={__('No topic has a vote yet.')}
        rowKey={topic => topic.id}
        rows={topics}
      />
    </DashboardCard>
  )
}
