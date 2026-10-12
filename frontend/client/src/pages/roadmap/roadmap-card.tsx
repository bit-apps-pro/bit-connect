import NotifyContext from '@common/context/NotifyContext'
import { __, sprintf } from '@common/helpers/i18nWrap'
import useCapabilityGate from '@common/hooks/useCapabilityGate'
import { queryClient } from '@config/query-client'
import { type Topic } from '@features/topic-modal/shared/type'
import VoteBox from '@pages/Post/ui/voteBox/VoteBox'
import { type InfiniteData } from '@tanstack/react-query'
import { Avatar, Tag } from 'antd'
import { useContext } from 'react'
import { LuCircleCheck, LuLayoutGrid, LuMessageCircle, LuUser } from 'react-icons/lu'
import { Link } from 'react-router'

import { type PortalArchive } from '@/config/config'
import { useAuthStore } from '@/store/auth.zustand'
import { type TopicsPage } from '@/store/data/fetch-all-posts-api'
import { toggleVoteApi } from '@/store/data/toggle-vote-api'
import { syncTopicVote } from '@/store/helper/topic-vote-sync'
import { syncVotesReceived } from '@/store/helper/user-stats-sync'
import { flipVote, type Vote } from '@/store/helper/vote-flip'
import { routePath } from '@/utils/route-path'
import useChipProps from '@/utils/use-chip-props'

import { placeNames, shortDate, withVote } from './roadmap-data'

// Every row has a fixed height — the title always takes two lines, the type
// row one, the footer one — so the cards are one size down a column and across
// the board, whatever each topic holds. The skeleton below keeps the same rows.
const CARD_CLASS =
  'bc-relative bc-flex bc-gap-3 bc-rounded-[12px] bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-3.5'
const TITLE_HEIGHT = 'bc-h-[2.75em]'
const TYPE_ROW_HEIGHT = 'bc-h-[22px]'
const FOOTER_HEIGHT = 'bc-h-5'

function setCachedVote(queryKey: unknown[], postId: number, vote: Vote) {
  queryClient.setQueryData<InfiniteData<TopicsPage>>(queryKey, data => withVote(data, postId, vote))
}

export default function RoadmapCard({
  arrived,
  places,
  queryKey,
  topic
}: {
  /** The stage's name, on the last column only: "Shipped" in "Shipped Sep 28". */
  arrived: string
  /** Archives whose term names where the topic was posted — see placeArchives. */
  places: PortalArchive[]
  /** The column's query, whose cached pages a vote is written into. */
  queryKey: unknown[]
  topic: Topic
}) {
  const { chipTagProps } = useChipProps()
  const canAct = useCapabilityGate()
  const { notificationApi } = useContext(NotifyContext)
  const { can, isLoggedIn } = useAuthStore()
  const type = topic.terms.topic_types
  const where = placeNames(topic, places)
  const comments = Number(topic.comments_count || 0)
  // On the last column, when the topic got there.
  const arrivedOn = arrived && topic.stage_changed_at ? shortDate(topic.stage_changed_at) : ''
  const { hasVoted, total } = topic.vote
  // A member whose role cannot vote sees the count, not a button that refuses.
  const mayVote = !isLoggedIn || can('bit_connect_forum_vote_post')

  // Straight away on click, then the server's own count — or back to what it
  // was if the vote did not land.
  const vote = async () => {
    if (!canAct('bit_connect_forum_vote_post')) return

    const before = topic.vote
    setCachedVote(queryKey, topic.ID, flipVote(before))

    try {
      const result = await toggleVoteApi(topic.ID)
      const confirmed = { hasVoted: result.hasVoted, total: result.votes }
      setCachedVote(queryKey, topic.ID, confirmed)
      syncTopicVote(topic.ID, confirmed)
      if (topic.post_author) syncVotesReceived(topic.post_author, result.hasVoted)
    } catch {
      setCachedVote(queryKey, topic.ID, before)
      notificationApi?.error({ message: __('Failed to vote on post') })
    }
  }

  return (
    // The topic list's own layout in small: the vote box beside the content.
    // The title's link is stretched over the whole card, so the card opens the
    // topic wherever it is clicked; the vote box sits above that layer.
    <article
      className={`${CARD_CLASS} bc-transition-[border-color,box-shadow] hover:bc-border-line-strong hover:bc-shadow-sm`}
    >
      <div className="bc-relative bc-z-10 bc-shrink-0">
        <VoteBox compact isVote={hasVoted} onVote={mayVote ? vote : undefined} votes={total} />
      </div>

      <div className="bc-flex bc-min-w-0 bc-flex-1 bc-flex-col bc-gap-2">
        <Link
          className={`bc-line-clamp-2 ${TITLE_HEIGHT} bc-text-[15px] bc-font-semibold bc-leading-snug bc-text-ink bc-no-underline after:bc-absolute after:bc-inset-0 after:bc-rounded-[12px] after:bc-content-[''] focus-visible:bc-outline-none`}
          title={topic.post_title}
          to={routePath(`/${topic.post_name}`)}
        >
          {topic.post_title}
        </Link>

        {/* What kind of request it is, as the coloured chip, then where it was
            posted as quiet text: the type is what a reader scans the column
            for, and a second chip beside it would compete with it. */}
        <div className={`bc-flex ${TYPE_ROW_HEIGHT} bc-min-w-0 bc-items-center bc-gap-2 bc-overflow-hidden`}>
          {type && (
            <Tag className="bc-m-0 bc-max-w-[60%] bc-shrink-0 bc-truncate" {...chipTagProps(type.meta?.color)}>
              {type.name}
            </Tag>
          )}
          {where.map(place => (
            <span
              className="bc-inline-flex bc-min-w-0 bc-max-w-full bc-items-center bc-gap-1 bc-text-xs bc-text-ink-muted"
              key={`${place.label}-${place.name}`}
              title={`${place.label}: ${place.name}`}
            >
              <LuLayoutGrid aria-hidden className="bc-shrink-0" size={12} />
              <span className="bc-truncate">{place.name}</span>
            </span>
          ))}
        </div>

        {/* Who asked, how much it has been talked about, and — on the last
            column — when it got there, as a short pill on the same line rather
            than a row of its own that would make those cards taller. */}
        <div
          className={`bc-flex ${FOOTER_HEIGHT} bc-min-w-0 bc-items-center bc-justify-between bc-gap-2 bc-text-xs bc-text-ink-muted`}
        >
          <span className="bc-flex bc-min-w-0 bc-items-center bc-gap-1.5">
            <Avatar
              alt=""
              className="bc-shrink-0"
              icon={topic.author_avatar ? undefined : <LuUser />}
              size={18}
              src={topic.author_avatar || undefined}
            />
            <span className="bc-truncate">{topic.author_name}</span>
          </span>
          <span className="bc-flex bc-shrink-0 bc-items-center bc-gap-2">
            {arrivedOn && (
              <span
                className="bc-inline-flex bc-items-center bc-gap-1 bc-rounded-full bc-bg-positive-soft bc-px-1.5 bc-py-px bc-font-medium bc-text-positive"
                // translators: 1: the stage's name, e.g. Shipped; 2: a short date, e.g. Sep 28
                title={sprintf(__('%1$s %2$s'), arrived, arrivedOn)}
              >
                <LuCircleCheck aria-hidden className="bc-shrink-0" size={12} strokeWidth={2.5} />
                {arrivedOn}
              </span>
            )}
            <span
              className="bc-inline-flex bc-items-center bc-gap-1"
              // translators: %d: how many comments the topic has.
              title={sprintf(comments === 1 ? __('%d comment') : __('%d comments'), comments)}
            >
              <LuMessageCircle aria-hidden size={14} />
              {comments}
            </span>
          </span>
        </div>
      </div>
    </article>
  )
}

const BAR = 'bc-rounded bc-bg-surface-hover'

/**
 * A card's shape while its column loads: the same rows at the same heights, so
 * the board holds still when the real cards replace it.
 */
export function RoadmapCardSkeleton() {
  return (
    <div aria-hidden className={`${CARD_CLASS} bc-animate-pulse`} data-testid="roadmap-card-skeleton">
      <div className={`bc-h-12 bc-w-12 bc-shrink-0 ${BAR} bc-rounded-[8px]`} />
      <div className="bc-flex bc-min-w-0 bc-flex-1 bc-flex-col bc-gap-2">
        <div className={`bc-flex ${TITLE_HEIGHT} bc-flex-col bc-justify-center bc-gap-1.5 bc-text-[15px]`}>
          <div className={`bc-h-3.5 bc-w-11/12 ${BAR}`} />
          <div className={`bc-h-3.5 bc-w-2/3 ${BAR}`} />
        </div>
        <div className={`bc-flex ${TYPE_ROW_HEIGHT} bc-items-center`}>
          <div className={`bc-h-[18px] bc-w-24 ${BAR}`} />
        </div>
        <div className={`bc-flex ${FOOTER_HEIGHT} bc-items-center bc-justify-between`}>
          <div className={`bc-h-3 bc-w-20 ${BAR}`} />
          <div className={`bc-h-3 bc-w-6 ${BAR}`} />
        </div>
      </div>
    </div>
  )
}
