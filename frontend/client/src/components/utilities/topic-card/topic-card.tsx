import { __ } from '@common/helpers/i18nWrap'
import { plainText } from '@common/helpers/plain-text'
import { type Topic } from '@features/topic-modal/shared/type'
import VoteBox from '@pages/Post/ui/voteBox/VoteBox'
import UserLink from '@utilities/user-link'
import { Flex, Tag, Typography } from 'antd'
import { LuCalendar, LuMessageCircle } from 'react-icons/lu'
import { Link } from 'react-router'

import { useAdminSettingsStore } from '@/store/admin-settings.zustand'
import { useAuthStore } from '@/store/auth.zustand'
import { routePath } from '@/utils/route-path'
import useChipProps from '@/utils/use-chip-props'
import { relativeTime } from '@/utils/utils'

import TopicCardState from './topic-card-state'
import TopicCardTerms from './topic-card-terms'
import './topic-card.css'

/** "20 Nov 2025" — in the reader's own locale's order. */
const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
})

/** Upper bound on the string handed to the DOM; CSS clamps what is shown. */
const EXCERPT_LENGTH = 320

/**
 * Plain-text excerpt.
 *
 * Slicing the raw HTML at a fixed offset could cut mid-tag ("<stro"), leaving
 * the sanitizer to drop a mangled element and the excerpt to end mid-word with
 * markup that never opened. Tags are stripped first, so the count is characters
 * the reader actually sees.
 */
const excerptOf = (html: string) => {
  const text = plainText(html)

  return text.length > EXCERPT_LENGTH ? text.slice(0, EXCERPT_LENGTH).trimEnd() + '…' : text
}

export default function TopicCard({
  onVote,
  topic
}: {
  onVote: (postId: number) => Promise<void>
  topic: Topic
}) {
  const {
    author_avatar: authorAvatar,
    author_name: authorName,
    comments_count: commentsCount,
    ID: postId,
    post_content: postContent,
    post_date_gmt: postDateGmt,
    post_title: postTitle,
    terms: { statuses, tags, topic_types: topicTypes },
    vote: { hasVoted, total }
  } = topic

  const postDate = new Date(postDateGmt.replace(' ', 'T') + 'Z')
  const relativeDate = relativeTime(postDateGmt)
  const calendarDate = DATE_FORMATTER.format(postDate)
  const { settings } = useAdminSettingsStore()
  const canComment = settings.topicAccess.comment
  const { can, isLoggedIn } = useAuthStore()
  // Same rule as the topic page: a member without the capability gets a
  // disabled control, a guest a live one that asks them to sign in.
  const memberMayVote = !isLoggedIn || can('bit_connect_forum_vote_post')
  const { chipTagProps } = useChipProps()

  const handlePostVote = async () => {
    await onVote(postId)
  }

  return (
    <div className="topic-card bc-relative bc-flex bc-max-w-full bc-gap-3 bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-line bc-p-3 bc-transition-all lg:bc-gap-4 lg:bc-p-4">
      {/* Above the card link overlay so voting never navigates. */}
      <div className="bc-relative bc-z-10">
        <VoteBox isVote={hasVoted} onVote={memberMayVote ? handlePostVote : undefined} votes={total} />
      </div>

      <div className="bc-flex bc-min-w-0 bc-max-w-full bc-flex-1 bc-flex-col">
        {/* The link stretches over the whole card (see topic-card.css), so the
            target is the card rather than the title text alone. */}
        <Link className="topic-card__link" to={routePath(`/${topic.post_name}`)}>
          {/* One chip holds the card's right edge, aligned down the list so the
              column can be scanned on its own. Which chip depends on the width:
              below md the topic type, since that is what a reader scans a phone
              list for; from md the status, with the type moving to the meta
              line, which by then has room for it. */}
          <Flex align="start" gap="small">
            <Typography.Title
              className="topic-card__title bc-mb-0 bc-min-w-0 bc-flex-1 bc-text-[16px] bc-font-semibold bc-leading-snug lg:bc-text-[17px]"
              level={2}
            >
              {postTitle}
            </Typography.Title>

            {/* Capped: the title keeps most of the row whatever the site
                owner named the term, and the chip truncates instead. */}
            {topicTypes && (
              <Tag
                className="bc-m-0 bc-max-w-[40%] bc-shrink-0 bc-truncate md:bc-hidden"
                title={topicTypes.name}
                {...chipTagProps(topicTypes.meta.color)}
              >
                {topicTypes.name}
              </Tag>
            )}

            {statuses && (
              <Tag
                className="bc-m-0 bc-hidden bc-max-w-[40%] bc-shrink-0 bc-truncate md:bc-inline-block"
                title={statuses.name}
                {...chipTagProps(statuses.meta.color)}
              >
                {statuses.name}
              </Tag>
            )}
          </Flex>

          {/* Two lines, clamped in CSS rather than by the character count alone:
              the count cannot know the card's width, so it under-filled a wide
              card and overflowed to four lines on a phone. Every row in the
              list now has the same height whatever the viewport. */}
          <p className="topic-card__excerpt bc-mb-0 bc-mt-1 bc-text-[14px] bc-leading-[1.6] bc-text-ink-muted">
            {excerptOf(postContent)}
          </p>
        </Link>

        {/* One wrapping meta row at every width — author, date, comments, type,
            then tags. The author and tag links sit above the card overlay, so
            they keep their own destinations. */}
        <div className="topic-card__meta bc-mt-3 bc-flex bc-min-w-0 bc-flex-wrap bc-items-center bc-gap-x-3 bc-gap-y-2 md:bc-gap-x-4">
          <TopicCardState topic={topic} />
          <UserLink
            avatar={authorAvatar}
            avatarSize={24}
            badge={topic.author_badge}
            name={authorName}
            // Capped on narrow screens: a full name pushed the date onto its own
            // line, which pushed the type chip onto a third — three meta rows on
            // a 320px card. Uncapped from md, where the line has room.
            nameClassName="bc-block bc-max-w-[88px] bc-truncate bc-text-sm bc-text-ink-muted sm:bc-max-w-none"
            slug={topic.author_slug}
          />

          <Flex align="center" className="bc-text-sm bc-text-ink-muted" gap="small">
            {/* The icon is decoration next to a self-explanatory date; at 320px
                its 26px was the difference between the meta fitting on two
                lines and spilling onto three. */}
            <LuCalendar className="bc-hidden sm:bc-block" size={18} />
            {/* The calendar date from sm, where the row has room for it; the
                shorter "2mo ago" on phones. Each carries the other as a hint. */}
            <time
              className="bc-whitespace-nowrap"
              dateTime={postDate.toISOString()}
              title={relativeDate}
            >
              <span className="sm:bc-hidden">{relativeDate}</span>
              <span className="bc-hidden sm:bc-inline">{calendarDate}</span>
            </time>
          </Flex>

          {canComment && (
            <Flex align="center" className="bc-text-sm bc-text-ink-muted" gap="small">
              <LuMessageCircle size={18} />
              {/* The count alone on phones, where the icon says what it is. */}
              <span className="bc-whitespace-nowrap">
                {commentsCount}
                <span className="bc-hidden sm:bc-inline">
                  {' '}
                  {/* The count arrives as a string from WordPress. */}
                  {Number(commentsCount) === 1 ? __('Comment') : __('Comments')}
                </span>
              </span>
            </Flex>
          )}

          {/* From md only: below that the type is the chip beside the title. */}
          {topicTypes && (
            <Tag
              className="bc-m-0 bc-hidden bc-max-w-full bc-shrink-0 bc-truncate md:bc-inline-block"
              title={topicTypes.name}
              {...chipTagProps(topicTypes.meta.color)}
            >
              {topicTypes.name}
            </Tag>
          )}

          {TopicCardTerms && <TopicCardTerms topic={topic} />}

          {/* Tags are the card's least-used signal and the first thing to wrap:
              on a phone they took a second row of their own on some cards and
              not others, so no two rows read alike. They return from md, where
              the meta line has room for them. The topic page always shows the
              full set. */}
          {tags.length > 0 && (
            <div className="bc-hidden bc-min-w-0 bc-max-w-full bc-flex-wrap bc-gap-x-2 bc-gap-y-1 md:bc-flex">
              {tags.map(tag => (
                <Typography.Text className="bc-max-w-full bc-truncate" key={tag.term_id} type="secondary">
                  #{tag.name.replaceAll(' ', '_')}
                </Typography.Text>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
