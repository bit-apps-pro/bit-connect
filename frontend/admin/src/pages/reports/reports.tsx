import { __ } from '@common/helpers/i18nWrap'
import { Alert, Pagination, Skeleton, Tabs, Typography } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { LuInbox, LuShieldCheck } from 'react-icons/lu'

import { useCardMotion, useSwapMotion } from '@/utils/list-motion'

import { type ReportsFilters, useReports } from './data/use-reports'
import ReportCard from './ui/report-card'

const { Text, Title } = Typography

/**
 * The panels are left off deliberately: every tab shows the same list, only
 * filtered, so it is rendered once below the bar rather than four times inside
 * it — one AnimatePresence tree instead of one per visited tab.
 */
const STATUS_TABS = [
  { key: 'pending', label: __('Awaiting review') },
  { key: 'resolved_kept', label: __('Kept') },
  { key: 'resolved_removed', label: __('Removed') },
  { key: 'dismissed', label: __('Dismissed') }
]

/**
 * What each tab is counting, spelled out under the number in the header.
 *
 * "7" over a queue means nothing on its own, and "7 reports" would be wrong —
 * the queue's unit is the reported item, and seven people reporting one comment
 * is one thing to look at.
 */
const TAB_TOTALS: Record<string, string> = {
  dismissed: __('items dismissed'),
  pending: __('items awaiting review'),
  resolved_kept: __('items kept'),
  resolved_removed: __('items removed')
}

const EMPTY_TEXT: Record<string, string> = {
  dismissed: __('No report has been dismissed yet.'),
  pending: __('Nothing is waiting for review.'),
  resolved_kept: __('No reported content has been kept yet.'),
  resolved_removed: __('No reported content has been removed yet.')
}

function LoadingCards() {
  return (
    <div className="bc-flex bc-flex-col bc-gap-4">
      {[0, 1, 2].map(index => (
        <div
          className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-5"
          key={index}
        >
          <Skeleton active paragraph={{ rows: 3 }} title={{ width: '40%' }} />
        </div>
      ))}
    </div>
  )
}

function EmptyQueue({ status }: { status: string }) {
  // An empty pending queue is the good outcome and says so; an empty archive is
  // just an archive nothing has been filed in yet.
  const isPending = status === 'pending'
  const Icon = isPending ? LuShieldCheck : LuInbox

  return (
    <div className="bc-flex bc-flex-col bc-items-center bc-gap-2 bc-rounded-lg bc-border bc-border-dashed bc-border-line-strong bc-bg-surface-sunken bc-px-6 bc-py-16 bc-text-center">
      <Icon
        aria-hidden
        className={`bc-text-3xl ${isPending ? 'bc-text-positive' : 'bc-text-ink-subtle'}`}
      />
      <Text strong>{EMPTY_TEXT[status] ?? __('Nothing here yet.')}</Text>
      {isPending && (
        <Text className="bc-text-sm" type="secondary">
          {__('Reports members file from the forum land here for a decision.')}
        </Text>
      )}
    </div>
  )
}

export default function Reports() {
  const [filters, setFilters] = useState<ReportsFilters>({ page: 1, per_page: 20, status: 'pending' })
  const { isReportsError, isReportsFetching, isReportsStale, reports } = useReports(filters)
  const cardMotion = useCardMotion()
  const swapMotion = useSwapMotion()

  const status = filters.status ?? 'pending'
  const isPending = status === 'pending'
  const entries = reports?.data ?? []
  const total = reports?.pagination.total ?? 0
  // `keepPreviousData` keeps the last tab on screen while the next one loads, so
  // the skeleton is only for the very first read — swapping a full list for
  // three grey boxes on every tab click is a worse answer than a moment of
  // stale content that dims to say it is stale.
  const isFirstLoad = isReportsFetching && !reports

  return (
    <div className="bc-p-6">
      <div className="bc-mb-5 bc-flex bc-flex-wrap bc-items-start bc-justify-between bc-gap-4">
        <div>
          <Title className="bc-mb-1" level={3}>
            {__('Reports')}
          </Title>
          <Text type="secondary">
            {__('Grouped by what was reported — several people reporting one item is one decision.')}
          </Text>
        </div>

        {total > 0 && (
          <div className="bc-shrink-0 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-5 bc-py-3 bc-text-center">
            {/* The number ticks over rather than blinking to a new value, so a
                decision is felt in the header as well as in the list. */}
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                className={`bc-text-2xl bc-font-semibold bc-leading-none ${
                  isPending ? 'bc-text-negative' : 'bc-text-ink'
                }`}
                key={total}
                {...swapMotion}
              >
                {total}
              </motion.div>
            </AnimatePresence>
            <div className="bc-mt-1 bc-text-xs bc-text-ink-subtle">
              {TAB_TOTALS[status] ?? __('items')}
            </div>
          </div>
        )}
      </div>

      <Tabs
        activeKey={status}
        items={STATUS_TABS}
        onChange={key => setFilters(previous => ({ ...previous, page: 1, status: key }))}
      />

      {isReportsError && (
        <Alert
          className="bc-mb-4"
          description={__('The report queue could not be loaded.')}
          message={__('Something went wrong')}
          showIcon
          type="error"
        />
      )}

      {reports?.truncated && (
        <Alert
          className="bc-mb-4"
          description={__(
            'There are more reports than this screen reads at once. Work through these and reload.'
          )}
          message={__('Showing part of the queue')}
          showIcon
          type="warning"
        />
      )}

      {isFirstLoad && <LoadingCards />}

      {!isFirstLoad && (
        <div
          className={`bc-flex bc-flex-col bc-gap-4 bc-transition-opacity ${
            isReportsStale ? 'bc-pointer-events-none bc-opacity-50' : ''
          }`}
        >
          {/* `popLayout` takes a leaving card out of the flow before its exit
              finishes, so the cards below start closing the gap immediately
              instead of waiting for a hole to finish emptying.

              The status is part of the key so switching tabs always swaps a
              whole set of cards for another. Keyed on the target alone, an item
              resolved and then looked up on the tab it moved to would be the
              same key entering and leaving at once. */}
          <AnimatePresence initial={false} mode="popLayout">
            {entries.map((entry, index) => (
              <motion.div
                key={`${status}:${entry.target_type}:${entry.target_id}`}
                {...cardMotion(index)}
              >
                <ReportCard
                  entry={entry}
                  isPending={isPending}
                  outcome={isPending ? undefined : status}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {entries.length === 0 && (
              <motion.div key="empty" {...swapMotion}>
                <EmptyQueue status={status} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {total > (reports?.pagination.per_page ?? 20) && (
        <div className="bc-mt-5 bc-flex bc-justify-end">
          <Pagination
            current={reports?.pagination.current_page ?? 1}
            onChange={(page, pageSize) =>
              setFilters(previous => ({ ...previous, page, per_page: pageSize }))
            }
            pageSize={reports?.pagination.per_page ?? 20}
            showSizeChanger
            total={total}
          />
        </div>
      )}
    </div>
  )
}
