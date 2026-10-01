import { __ } from '@common/helpers/i18nWrap'

import { fullDate } from '@/utils/format'

import { shortDate } from '../shared/format'
import { type RecentTopic } from '../shared/types'
import DashboardCard from './dashboard-card'
import StageChip from './stage-chip'
import TopicTable, { type TopicColumn } from './topic-table'
import TopicTitleLink from './topic-title-link'

interface RecentTopicsProps {
  className?: string
  hues: Map<string, string>
  portalUrl: string
  topics: RecentTopic[]
}

export default function RecentTopics({ className, hues, portalUrl, topics }: RecentTopicsProps) {
  const columns: TopicColumn<RecentTopic>[] = [
    {
      key: 'title',
      render: topic => <TopicTitleLink title={topic.title} url={topic.url} />,
      title: __('Topic')
    },
    {
      key: 'author',
      render: topic => <span className="bc-text-ink-muted">{topic.author ?? __('Deleted member')}</span>,
      title: __('Author')
    },
    {
      key: 'stage',
      render: topic =>
        topic.stage ? <StageChip hue={hues.get(topic.stage.name)} name={topic.stage.name} /> : '-',
      title: __('Stage')
    },
    {
      align: 'right',
      key: 'votes',
      render: topic => topic.votes,
      title: __('Votes')
    },
    {
      align: 'right',
      className: 'bc-whitespace-nowrap',
      key: 'date',
      render: topic => (
        <time className="bc-text-ink-muted" dateTime={topic.created_at} title={fullDate(topic.created_at)}>
          {shortDate(topic.created_at)}
        </time>
      ),
      title: __('Date')
    }
  ]

  return (
    <DashboardCard
      className={className}
      flush
      link={portalUrl ? { label: __('View all'), to: portalUrl } : undefined}
      title={__('Recent topics')}
    >
      <TopicTable columns={columns} empty={__('No topics yet.')} rowKey={topic => topic.id} rows={topics} />
    </DashboardCard>
  )
}
