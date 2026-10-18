import { __, sprintf } from '@common/helpers/i18nWrap'
import { Avatar, Select } from 'antd'
import { type ReactNode, useState } from 'react'
import { LuMessageCircle, LuTriangle } from 'react-icons/lu'

import { contributorsLabel, initials } from '../shared/format'
import { type Contributor, type ContributorRanking, type DashboardPeriod, type TopContributors } from '../shared/types'
import DashboardCard from './dashboard-card'

const RANKING_OPTIONS: { label: string; value: ContributorRanking }[] = [
  { label: __('Overall'), value: 'overall' },
  { label: __('Upvotes'), value: 'votes' },
  { label: __('Comments'), value: 'comments' }
]

/** A count with its icon; the label is for screen readers, the icon says it to everyone else. */
function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <span aria-label={label} className="bc-inline-flex bc-min-w-11 bc-items-center bc-gap-1 bc-text-xs bc-tabular-nums bc-text-ink-muted" title={label}>
      <span aria-hidden className="bc-flex bc-text-sm">
        {icon}
      </span>
      {value.toLocaleString()}
    </span>
  )
}

function ContributorRow({ contributor }: { contributor: Contributor }) {
  return (
    <li className="bc-flex bc-items-center bc-gap-3 bc-py-3 first:bc-pt-0 last:bc-pb-0">
      {/* antd shows the initials when the image fails to load. */}
      <Avatar alt="" className="bc-shrink-0 bc-text-xs bc-font-semibold" size={40} src={contributor.avatar || undefined}>
        {initials(contributor.name)}
      </Avatar>
      <div className="bc-min-w-0 bc-flex-1">
        <div className="bc-truncate bc-text-sm bc-font-semibold bc-text-ink" title={contributor.name}>
          {contributor.name || __('Deleted member')}
        </div>
        {contributor.badge && (
          <div className="bc-truncate bc-text-xs bc-text-ink-subtle">{contributor.badge}</div>
        )}
      </div>
      {/* Each count has a fixed-width slot, so the icons line up down the list
          whether a member has 1 comment or 13. */}
      <div className="bc-flex bc-shrink-0 bc-items-center bc-gap-2">
        <Metric
          icon={<LuTriangle />}
          label={sprintf(__('%d upvotes received'), contributor.votes)}
          value={contributor.votes}
        />
        <Metric
          icon={<LuMessageCircle />}
          label={sprintf(__('%d comments'), contributor.comments)}
          value={contributor.comments}
        />
      </div>
    </li>
  )
}

interface TopContributorsProps {
  className?: string
  contributors: TopContributors
  period: DashboardPeriod
}

/** The members who did the most during the period, ranked the way the admin picks. */
export default function TopContributorsCard({ className, contributors, period }: TopContributorsProps) {
  const [ranking, setRanking] = useState<ContributorRanking>('overall')
  const shown = contributors[ranking]

  return (
    <DashboardCard
      className={className}
      extra={
        <Select
          aria-label={__('Rank contributors by')}
          className="bc-min-w-28"
          onChange={setRanking}
          options={RANKING_OPTIONS}
          popupMatchSelectWidth={false}
          size="small"
          value={ranking}
        />
      }
      flush
      subtitle={contributorsLabel(period, contributors.count)}
      title={__('Top contributors')}
    >
      {shown.length === 0 ? (
        <p className="bc-m-0 bc-px-6 bc-py-8 bc-text-center bc-text-sm bc-text-ink-subtle">
          {__('Nobody has voted or commented in this period.')}
        </p>
      ) : (
        <ul className="bc-m-0 bc-list-none bc-divide-x-0 bc-divide-y bc-divide-solid bc-divide-line bc-px-6 bc-py-4">
          {shown.map(contributor => (
            <ContributorRow contributor={contributor} key={contributor.id} />
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}
