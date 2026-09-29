import { __, sprintf } from '@common/helpers/i18nWrap'

import { deltaLabel, topicTypeSummary } from '../shared/format'
import { type DashboardPeriod, type DashboardStats } from '../shared/types'

interface StatCardProps {
  delta: number
  footnote: string
  label: string
  period: DashboardPeriod
  value: number
}

function StatCard({ delta, footnote, label, period, value }: StatCardProps) {
  return (
    <div className="bc-min-w-0 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-6 bc-py-5">
      <div className="bc-text-sm bc-text-ink-muted">{label}</div>
      <div className="bc-mt-1 bc-flex bc-flex-wrap bc-items-center bc-gap-x-3 bc-gap-y-1">
        <span className="bc-text-3xl bc-font-semibold bc-leading-tight bc-text-ink">
          {value.toLocaleString()}
        </span>
        {/* Only a rise is called out: "+0 this week" is noise on a quiet forum. */}
        {delta > 0 && (
          <span className="bc-rounded bc-bg-positive-soft bc-px-2 bc-py-0.5 bc-text-xs bc-font-medium bc-text-positive">
            {deltaLabel(period, delta)}
          </span>
        )}
      </div>
      <div className="bc-mt-2 bc-truncate bc-text-xs bc-text-ink-subtle" title={footnote}>
        {footnote}
      </div>
    </div>
  )
}

interface StatCardsProps {
  period: DashboardPeriod
  stats: DashboardStats
  topicTypes: string[]
}

export default function StatCards({ period, stats, topicTypes }: StatCardsProps) {
  return (
    <div className="bc-grid bc-gap-5 sm:bc-grid-cols-2 xl:bc-grid-cols-4">
      <StatCard
        delta={stats.newTopics}
        footnote={topicTypeSummary(topicTypes)}
        label={__('Total Posts')}
        period={period}
        value={stats.totalTopics}
      />
      <StatCard
        delta={stats.newComments}
        footnote={sprintf(__('Across %1$d of %2$d topics'), stats.commentedTopics, stats.totalTopics)}
        label={__('Total Comments')}
        period={period}
        value={stats.totalComments}
      />
      <StatCard
        delta={stats.newMembers}
        footnote={sprintf(__('%d posted for the first time'), stats.firstTimePosters)}
        label={__('Total Members')}
        period={period}
        value={stats.totalMembers}
      />
      <StatCard
        delta={stats.newVotes}
        footnote={
          stats.topVotedStage
            ? sprintf(__('Most on %s topics'), stats.topVotedStage)
            : __('No votes cast yet')
        }
        label={__('Total Votes')}
        period={period}
        value={stats.totalVotes}
      />
    </div>
  )
}
