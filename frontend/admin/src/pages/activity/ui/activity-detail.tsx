import { __ } from '@common/helpers/i18nWrap'
import { Typography } from 'antd'

import { plain } from '@/utils/format'

import { type ActivityRow } from '../data/use-activity-log'

const { Paragraph } = Typography

/**
 * The rail down the left of a quoted block, saying what kind of quote it is.
 *
 * Only deletions carry content now, and the red rail is what marks the block as
 * the last copy of something rather than an excerpt of something still there.
 */
const RAILS: Record<string, string> = {
  gone: 'bc-border-negative',
  plain: 'bc-border-line-strong'
}

interface QuoteProps {
  label?: string
  tone?: keyof typeof RAILS
  value: string
}

/** A block of the content this row recorded, as stored at the time. */
function Quote({ label, tone = 'plain', value }: QuoteProps) {
  if (!value) return <></>

  return (
    <div className="bc-mt-2">
      {label && (
        <div className="bc-mb-1 bc-text-[11px] bc-font-semibold bc-uppercase bc-tracking-wider bc-text-ink-subtle">
          {label}
        </div>
      )}
      <blockquote
        className={`bc-m-0 bc-border-y-0 bc-border-r-0 bc-border-l-2 bc-border-solid bc-bg-surface-sunken bc-py-2 bc-pl-3 bc-pr-3 ${RAILS[tone]}`}
      >
        <Paragraph
          className="bc-mb-0 bc-text-sm bc-text-ink-muted"
          ellipsis={{ expandable: true, rows: 2, symbol: __('Show all') }}
        >
          {value}
        </Paragraph>
      </blockquote>
    </div>
  )
}

/** A counted fact about the row, for the actions whose detail is a number. */
function Note({ children }: { children: React.ReactNode }) {
  return <div className="bc-mt-2 bc-text-sm bc-text-ink-muted">{children}</div>
}

/** What a report decision resolved to, spelled out rather than left as a slug. */
const DECISIONS: Record<string, string> = {
  dismissed: __('the reports were dismissed'),
  resolved_kept: __('the content was kept'),
  resolved_removed: __('the content was removed')
}

/**
 * The heading for a row: what the content was called, when it had a name.
 *
 * Topics carry their title into the log — including into the row that deleted
 * them, which is then the only place the title still exists. Comments have no
 * title and get nothing here; their first words show up in the quoted block
 * instead, which is as close to a name as a comment ever has.
 */
export function titleOf(row: ActivityRow): string {
  return plain((row.context ?? {}).post_title)
}

/**
 * What the row actually recorded, which differs per action.
 *
 * A deletion carries the content that no longer exists anywhere else — for a
 * comment, plus how many replies went down with it, since that count cannot be
 * recovered either. The report actions carry no content at all, only how many
 * reports they settled and how, and that count is the whole reason the row is
 * worth keeping.
 */
export default function ActivityDetail({ row }: { row: ActivityRow }) {
  const context = row.context ?? {}

  if (row.action === 'delete_post') {
    return <Quote label={__('Deleted content')} tone="gone" value={plain(context.post_content)} />
  }

  if (row.action === 'delete_comment') {
    const lost = Number(context.replies_lost ?? 0)

    return (
      <>
        <Quote label={__('Deleted comment')} tone="gone" value={plain(context.content)} />
        {lost > 0 && (
          // Deleting a comment takes its whole reply subtree with it, and that
          // is the part nobody expects to read in a log either.
          <Note>
            <span className="bc-text-negative">
              {__('Took')} {lost} {lost === 1 ? __('reply') : __('replies')} {__('down with it.')}
            </span>
          </Note>
        )}
      </>
    )
  }

  if (row.action === 'hide') {
    const pending = Number(context.pending_reports ?? 0)

    if (pending === 0) return <></>

    // Only how many reports stood against it, not that a rule did the hiding.
    // Most of these rows are the auto-hide, but not all of them are — the actor
    // is a person on some — and the row already names whoever it was.
    return (
      <Note>
        {pending} {pending === 1 ? __('report was') : __('reports were')}{' '}
        {__('open against it at the time.')}
      </Note>
    )
  }

  if (row.action === 'resolve_reports' || row.action === 'restore') {
    const closed = Number(context.closed ?? 0)
    const decision = DECISIONS[String(context.decision ?? '')]

    if (closed === 0 && !decision) return <></>

    return (
      <Note>
        {closed > 0 && (
          <>
            {__('Closed')} {closed} {closed === 1 ? __('report') : __('reports')}
          </>
        )}
        {closed > 0 && decision && ' — '}
        {decision}
      </Note>
    )
  }

  // Pin, unpin, lock, unlock: the title above the row is the whole story.
  return <></>
}
