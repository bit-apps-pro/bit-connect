import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { Button, Input, Popconfirm, Tooltip, Typography } from 'antd'
import { useContext, useState } from 'react'
import {
  LuArrowUpRight,
  LuCheck,
  LuFileText,
  LuMessageSquare,
  LuTrash2,
  LuUsers,
  LuX
} from 'react-icons/lu'

import { fullDate, plain, timeAgo } from '@/utils/format'

import { type ReportQueueEntry, useResolveReport } from '../data/use-reports'
import { reasonTint, severityOf } from '../shared/severity'

const { Paragraph, Text } = Typography

const CHIP =
  'bc-inline-flex bc-items-center bc-gap-1 bc-rounded-full bc-px-2.5 bc-py-1 bc-text-xs bc-font-semibold bc-leading-none'

/** A small all-caps heading over each block inside a card. */
function BlockLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bc-mb-2 bc-text-[11px] bc-font-semibold bc-uppercase bc-tracking-wider bc-text-ink-subtle">
      {children}
    </div>
  )
}

/** What became of an item, for the chip that stands where the buttons were. */
const OUTCOME_LABELS: Record<string, string> = {
  dismissed: __('dismissed'),
  resolved_kept: __('kept'),
  resolved_removed: __('removed')
}

interface ReportCardProps {
  entry: ReportQueueEntry
  /** False on the resolved tabs, where the decision has already been made. */
  isPending: boolean
  /** The status this entry was resolved as; absent while it is still pending. */
  outcome?: string
}

export default function ReportCard({ entry, isPending, outcome }: ReportCardProps) {
  const { notificationApi } = useContext(NotifyContext)
  const { resolve } = useResolveReport()
  const [note, setNote] = useState('')
  // Which decision is in flight, not merely that one is: three buttons sharing a
  // single disabled flag leave a moderator watching all three go grey with no
  // clue which one they pressed.
  const [deciding, setDeciding] = useState<string | undefined>()

  const decide = async (status: string) => {
    setDeciding(status)

    try {
      const response = await resolve({
        note: note.trim() || undefined,
        status,
        target_id: entry.target_id,
        target_type: entry.target_type
      })
      const closed = response?.data?.closed ?? 0
      // Says what became of the content, not just how many rows closed. "Closed
      // 2 reports" is the same sentence whether the words were put back or
      // deleted, and those are not the same act.
      let became = ''

      if (response?.data?.removed) {
        became = __('The content was removed.')
      } else if (response?.data?.restored) {
        became = __('The content is public again.')
      }

      notificationApi?.success({
        description: became || undefined,
        message: `${__('Closed')} ${closed} ${closed === 1 ? __('report') : __('reports')}`
      })
    } catch (error) {
      notificationApi?.error({
        message: (error as { message?: string })?.message ?? __('That could not be saved.')
      })
    } finally {
      setDeciding(undefined)
    }
  }

  const severity = severityOf(entry.count)
  const isComment = entry.target_type === 'comment'
  const kindLabel = isComment ? __('Comment') : __('Topic')
  const heading = entry.title || plain(entry.excerpt).slice(0, 90) || __('(no content)')
  const isBusy = deciding !== undefined
  // The same people can report more than one thing, and the queue lists a name
  // per report rather than per person.
  const reporters = [...new Set(entry.reporters.map(person => person.name).filter(Boolean))]

  return (
    <article className="bc-relative bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-transition-colors hover:bc-border-line-strong">
      {/* How many people agreed, read before any of the words are. */}
      <span aria-hidden className={`bc-absolute bc-inset-y-0 bc-left-0 bc-w-1 ${severity.rail}`} />

      <div className="bc-p-5 bc-pl-6">
        <div className="bc-mb-3 bc-flex bc-flex-wrap bc-items-center bc-gap-2">
          <span
            className={`${CHIP} ${
              isComment ? 'bc-bg-info-soft bc-text-info' : 'bc-bg-tone-violet-soft bc-text-tone-violet'
            }`}
          >
            {isComment ? <LuMessageSquare aria-hidden /> : <LuFileText aria-hidden />}
            {kindLabel}
          </span>

          <span className={`${CHIP} ${severity.chip}`}>
            {entry.count} {entry.count === 1 ? __('report') : __('reports')}
          </span>

          {/* Only where it adds something. On the Removed tab the outcome chip
              beside it already says the content is gone, and two chips saying
              one thing read as two facts. On Kept and Dismissed it is the
              opposite — content that was let stand and has since gone is worth
              a moderator noticing. */}
          {!entry.exists && outcome !== 'resolved_removed' && (
            <span className={`${CHIP} bc-bg-surface-sunken bc-text-ink-subtle`}>
              {__('already removed')}
            </span>
          )}

          {outcome && OUTCOME_LABELS[outcome] && (
            <span className={`${CHIP} bc-bg-surface-sunken bc-text-ink-muted`}>
              {OUTCOME_LABELS[outcome]}
            </span>
          )}

          <div className="bc-ml-auto bc-flex bc-items-center bc-gap-3">
            <Tooltip title={fullDate(entry.latest_at)}>
              <span className="bc-whitespace-nowrap bc-text-xs bc-text-ink-subtle">
                {timeAgo(entry.latest_at)}
              </span>
            </Tooltip>
            {entry.link && (
              <a
                className="bc-inline-flex bc-items-center bc-gap-1 bc-whitespace-nowrap bc-text-xs bc-font-medium"
                href={entry.link}
                rel="noreferrer"
                target="_blank"
              >
                {__('Open in the forum')}
                <LuArrowUpRight aria-hidden />
              </a>
            )}
          </div>
        </div>

        <h3 className="bc-m-0 bc-text-base bc-font-semibold bc-leading-snug bc-text-ink">{heading}</h3>

        {/* The same id the Activity screen prints, so a queue entry and its
            history can be matched to each other — and so a moderator can still
            find the content once the link stops working. Paste it into Activity's
            search to see everything ever done to it. */}
        <div className="bc-mt-1.5 bc-flex bc-flex-wrap bc-items-center bc-gap-x-2 bc-gap-y-1 bc-text-xs bc-text-ink-muted">
          <span>
            {__('Written by')}{' '}
            <span className="bc-font-medium bc-text-ink">
              {entry.target_author_name || __('(deleted account)')}
            </span>
          </span>
          <span aria-hidden className="bc-text-ink-subtle">
            ·
          </span>
          <Text className="bc-text-xs" copyable={{ text: String(entry.target_id) }} type="secondary">
            {kindLabel} #{entry.target_id}
          </Text>
          <span aria-hidden className="bc-text-ink-subtle">
            ·
          </span>
          <Tooltip title={fullDate(entry.first_at)}>
            <span>
              {__('first reported')} {timeAgo(entry.first_at)}
            </span>
          </Tooltip>
        </div>

        {/* A filled block rather than a ruled one: the tint already sets the
            excerpt apart, and a rule down the edge of it lands on a background
            close enough to its own colour to read as a rendering artefact. The
            reporters' notes below are unfilled, so there a rule is all there
            is and it earns its place. */}
        {entry.exists && (
          <blockquote className="bc-mx-0 bc-mb-0 bc-mt-4 bc-rounded-md bc-border-none bc-bg-surface-sunken bc-px-4 bc-py-3">
            <Paragraph
              className="bc-mb-0 bc-text-sm bc-text-ink-muted"
              ellipsis={{ expandable: true, rows: 3, symbol: __('Show all') }}
            >
              {plain(entry.excerpt)}
            </Paragraph>
          </blockquote>
        )}

        <div className="bc-mt-4">
          <BlockLabel>{__('Why it was reported')}</BlockLabel>
          <div className="bc-flex bc-flex-wrap bc-gap-1.5">
            {Object.entries(entry.reasons).map(([slug, howMany]) => (
              <span className={`${CHIP} ${reasonTint(slug)}`} key={slug}>
                {entry.reason_labels[slug] ?? slug}
                {howMany > 1 && (
                  <span className="bc-rounded-full bc-bg-surface bc-px-1.5 bc-py-0.5 bc-text-[10px]">
                    ×{howMany}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>

        {entry.details.length > 0 && (
          <div className="bc-mt-4">
            <BlockLabel>{__('What reporters wrote')}</BlockLabel>
            <div className="bc-flex bc-flex-col bc-gap-1.5">
              {/* Not paired with the names below: the queue sends the notes and
                  the reporters as two lists, and only the people who wrote
                  something appear in the first. Lining them up would put words
                  in the mouth of whoever happened to be at the same index. */}
              {entry.details.map((detail, index) => (
                <p
                  className="bc-m-0 bc-border-y-0 bc-border-r-0 bc-border-l-2 bc-border-solid bc-border-line bc-pl-3 bc-text-sm bc-italic bc-text-ink-muted"
                  key={index}
                >
                  {detail}
                </p>
              ))}
            </div>
          </div>
        )}

        {reporters.length > 0 && (
          <div className="bc-mt-4 bc-flex bc-items-center bc-gap-1.5 bc-text-xs bc-text-ink-subtle">
            <LuUsers aria-hidden />
            {__('Reported by')} {reporters.join(', ')}
          </div>
        )}
      </div>

      {isPending && (
        <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-2 bc-border-x-0 bc-border-b-0 bc-border-t bc-border-solid bc-border-line bc-bg-surface-sunken bc-px-5 bc-py-3 bc-pl-6">
          <Input
            className="bc-min-w-[200px] bc-max-w-md bc-flex-1"
            disabled={isBusy}
            onChange={event => setNote(event.target.value)}
            placeholder={__('Note (optional) — kept on every report closed')}
            value={note}
          />

          {/* Keep and Dismiss both put hidden content back; Remove deletes it.
              The wording says which is which rather than making a moderator
              remember. */}
          <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-2">
            <Button
              disabled={isBusy}
              icon={<LuCheck aria-hidden />}
              loading={deciding === 'resolved_kept'}
              onClick={() => decide('resolved_kept')}
            >
              {__('Keep content')}
            </Button>

            {/* The only irreversible button on the screen, and the one a tired
                moderator is most likely to hit by muscle memory next to two that
                are not. A comment takes its replies with it, which is the part
                nobody expects, so the confirm says so. */}
            <Popconfirm
              cancelText={__('Cancel')}
              description={
                isComment
                  ? __('The reply and everything posted underneath it are deleted for good.')
                  : __('The topic and its replies are deleted for good.')
              }
              okButtonProps={{ danger: true }}
              okText={__('Remove it')}
              onConfirm={() => decide('resolved_removed')}
              title={__('Delete this permanently?')}
            >
              <Button
                danger
                disabled={isBusy}
                icon={<LuTrash2 aria-hidden />}
                loading={deciding === 'resolved_removed'}
              >
                {__('Remove content')}
              </Button>
            </Popconfirm>

            <Button
              disabled={isBusy}
              icon={<LuX aria-hidden />}
              loading={deciding === 'dismissed'}
              onClick={() => decide('dismissed')}
              type="text"
            >
              {__('Dismiss')}
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}
