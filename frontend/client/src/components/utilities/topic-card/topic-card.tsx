import { __ } from '@common/helpers/i18nWrap'
import { plainText } from '@common/helpers/plain-text'
import { type Topic } from '@features/topic-modal/shared/type'
import { CHIP_LINK, chipClass, chipTitle } from '@pages/Post/ui/tag-chips'
import VoteBox from '@pages/Post/ui/voteBox/VoteBox'
import { tagLabel } from '@utilities/tag-filter'
import UserLink from '@utilities/user-link'
import { archivePath } from '@utils/listing-path'
import { Flex, Tag, Typography } from 'antd'
import { LuCalendar, LuMessageCircle } from 'react-icons/lu'
import { Link } from 'react-router'

import { useAdminSettingsStore } from '@/store/admin-settings.zustand'
import { useAuthStore } from '@/store/auth.zustand'
import { routePath } from '@/utils/route-path'
import { formatSiteTime } from '@/utils/site-time'
import useChipProps from '@/utils/use-chip-props'
import { relativeTime } from '@/utils/utils'

import TopicCardState from './topic-card-state'
import TopicCardTerms from './topic-card-terms'
import './topic-card.css'

/** "20 Nov 2025" — on the site's calendar, in the reader's own locale's order. */
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }

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
  const calendarDate = formatSiteTime(postDate, DATE_OPTIONS)
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

        {/* One meta row — author, date, comments, type, then tags. On a phone
            it never wraps: the author's name gives way with an ellipsis, so
            the date and count keep their line. Below 360px, where even a
            shortened name would not fit beside them, and from sm, it wraps.
            The author and tag links sit above the card overlay, so they keep
            their own destinations. */}
        <div className="topic-card__meta bc-mt-3 bc-flex bc-min-w-0 bc-items-center bc-gap-x-3 bc-gap-y-2 max-[359px]:bc-flex-wrap sm:bc-flex-wrap md:bc-gap-x-4">
          <TopicCardState topic={topic} />
          <UserLink
            avatar={authorAvatar}
            avatarSize={18}
            badge={topic.author_badge}
            // Dropped on phones, where it pushed the comment count onto a
            // second line; the topic page and profile still carry it.
            badgeClassName="bc-hidden sm:bc-inline"
            // The avatar and the first letters at least, however short the line.
            className="bc-min-w-[3.25rem]"
            name={authorName}
            // Capped on a phone, and shrinks below the cap when the line is
            // short, so a long name ends in an ellipsis rather than pushing the
            // date and count onto a second line. Uncapped from sm.
            nameClassName="bc-block bc-max-w-[88px] bc-truncate bc-text-xs bc-text-ink-muted sm:bc-max-w-none sm:bc-text-sm"
            slug={topic.author_slug}
          />

          {/* Icons are sized in em, a step above the text they label, so they
              scale with it: 12px text on a phone, where the smaller type is
              what lets "Comments" fit the line, and 14px from sm. */}
          <Flex
            align="center"
            className="bc-shrink-0 bc-text-xs bc-text-ink-muted sm:bc-text-sm"
            gap={4}
          >
            <LuCalendar className="bc-shrink-0" size="1.15em" />
            {/* "3d ago" — how fresh a topic is matters more down a list than
                the day it was posted, which the hover carries instead. */}
            <time
              className="bc-whitespace-nowrap"
              dateTime={postDate.toISOString()}
              title={calendarDate}
            >
              {relativeDate}
            </time>
          </Flex>

          {canComment && (
            <Flex
              align="center"
              className="bc-shrink-0 bc-text-xs bc-text-ink-muted sm:bc-text-sm"
              gap={4}
            >
              <LuMessageCircle className="bc-shrink-0" size="1.15em" />
              <span className="bc-whitespace-nowrap">
                {commentsCount} {/* The count arrives as a string from WordPress. */}
                {Number(commentsCount) === 1 ? __('Comment') : __('Comments')}
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
              {/* The same pills the topic page uses, so a tag looks like a tag
                  wherever it appears — as muted text they read as more meta.
                  Each links to its archive; the meta row sits above the card's
                  overlay, so they keep their own destination. */}
              {tags.map(tag => (
                <Link className={CHIP_LINK} key={tag.term_id} to={archivePath('tags', tag.slug)}>
                  <Tag className={chipClass(tag.pending)} title={chipTitle(tag.name, tag.pending)}>
                    {tagLabel(tag.name)}
                  </Tag>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
