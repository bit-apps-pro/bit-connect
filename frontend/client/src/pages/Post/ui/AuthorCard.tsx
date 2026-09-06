import { __ } from '@common/helpers/i18nWrap'
import { type Topic } from '@features/topic-modal/shared/type'
import { userProfilePath } from '@utilities/user-link'
import { Avatar, Skeleton } from 'antd'
import { Link } from 'react-router'

import useUserStats from '../data/use-user-stats'
import { PANEL } from './panel-styles'

const formatCount = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k` : String(value)

const memberSince = (iso: string) => {
  const date = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bc-flex bc-flex-1 bc-flex-col bc-items-center bc-gap-1">
      <span className="bc-text-[17px] bc-font-semibold bc-leading-none bc-text-ink">{value}</span>
      <span className="bc-text-[10px] bc-uppercase bc-tracking-[0.04em] bc-leading-tight bc-text-ink-subtle">
        {label}
      </span>
    </div>
  )
}

/**
 * Who wrote this topic, and how much they have contributed.
 *
 * Sits first in the rail: on a support portal the author's track record is the
 * strongest signal for how to read a report, so it comes before the taxonomy
 * and related links.
 */
export default function AuthorCard({ topic }: { topic: Topic }) {
  const { isLoadingStats, stats } = useUserStats(topic.post_author)
  const joined = stats?.registered_at ? memberSince(stats.registered_at) : undefined

  return (
    <section aria-label={__('About the author')} className={PANEL}>
      <div className="bc-flex bc-items-center bc-gap-3">
        {/* Soft ring instead of a hard border — lifts the avatar without a line. */}
        {/* Presentational for assistive tech — the name link below points at the
            same profile, so exposing both would be a duplicate tab stop. */}
        <Link
          aria-hidden="true"
          className="bc-shrink-0"
          tabIndex={-1}
          to={userProfilePath(topic.author_slug)}
        >
          <Avatar
            alt={topic.author_name}
            className="bc-ring-2 bc-ring-surface-sunken"
            size={46}
            src={topic.author_avatar}
          >
            {topic.author_name?.charAt(0)?.toUpperCase()}
          </Avatar>
        </Link>
        <div className="bc-min-w-0">
          <Link
            className="bc-block bc-truncate bc-text-[15px] bc-font-semibold bc-leading-tight bc-text-ink bc-no-underline hover:bc-text-primary"
            to={userProfilePath(topic.author_slug)}
          >
            {topic.author_name}
          </Link>
          {joined && (
            <div className="bc-mt-0.5 bc-text-[11px] bc-text-ink-subtle">
              {__('Member since')} {joined}
            </div>
          )}
        </div>
      </div>

      {isLoadingStats ? (
        <Skeleton active className="bc-mt-4" paragraph={{ rows: 1 }} title={false} />
      ) : (
        stats && (
          // Tinted strip so the numbers read as a unit rather than three
          // floating figures, with hairline separators between them.
          <div className="bc-mt-4 bc-flex bc-items-stretch bc-rounded-lg bc-bg-surface-sunken bc-py-3">
            <Stat label={__('Topics')} value={formatCount(stats.topics)} />
            <span className="bc-w-px bc-self-center bc-bg-surface-raised" style={{ height: 26 }} />
            <Stat label={__('Comments')} value={formatCount(stats.comments)} />
            <span className="bc-w-px bc-self-center bc-bg-surface-raised" style={{ height: 26 }} />
            <Stat label={__('Upvotes')} value={formatCount(stats.votes_received)} />
          </div>
        )
      )}
    </section>
  )
}
