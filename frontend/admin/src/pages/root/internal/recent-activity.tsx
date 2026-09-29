import { __, sprintf } from '@common/helpers/i18nWrap'

import { fullDate, timeAgo } from '@/utils/format'

import { initials } from '../shared/format'
import { type ActivityEntry } from '../shared/types'
import DashboardCard from './dashboard-card'

/** Avatar fills, picked by member id so one person keeps one colour down the feed. */
const AVATAR_COLORS = ['#3266ea', '#d97706', '#7c3aed', '#0d9488', '#db2777', '#16a34a']

/** Grouped voters have no one face, so they get a neutral disc with the count. */
const GROUP_COLOR = '#94a3b8'

function Avatar({ entry }: { entry: ActivityEntry }) {
  const isGroup = entry.type === 'vote' && entry.count > 1
  const color = isGroup ? GROUP_COLOR : AVATAR_COLORS[Math.abs(entry.userId) % AVATAR_COLORS.length]

  return (
    <span
      aria-hidden
      className="bc-flex bc-size-8 bc-shrink-0 bc-items-center bc-justify-center bc-rounded-full bc-text-[11px] bc-font-semibold bc-text-white"
      style={{ backgroundColor: color }}
    >
      {isGroup ? `+${entry.count}` : initials(entry.actor)}
    </span>
  )
}

/** "Sara K. replied to", "6 members upvoted" — the actor in bold, then the verb. */
function Headline({ entry }: { entry: ActivityEntry }) {
  if (entry.type === 'vote' && entry.count > 1) {
    return (
      <>
        <strong className="bc-font-semibold">{sprintf(__('%d members'), entry.count)}</strong>{' '}
        {__('upvoted')}
      </>
    )
  }

  const verb = entry.type === 'topic' ? __('posted') : entry.type === 'reply' ? __('replied to') : __('upvoted')

  return (
    <>
      <strong className="bc-font-semibold">{entry.actor ?? __('A former member')}</strong> {verb}
    </>
  )
}

export default function RecentActivity({ className, entries }: { className?: string; entries: ActivityEntry[] }) {
  return (
    <DashboardCard className={className} link={{ label: __('Activity'), to: 'activity' }} title={__('Recent activity')}>
      {entries.length === 0 ? (
        <p className="bc-m-0 bc-text-sm bc-text-ink-subtle">{__('Nothing has happened yet.')}</p>
      ) : (
        <ul className="bc-m-0 bc-list-none bc-divide-x-0 bc-divide-y bc-divide-solid bc-divide-line bc-p-0">
          {entries.map(entry => (
            <li className="bc-flex bc-gap-3 bc-py-3 first:bc-pt-0" key={`${entry.type}:${entry.id}:${entry.at}`}>
              <Avatar entry={entry} />
              <div className="bc-min-w-0 bc-flex-1 bc-text-sm">
                <div className="bc-text-ink">
                  <Headline entry={entry} />
                </div>
                {entry.topicUrl ? (
                  <a
                    className="bc-block bc-truncate bc-text-primary hover:bc-underline"
                    href={entry.topicUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {entry.topicTitle}
                  </a>
                ) : (
                  <span className="bc-block bc-truncate bc-text-ink-muted">{entry.topicTitle}</span>
                )}
              </div>
              <time
                className="bc-shrink-0 bc-whitespace-nowrap bc-text-xs bc-text-ink-subtle"
                dateTime={entry.at}
                title={fullDate(entry.at)}
              >
                {timeAgo(entry.at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}
