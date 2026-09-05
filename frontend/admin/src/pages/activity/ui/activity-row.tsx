import { __ } from '@common/helpers/i18nWrap'
import { Tooltip, Typography } from 'antd'
import { motion } from 'framer-motion'
import { LuBot, LuMessageSquare, LuQuote } from 'react-icons/lu'

import { clockTime, fullDate, parseGmt } from '@/utils/format'
import { useCardMotion } from '@/utils/list-motion'

import { type ActivityPerson, type ActivityRow as Row } from '../data/use-activity-log'
import { lookOf } from '../shared/actions'
import ActivityDetail, { titleOf } from './activity-detail'

const { Text } = Typography

/**
 * A person's name, or a plain marker when their account no longer exists.
 *
 * The log keeps ids, not names, so a deleted account leaves a row with nothing
 * to print. Showing the gap is the point — dropping the row instead would let
 * deleting an account erase what it did.
 */
function PersonName({ person }: { person: ActivityPerson }) {
  if (person.name) return <>{person.name}</>

  // An empty name is not always a missing person. The auto-hide has no actor at
  // all, and calling that a deleted account would put a ghost against the one
  // action nobody took.
  if (person.is_system) return <>{__('Automatic')}</>

  return <span className="bc-italic">{__('(deleted account)')}</span>
}

function Dot() {
  return (
    <span aria-hidden className="bc-text-ink-subtle">
      ·
    </span>
  )
}

interface ActivityRowProps {
  /** Position within its day, which staggers the entrance. */
  index: number
  /** The connector is drawn between medallions, so the last one has none. */
  isLast: boolean
  row: Row
}

/**
 * One recorded action, as a line on a timeline.
 *
 * This was a table row across five columns, which put the same weight on the
 * timestamp as on what was done and left the widest column — the detail — empty
 * on most rows, because only four of the eleven actions had anything written to
 * render there. A log is read down, not across: who did what, to whose content,
 * and what it said before it went. So the row reads as a sentence, the icon and
 * its tint carry the action, and the recorded content is indented underneath
 * where it can take the width it needs.
 */
export default function ActivityRow({ index, isLast, row }: ActivityRowProps) {
  const { Icon, tint } = lookOf(row.action)
  const cardMotion = useCardMotion({ layout: false })
  const title = titleOf(row)
  const isComment = row.target.type === 'comment'
  const kindLabel = isComment ? __('Comment') : __('Topic')
  const at = parseGmt(row.created_at)

  return (
    <motion.li className="bc-relative bc-flex bc-gap-3 bc-pb-3" {...cardMotion(index)}>
      {/* Runs from under one medallion to the next, so a day's rows read as one
          run of events rather than as separate items that happen to be stacked. */}
      {!isLast && (
        <span
          aria-hidden
          className="bc-absolute bc-bottom-0 bc-left-4 bc-top-[38px] bc-w-px bc-bg-line"
        />
      )}

      <span
        className={`bc-mt-0.5 bc-grid bc-h-8 bc-w-8 bc-shrink-0 bc-place-items-center bc-rounded-full ${tint}`}
      >
        <Icon aria-hidden />
      </span>

      <div className="bc-min-w-0 bc-flex-1 bc-rounded-md bc-px-3 bc-py-2 bc-transition-colors hover:bc-bg-surface-hover">
        <div className="bc-flex bc-flex-wrap bc-items-baseline bc-gap-x-2 bc-gap-y-1">
          <span className="bc-text-sm bc-font-semibold bc-text-ink">
            {row.actor.is_system && !row.actor.name && (
              <LuBot aria-hidden className="bc-mr-1 bc-inline bc-align-[-2px]" />
            )}
            <PersonName person={row.actor} />
          </span>
          <span className="bc-text-sm bc-text-ink-muted">{row.action_label}</span>

          <Tooltip title={fullDate(row.created_at)}>
            {/* The date the row is filed under is already the day heading above
                it, so the row itself only has to say when in that day. */}
            <time
              className="bc-ml-auto bc-shrink-0 bc-whitespace-nowrap bc-text-xs bc-text-ink-subtle"
              dateTime={Number.isNaN(at.getTime()) ? undefined : at.toISOString()}
            >
              {clockTime(row.created_at)}
            </time>
          </Tooltip>
        </div>

        <div className="bc-mt-1 bc-flex bc-flex-wrap bc-items-center bc-gap-x-2 bc-gap-y-1 bc-text-xs bc-text-ink-muted">
          {title && <span className="bc-font-medium bc-text-ink">{title}</span>}
          {title && <Dot />}

          {/* The id is what makes a row actionable: it is how you find the
              content in the portal, in wp-admin or in a query, and for a deleted
              target it is the only handle left — the log outlives what it
              describes, so a name and a date alone name nothing. */}
          <Text className="bc-text-xs" copyable={{ text: String(row.target.id) }} type="secondary">
            {isComment && <LuMessageSquare aria-hidden className="bc-mr-1 bc-inline bc-align-[-2px]" />}
            {kindLabel} #{row.target.id}
          </Text>
          <Dot />
          <span>
            {__('by')} <PersonName person={row.target.author} />
          </span>

          {!row.target.exists && (
            <span className="bc-rounded-full bc-bg-surface-sunken bc-px-2 bc-py-0.5 bc-text-[11px] bc-font-medium bc-text-ink-subtle">
              {__('gone')}
            </span>
          )}
        </div>

        <ActivityDetail row={row} />

        {/* The note a moderator typed when they closed the reports. It is the
            only part of a row written by a person rather than derived from what
            happened, and the screen used to drop it on the floor. */}
        {row.reason && (
          <div className="bc-mt-2 bc-flex bc-gap-1.5 bc-text-sm bc-italic bc-text-ink-muted">
            <LuQuote aria-hidden className="bc-mt-1 bc-shrink-0 bc-text-ink-subtle" />
            <span className="bc-min-w-0">{row.reason}</span>
          </div>
        )}
      </div>
    </motion.li>
  )
}
