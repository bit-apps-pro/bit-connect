import { __ } from '@common/helpers/i18nWrap'
import { Alert, Button, Input, Pagination, Select, Skeleton, Tooltip, Typography } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { LuHistory, LuSearch, LuX } from 'react-icons/lu'

import { dayLabel } from '@/utils/format'
import { useSwapMotion } from '@/utils/list-motion'

import useActivityLog, {
  type ActivityFilters,
  type ActivityRow,
  useActivityActions
} from './data/use-activity-log'
import ActivityRowItem from './ui/activity-row'

const { Text, Title } = Typography

/**
 * Splits the page into the days it happened on.
 *
 * Runs off the order the feed already arrives in — newest first — rather than
 * bucketing into a map, so a day is one heading and the run of rows underneath
 * it, and the rows keep the order the server sorted them into.
 */
function byDay(rows: ActivityRow[]) {
  const groups: { label: string; rows: ActivityRow[] }[] = []

  for (const row of rows) {
    const label = dayLabel(row.created_at, __('Today'), __('Yesterday'))
    const current = groups.at(-1)

    if (current?.label === label) current.rows.push(row)
    else groups.push({ label, rows: [row] })
  }

  return groups
}

function LoadingRows() {
  return (
    <div className="bc-flex bc-flex-col bc-gap-4 bc-pt-2">
      {[0, 1, 2, 3].map(index => (
        <div className="bc-flex bc-gap-3" key={index}>
          <Skeleton.Avatar active size={32} />
          <Skeleton active className="bc-flex-1" paragraph={{ rows: 1 }} title={{ width: '35%' }} />
        </div>
      ))}
    </div>
  )
}

function EmptyLog({ isFiltered }: { isFiltered: boolean }) {
  return (
    <div className="bc-flex bc-flex-col bc-items-center bc-gap-2 bc-rounded-lg bc-border bc-border-dashed bc-border-line-strong bc-bg-surface-sunken bc-px-6 bc-py-16 bc-text-center">
      <LuHistory aria-hidden className="bc-text-3xl bc-text-ink-subtle" />
      <Text strong>
        {isFiltered ? __('Nothing matches those filters.') : __('Nothing recorded yet.')}
      </Text>
      <Text className="bc-max-w-md bc-text-sm" type="secondary">
        {isFiltered
          ? __('Widen the search — a topic and a comment can share an id, so check the type too.')
          : __('Rows appear when someone acts on content they did not write.')}
      </Text>
    </div>
  )
}

export default function Activity() {
  const [filters, setFilters] = useState<ActivityFilters>({ page: 1, per_page: 20 })
  const { activityActions } = useActivityActions()
  const { activityLog, isActivityLogError, isActivityLogFetching } = useActivityLog(filters)
  const swapMotion = useSwapMotion()

  const setFilter = (patch: Partial<ActivityFilters>) =>
    // Any filter change returns to page 1: staying on page 4 of a narrower
    // result set shows an empty list that reads as "nothing happened".
    setFilters(previous => ({ ...previous, ...patch, page: 1 }))

  const rows = activityLog?.data ?? []
  const total = activityLog?.pagination.total ?? 0
  const perPage = activityLog?.pagination.per_page ?? 20
  const isFiltered =
    filters.action !== undefined || filters.target_type !== undefined || filters.target_id !== undefined
  // `keepPreviousData` holds the last result on screen while the next one loads,
  // so the skeleton is only for the very first read — replacing a full page with
  // grey bars on every filter keystroke is worse than a moment of stale rows
  // that dim to say they are stale.
  const isFirstLoad = isActivityLogFetching && !activityLog
  const groups = byDay(rows)

  return (
    <div className="bc-p-6">
      <div className="bc-mb-5 bc-flex bc-items-start bc-justify-between bc-gap-4">
        {/* Shrinks rather than wrapping the tile underneath it: the subtitle is
            a full sentence, and left to push it would drop the count onto its
            own line at every width this panel is actually read at. */}
        <div className="bc-min-w-0">
          <Title className="bc-mb-1" level={3}>
            {__('Activity')}
          </Title>
          {/* Says what moderation can do here, because that changed: taking
              content down is the whole of it now, and a screen that still
              described edits as a thing that gets recorded would read as though
              somebody could still make one. */}
          <Text type="secondary">
            {__(
              'Everything done to content another member wrote — taken down, hidden, locked or cleared. Nobody can rewrite someone else’s words, so no edit is recorded here.'
            )}
          </Text>
        </div>

        {total > 0 && (
          <div className="bc-shrink-0 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-5 bc-py-3 bc-text-center">
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                className="bc-text-2xl bc-font-semibold bc-leading-none bc-text-ink"
                key={total}
                {...swapMotion}
              >
                {total}
              </motion.div>
            </AnimatePresence>
            <div className="bc-mt-1 bc-text-xs bc-text-ink-subtle">
              {isFiltered ? __('matching actions') : __('actions recorded')}
            </div>
          </div>
        )}
      </div>

      <div className="bc-mb-5 bc-flex bc-flex-wrap bc-items-center bc-gap-2 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface-sunken bc-p-3">
        <Select
          allowClear
          className="bc-min-w-[260px]"
          onChange={value => setFilter({ action: value })}
          options={activityActions}
          placeholder={__('Any action')}
          value={filters.action}
        />
        <Select
          allowClear
          className="bc-min-w-[170px]"
          onChange={value => setFilter({ target_type: value })}
          options={[
            { label: __('Topics'), value: 'post' },
            { label: __('Comments'), value: 'comment' }
          ]}
          placeholder={__('Any content type')}
          value={filters.target_type}
        />
        {/* Search by id rather than by words: the log stores excerpts of content
            that may no longer exist, so matching on text would find a deleted
            topic by a phrase nobody can look up any more. The id is stable, it
            is printed on every row, and it is the handle a moderator already has
            when someone asks what happened to their post. */}
        <Tooltip title={__('Ids are unique per kind — a topic and a comment can share one.')}>
          <Input
            allowClear
            className="bc-max-w-[220px]"
            inputMode="numeric"
            onChange={event => {
              const digits = event.target.value.replaceAll(/\D/g, '')
              setFilter({ target_id: digits === '' ? undefined : Number(digits) })
            }}
            placeholder={__('Topic or comment ID')}
            prefix={<LuSearch aria-hidden className="bc-text-ink-subtle" />}
            value={filters.target_id ?? ''}
          />
        </Tooltip>

        {isFiltered && (
          <Button
            className="bc-ml-auto"
            icon={<LuX aria-hidden />}
            onClick={() => setFilters({ page: 1, per_page: perPage })}
            size="small"
            type="text"
          >
            {__('Clear')}
          </Button>
        )}
      </div>

      {isActivityLogError && (
        <Alert
          className="bc-mb-4"
          description={__('The activity log could not be loaded.')}
          message={__('Something went wrong')}
          showIcon
          type="error"
        />
      )}

      {isFirstLoad && <LoadingRows />}

      {!isFirstLoad && (
        <div
          className={`bc-transition-opacity ${
            isActivityLogFetching ? 'bc-pointer-events-none bc-opacity-50' : ''
          }`}
        >
          {groups.map(group => (
            <section key={group.label}>
              {/* The heading is what makes a run of timestamps legible: without
                  it every row prints its own date and the reader does the
                  grouping by eye, on a screen whose whole job is chronology. */}
              <h4 className="bc-mb-3 bc-mt-1 bc-flex bc-items-center bc-gap-3 bc-text-xs bc-font-semibold bc-uppercase bc-tracking-wider bc-text-ink-subtle">
                {group.label}
                <span aria-hidden className="bc-h-px bc-flex-1 bc-bg-line" />
              </h4>

              <ol className="bc-m-0 bc-mb-4 bc-list-none bc-p-0">
                {group.rows.map((row, index) => (
                  <ActivityRowItem
                    index={index}
                    isLast={index === group.rows.length - 1}
                    key={row.id}
                    row={row}
                  />
                ))}
              </ol>
            </section>
          ))}

          <AnimatePresence initial={false}>
            {rows.length === 0 && (
              <motion.div key="empty" {...swapMotion}>
                <EmptyLog isFiltered={isFiltered} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {total > perPage && (
        <div className="bc-mt-5 bc-flex bc-justify-end">
          <Pagination
            current={activityLog?.pagination.current_page ?? 1}
            onChange={(page, pageSize) =>
              setFilters(previous => ({ ...previous, page, per_page: pageSize }))
            }
            pageSize={perPage}
            showSizeChanger
            total={total}
          />
        </div>
      )}
    </div>
  )
}
