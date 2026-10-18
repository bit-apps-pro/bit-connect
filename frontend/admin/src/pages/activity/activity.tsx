import { __, sprintf } from '@common/helpers/i18nWrap'
import { Alert, Button, Input, Pagination, Select, Skeleton, Tooltip, Typography } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { LuHistory, LuSearch, LuX } from 'react-icons/lu'

import { dayLabel } from '@/utils/format'
import { useSwapMotion } from '@/utils/list-motion'

import useAuthorSearch from '../topics/data/use-author-search'
import useActivityLog, {
  type ActivityPeriod,
  type ActivityRow,
  useActivityActions
} from './data/use-activity-log'
import useActivityFilters from './state/use-activity-filters'
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
    <div
      aria-busy
      className="bc-flex bc-flex-col bc-gap-4 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-6 bc-py-5"
    >
      <Skeleton.Button active size="small" />
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
    <div className="bc-flex bc-flex-col bc-items-center bc-gap-2 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-6 bc-py-16 bc-text-center">
      <LuHistory aria-hidden className="bc-text-3xl bc-text-ink-subtle" />
      <Text strong>
        {isFiltered ? __('Nothing matches those filters.') : __('Nothing recorded yet.')}
      </Text>
      <Text className="bc-max-w-md bc-text-sm" type="secondary">
        {isFiltered
          ? __('Try a wider search. A post and a comment can have the same ID, so check the type too.')
          : __('Rows appear when someone acts on content they did not write.')}
      </Text>
    </div>
  )
}

export default function Activity() {
  const { actorName, clear, filters, setFilter, setPage } = useActivityFilters()
  const { activityActions } = useActivityActions()
  const { activityLog, isActivityLogError, isActivityLogFetching } = useActivityLog(filters)
  const [actorTerm, setActorTerm] = useState('')
  const { authors, isSearching } = useAuthorSearch(actorTerm)
  const swapMotion = useSwapMotion()

  const rows = activityLog?.data ?? []
  const total = activityLog?.pagination.total ?? 0
  const perPage = activityLog?.pagination.per_page ?? filters.per_page ?? 20
  const currentPage = activityLog?.pagination.current_page ?? 1
  const isFiltered =
    filters.action !== undefined ||
    filters.actor !== undefined ||
    filters.period !== undefined ||
    filters.target_type !== undefined ||
    filters.target_id !== undefined
  // `keepPreviousData` holds the last result on screen while the next one loads,
  // so the skeleton is only for the very first read — replacing a full page with
  // grey bars on every filter keystroke is worse than a moment of stale rows
  // that dim to say they are stale.
  const isFirstLoad = isActivityLogFetching && !activityLog
  const groups = byDay(rows)
  const firstShown = (currentPage - 1) * perPage + 1
  const lastShown = firstShown + rows.length - 1

  const periods: { label: string; value: ActivityPeriod }[] = [
    { label: __('Today'), value: 'today' },
    { label: __('Yesterday'), value: 'yesterday' },
    { label: __('Last 7 days'), value: '7d' },
    { label: __('Last 30 days'), value: '30d' },
    { label: __('Last 90 days'), value: '90d' }
  ]

  // The person picked from a row is not in the search results, so the select
  // would print their bare id; the name travels with the filter instead.
  const actorLabel = actorName || (filters.actor ? sprintf(__('Member #%s'), String(filters.actor)) : '')

  return (
    <div className="bc-p-6">
      <div className="bc-mb-5 bc-min-w-0">
        <Title className="bc-mb-0" level={3}>
          {__('Activity')}
        </Title>
        <Text type="secondary">
          {__('What was done to content by someone other than its author: hides, locks, deletions, restores and report decisions.')}
        </Text>
      </div>

      <div className="bc-mb-5 bc-flex bc-flex-wrap bc-items-center bc-gap-3">
        <Select
          allowClear
          className="bc-min-w-[220px]"
          onChange={value => setFilter({ action: value })}
          options={activityActions}
          placeholder={__('Any action')}
          value={filters.action}
        />
        <Select
          allowClear
          className="bc-min-w-[160px]"
          onChange={value => setFilter({ target_type: value })}
          options={[
            { label: __('Posts'), value: 'post' },
            { label: __('Comments'), value: 'comment' }
          ]}
          placeholder={__('Any content type')}
          value={filters.target_type}
        />
        <Select
          allowClear
          className="bc-min-w-[180px]"
          filterOption={false}
          loading={isSearching}
          notFoundContent={actorTerm.trim() === '' ? __('Type a name') : __('No members found')}
          onChange={(actor: number | undefined, option) =>
            setFilter(
              { actor },
              actor && !Array.isArray(option) ? String(option?.label ?? '') : ''
            )
          }
          onSearch={setActorTerm}
          options={authors.map(author => ({ label: author.name, value: author.id }))}
          placeholder={__('Anyone')}
          showSearch
          value={filters.actor}
          {...(filters.actor ? { labelRender: () => actorLabel } : {})}
        />
        <Select
          allowClear
          className="bc-min-w-[150px]"
          onChange={(period: ActivityPeriod | undefined) => setFilter({ period })}
          options={periods}
          placeholder={__('Any time')}
          value={filters.period}
        />
        {/* Search by id rather than by words: the log stores excerpts of content
            that may no longer exist, so matching on text would find a deleted
            topic by a phrase nobody can look up any more. The id is stable, it
            is printed on every row, and it is the handle a moderator already has
            when someone asks what happened to their post. */}
        <Tooltip title={__('IDs are unique per type, so a post and a comment can have the same one.')}>
          <Input
            allowClear
            className="bc-max-w-[200px]"
            inputMode="numeric"
            onChange={event => {
              const digits = event.target.value.replaceAll(/\D/g, '')
              setFilter({ target_id: digits === '' ? undefined : Number(digits) })
            }}
            placeholder={__('Post or comment ID')}
            prefix={<LuSearch aria-hidden className="bc-text-ink-subtle" />}
            value={filters.target_id ?? ''}
          />
        </Tooltip>

        {isFiltered && (
          <Button icon={<LuX aria-hidden />} onClick={clear} size="small" type="text">
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
          className={`bc-flex bc-flex-col bc-gap-5 bc-transition-opacity ${
            isActivityLogFetching ? 'bc-pointer-events-none bc-opacity-50' : ''
          }`}
        >
          {groups.map(group => (
            <section
              className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-6 bc-pb-2 bc-pt-5"
              key={group.label}
            >
              {/* The heading is what makes a run of timestamps legible: without
                  it every row prints its own date and the reader does the
                  grouping by eye, on a screen whose whole job is chronology. */}
              <h4 className="bc-m-0 bc-mb-4">
                <span className="bc-inline-block bc-rounded-md bc-bg-surface-sunken bc-px-2.5 bc-py-1 bc-text-sm bc-font-medium bc-text-ink">
                  {group.label}
                </span>
              </h4>

              <ol className="bc-m-0 bc-list-none bc-p-0">
                {group.rows.map((row, index) => (
                  <ActivityRowItem
                    index={index}
                    isLast={index === group.rows.length - 1}
                    key={row.id}
                    onFilterActor={person => setFilter({ actor: person.id }, person.name)}
                    onFilterTarget={target =>
                      setFilter({ target_id: target.id, target_type: target.type })
                    }
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

      {/* The count sits with the list it counts. As a header tile it read like a
          dashboard figure, when all it says is how far down the log goes. */}
      {total > 0 && (
        <div className="bc-mt-5 bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3">
          <Text className="bc-text-sm" type="secondary">
            {sprintf(
              // translators: 1: first row shown, 2: last row shown, 3: how many rows match.
              __('Showing %1$s–%2$s of %3$s'),
              String(firstShown),
              String(lastShown),
              String(total)
            )}
          </Text>
          {total > perPage && (
            <Pagination
              current={currentPage}
              onChange={setPage}
              pageSize={perPage}
              showSizeChanger
              total={total}
            />
          )}
        </div>
      )}
    </div>
  )
}
