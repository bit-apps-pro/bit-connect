import { __, sprintf } from '@common/helpers/i18nWrap'
import { Empty, Skeleton } from 'antd'
import { LuMessageCircle, LuPencilLine, LuThumbsUp } from 'react-icons/lu'
import { Link } from 'react-router'

import { routePath } from '@/utils/route-path'

import { type InsightTerm, type UserInsights } from '../data/use-user-insights'

/**
 * Bar colours for topic types an admin has not coloured. Cycled by position,
 * so the breakdown still reads as distinct segments on a fresh install.
 */
const FALLBACK_COLORS = ['#3266EA', '#E8830C', '#F04444', '#7C3AED', '#E0407B', '#0EA5A4']

const numberFormat = new Intl.NumberFormat()

const CARD = 'bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface'

function StatTile({
  icon,
  isLoading,
  label,
  value
}: {
  icon: React.ReactNode
  isLoading: boolean
  label: string
  value: number | undefined
}) {
  return (
    <div className={`${CARD} bc-flex bc-flex-col bc-gap-5 bc-p-5`}>
      <div className="bc-flex bc-items-center bc-gap-2.5">
        <span
          aria-hidden="true"
          className="bc-flex bc-h-8 bc-w-8 bc-items-center bc-justify-center bc-rounded-md bc-bg-primary/10 bc-text-primary"
        >
          {icon}
        </span>
        <span className="bc-text-[15px] bc-text-ink">{label}</span>
      </div>
      {isLoading ? (
        <Skeleton.Button active size="large" />
      ) : (
        <span className="bc-text-[34px] bc-font-semibold bc-leading-none bc-text-ink">
          {numberFormat.format(value ?? 0)}
        </span>
      )}
    </div>
  )
}

function SectionHeader({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <div className="bc-px-5 bc-pb-4 bc-pt-5">
      <h2 className="bc-m-0 bc-text-[19px] bc-font-medium bc-text-ink">{title}</h2>
      <p className="bc-m-0 bc-mt-1 bc-text-[12px] bc-text-ink-subtle">{subtitle}</p>
    </div>
  )
}

function TypeChip({ color, term }: { color: string; term: InsightTerm }) {
  return (
    <span className="bc-inline-flex bc-max-w-full bc-items-center bc-gap-1.5 bc-rounded-md bc-border bc-border-solid bc-border-line bc-px-2 bc-py-0.5 bc-text-[13px] bc-text-ink-muted">
      <span
        aria-hidden="true"
        className="bc-h-2 bc-w-2 bc-shrink-0 bc-rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="bc-truncate">{term.name}</span>
    </span>
  )
}

/**
 * The profile's Overview: what the member did over the chosen period.
 *
 * Three totals, their most-voted topics, and how those topics split across
 * topic types. Every figure is public content the portal already shows — see
 * UserInsightsService.
 */
export default function InsightsOverview({
  insights,
  isFetching,
  isLoading
}: {
  insights: undefined | UserInsights
  isFetching: boolean
  isLoading: boolean
}) {
  const totals = insights?.totals
  const breakdown = insights?.breakdown ?? []
  const topTopics = insights?.top_topics ?? []

  // One colour per type, shared by the table's chips and the breakdown's bars,
  // so a type reads as the same colour wherever it appears.
  const colorOf = new Map<number, string>()
  breakdown.forEach((term, index) =>
    colorOf.set(term.term_id, term.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length])
  )
  const colorFor = (term: InsightTerm) =>
    colorOf.get(term.term_id) ?? term.color ?? FALLBACK_COLORS[0]

  const topicTotal = totals?.topics ?? 0

  return (
    <div
      aria-busy={isFetching}
      className={`bc-flex bc-flex-col bc-gap-4 bc-transition-opacity ${isFetching && !isLoading ? 'bc-opacity-60' : ''}`}
    >
      <div className="bc-grid bc-grid-cols-1 bc-gap-3 sm:bc-grid-cols-3">
        <StatTile
          icon={<LuPencilLine size={16} />}
          isLoading={isLoading}
          label={__('Total Posts')}
          value={totals?.topics}
        />
        <StatTile
          icon={<LuThumbsUp size={16} />}
          isLoading={isLoading}
          label={__('Total Upvotes')}
          value={totals?.votes_received}
        />
        <StatTile
          icon={<LuMessageCircle size={16} />}
          isLoading={isLoading}
          label={__('Total Comments')}
          value={totals?.comments}
        />
      </div>

      <div className="bc-grid bc-grid-cols-1 bc-items-start bc-gap-4 xl:bc-grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <section aria-label={__('Top Liked Posts')} className={`${CARD} bc-overflow-hidden`}>
          <SectionHeader
            subtitle={__('Their most upvoted posts in this period')}
            title={__('Top Liked Posts')}
          />

          {isLoading && (
            <div className="bc-px-5 bc-pb-5">
              <Skeleton active paragraph={{ rows: 4 }} title={false} />
            </div>
          )}

          {!isLoading && topTopics.length === 0 && (
            <div className="bc-pb-8">
              <Empty
                description={__('No posts in this period.')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          )}

          {!isLoading && topTopics.length > 0 && (
            // Scrolls sideways on a phone rather than squeezing the title
            // column down to a word per line.
            <div className="bc-overflow-x-auto">
              <table className="bc-w-full bc-min-w-[560px] bc-border-collapse bc-text-left">
                <thead>
                  <tr className="bc-bg-surface-sunken bc-text-[14px] bc-text-ink-muted">
                    <th className="bc-w-16 bc-py-3.5 bc-pl-5 bc-pr-2 bc-font-medium" scope="col">
                      {__('Rank')}
                    </th>
                    {/* The title takes whatever the other columns leave; they
                        size to their content, so it truncates last. */}
                    <th className="bc-w-full bc-px-2 bc-py-3.5 bc-font-medium" scope="col">
                      {__('Post Title')}
                    </th>
                    <th className="bc-whitespace-nowrap bc-px-4 bc-py-3.5 bc-font-medium" scope="col">
                      {__('Topic')}
                    </th>
                    <th
                      className="bc-whitespace-nowrap bc-px-4 bc-py-3.5 bc-text-right bc-font-medium"
                      scope="col"
                    >
                      {__('Likes')}
                    </th>
                    <th
                      className="bc-whitespace-nowrap bc-py-3.5 bc-pl-4 bc-pr-5 bc-text-right bc-font-medium"
                      scope="col"
                    >
                      {__('Replies')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topTopics.map((topic, index) => (
                    <tr
                      className="bc-border-0 bc-border-t bc-border-solid bc-border-line bc-text-[14px]"
                      key={topic.ID}
                    >
                      <td className="bc-py-4 bc-pl-5 bc-pr-2 bc-text-ink-subtle">#{index + 1}</td>
                      <td className="bc-max-w-0 bc-px-2 bc-py-4">
                        <Link
                          className="bc-block bc-truncate bc-text-ink bc-no-underline hover:bc-text-primary"
                          to={routePath(`/${topic.post_name}`)}
                        >
                          {topic.post_title || __('(no title)')}
                        </Link>
                      </td>
                      <td className="bc-whitespace-nowrap bc-px-4 bc-py-4">
                        {topic.topic_type ? (
                          <TypeChip color={colorFor(topic.topic_type)} term={topic.topic_type} />
                        ) : (
                          <span className="bc-text-ink-subtle">-</span>
                        )}
                      </td>
                      <td className="bc-px-4 bc-py-4 bc-text-right bc-font-semibold bc-text-ink">
                        {numberFormat.format(topic.votes)}
                      </td>
                      <td className="bc-py-4 bc-pl-4 bc-pr-5 bc-text-right bc-text-ink-muted">
                        {numberFormat.format(topic.comments)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-label={__('Topics Breakdown')} className={CARD}>
          <SectionHeader
            subtitle={__('How their posts split across topic types')}
            title={__('Topics Breakdown')}
          />

          <div className="bc-flex bc-flex-col bc-gap-5 bc-px-5 bc-pb-5">
            {isLoading && <Skeleton active paragraph={{ rows: 4 }} title={false} />}

            {!isLoading && breakdown.length === 0 && (
              <p className="bc-m-0 bc-py-4 bc-text-center bc-text-[13px] bc-text-ink-subtle">
                {__('No categorised posts in this period.')}
              </p>
            )}

            {!isLoading &&
              breakdown.map(term => {
                // Share of all their posts in the period — a topic carries one
                // type, so the bars never sum past a full track.
                const share = topicTotal > 0 ? Math.min(100, (term.count / topicTotal) * 100) : 0
                return (
                  <div key={term.term_id}>
                    <div className="bc-mb-2 bc-flex bc-items-baseline bc-justify-between bc-gap-3">
                      <span className="bc-truncate bc-text-[14px] bc-text-ink">{term.name}</span>
                      <span className="bc-shrink-0 bc-text-[12px] bc-font-semibold bc-text-ink">
                        {sprintf(
                          term.count === 1 ? __('%s post') : __('%s posts'),
                          numberFormat.format(term.count)
                        )}
                      </span>
                    </div>
                    <div
                      aria-label={term.name}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={Math.round(share)}
                      className="bc-h-1 bc-overflow-hidden bc-rounded-full bc-bg-surface-sunken"
                      role="progressbar"
                    >
                      <div
                        className="bc-h-full bc-rounded-full bc-transition-[width] bc-duration-500"
                        style={{ backgroundColor: colorFor(term), width: `${share}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      </div>
    </div>
  )
}
