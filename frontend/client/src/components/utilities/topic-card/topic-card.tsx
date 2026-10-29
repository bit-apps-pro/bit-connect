import { contentMedia } from '@common/helpers/content-media'
import { cn } from '@common/helpers/globalHelpers'
import { __ } from '@common/helpers/i18nWrap'
import { plainText } from '@common/helpers/plain-text'
import { createdTopicId } from '@features/topic-modal/shared/created-topic'
import { type Topic } from '@features/topic-modal/shared/type'
import { chipTitle } from '@pages/Post/ui/tag-chips'
import VoteBox from '@pages/Post/ui/voteBox/VoteBox'
import StageIcon from '@utilities/stage-icon'
import { tagLabel } from '@utilities/tag-filter'
import UserLink from '@utilities/user-link'
import { archivePath } from '@utils/listing-path'
import { Flex, Tag, Typography } from 'antd'
import { useEffect, useRef } from 'react'
import { LuClock, LuMessageCircle, LuPlay } from 'react-icons/lu'
import { Link, useLocation } from 'react-router'

import { useAdminSettingsStore } from '@/store/admin-settings.zustand'
import { useAuthStore } from '@/store/auth.zustand'
import { routePath } from '@/utils/route-path'
import { formatSiteTime } from '@/utils/site-time'
import useChipProps from '@/utils/use-chip-props'
import { relativeTime } from '@/utils/utils'

import TopicCardState from './topic-card-state'
import TopicCardSummary from './topic-card-summary'
import TopicCardTerms from './topic-card-terms'
import './topic-card.css'
import usePrefetchTopic from './use-prefetch-topic'

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
  showStage = false,
  topic
}: {
  onVote: (postId: number) => Promise<void>
  /** Badge the topic with its stage, for a list that mixes stages. */
  showStage?: boolean
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
    terms: { stages, statuses, tags, topic_types: topicTypes },
    vote: { hasVoted, total }
  } = topic
  const excerpt = excerptOf(postContent)
  // Only for a topic told in pictures or video alone: with words, the excerpt
  // already says what it is about and the card stays text.
  const media = excerpt ? [] : contentMedia(postContent)

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
  const commentLabel = Number(commentsCount) === 1 ? __('Comment') : __('Comments')

  // The topic its author was just sent here to see: brought into view and
  // picked out for a moment — see created-topic.ts.
  const isJustCreated = createdTopicId(useLocation().state) === postId
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isJustCreated) return

    // Glided to, not jumped to — unless the reader has asked for less motion.
    const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    cardRef.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'nearest' })
  }, [isJustCreated])

  const prefetchHandlers = usePrefetchTopic(topic)

  const handlePostVote = async () => {
    await onVote(postId)
  }

  return (
    <div
      className={cn(
        'topic-card bc-relative bc-flex bc-max-w-full bc-gap-3 bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-line bc-p-3 bc-transition-all lg:bc-gap-4 lg:bc-p-4',
        isJustCreated && 'topic-card--created'
      )}
      ref={cardRef}
    >
      {/* Above the card link overlay so voting never navigates. */}
      <div className="bc-relative bc-z-10">
        <VoteBox isVote={hasVoted} onVote={memberMayVote ? handlePostVote : undefined} votes={total} />
      </div>

      <div className="bc-flex bc-min-w-0 bc-max-w-full bc-flex-1 bc-flex-col">
        {/* The link stretches over the whole card (see topic-card.css), so the
            target is the card rather than the title text alone. */}
        <Link className="topic-card__link" to={routePath(`/${topic.post_name}`)} {...prefetchHandlers}>
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
          {/* Left out for a topic with no words, rather than kept as an empty
              line that pushes the meta row down for nothing. */}
          {excerpt && (
            <p className="topic-card__excerpt bc-mb-0 bc-mt-1 bc-text-[14px] bc-leading-[1.6] bc-text-ink-muted">
              {excerpt}
            </p>
          )}

          {media.length > 0 && <MediaStrip media={media} />}

          <TopicCardSummary topic={topic} />
        </Link>

        {/* One meta row — author, date, comments, type, then tags. On a phone
            it never wraps: the author's name gives way with an ellipsis, so
            the date and count keep their line. Below 360px, where even a
            shortened name would not fit beside them, and from sm, it wraps.
            The author and tag links sit above the card overlay, so they keep
            their own destinations. */}
        <div className="topic-card__meta bc-mt-3 bc-flex bc-min-w-0 bc-items-center bc-gap-x-3 bc-gap-y-2 max-[359px]:bc-flex-wrap sm:bc-flex-wrap md:bc-gap-x-4">
          {/* First on the line, in the stage's own colour: in a list that
              mixes stages, how far along a topic is reads before who wrote it.
              From sm, where the line has room to wrap. */}
          {showStage && stages && (
            <Tag
              className="bc-m-0 bc-hidden bc-max-w-full bc-shrink-0 bc-truncate bc-font-medium sm:bc-inline-block"
              title={stages.name}
              {...chipTagProps(stages.meta.color)}
            >
              <StageIcon
                className="bc-mr-1 bc-inline-block bc-h-3.5 bc-w-3.5 bc-align-[-2px]"
                dark={stages.meta.icon_dark}
                light={stages.meta.icon}
              />
              {stages.name}
            </Tag>
          )}
          <TopicCardState topic={topic} />
          <UserLink
            avatar={authorAvatar}
            avatarSize={18}
            // No member badge: a list row is read for what the topic is, and
            // the badge was one more chip on a line that already has the type
            // and tags. The topic page and the profile carry it.
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
            {/* A clock, not a calendar: what follows is time passed, as on
                the topic page, not a date. */}
            <LuClock aria-hidden className="bc-shrink-0" size="1.15em" />
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

          {/* The count beside its icon, the word for screen readers and the
              hover only: the bubble already says what is counted, and a list
              of "0 Comments" read as more text than the topics themselves. */}
          {canComment && (
            <Flex
              align="center"
              className="bc-shrink-0 bc-text-xs bc-text-ink-muted sm:bc-text-sm"
              gap={4}
              title={`${commentsCount} ${commentLabel}`}
            >
              <LuMessageCircle aria-hidden className="bc-shrink-0" size="1.15em" />
              <span className="bc-whitespace-nowrap">
                {commentsCount} {/* The count arrives as a string from WordPress. */}
                <span className="bc-sr-only">{commentLabel}</span>
              </span>
            </Flex>
          )}

          {/* Where the topic was posted, as plain meta beside who and when. */}
          {TopicCardTerms && <TopicCardTerms topic={topic} />}

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

          {/* Tags are the card's least-used signal, so they take what the line
              has left, at its right end, and never a row of their own: the box
              is one line high, and a tag that does not fit wraps onto a line
              that is clipped (see topic-card.css). The topic page always shows
              the full set. Plain `#name` links rather than pills, so they sit
              quietly beside the meta; each opens its archive. */}
          {tags.length > 0 && (
            <div className="topic-card__tags">
              {tags.map(tag => (
                <Link
                  className={cn([
                    'bc-whitespace-nowrap bc-text-[12px] bc-no-underline hover:bc-text-ink sm:bc-text-[13px]',
                    tag.pending ? 'bc-italic bc-text-ink-subtle' : 'bc-text-ink-muted'
                  ])}
                  key={tag.term_id}
                  title={chipTitle(tag.name, tag.pending)}
                  to={archivePath('tags', tag.slug)}
                >
                  {tagLabel(tag.name)}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Thumbnails shown on a card. More than this collapse into a count. */
const MEDIA_SHOWN = 3

/**
 * The excerpt's stand-in for a topic with no words: small thumbnails of what it
 * shows, so the card does not sit empty under its title.
 *
 * A video shows a frame from half a second in — the very first is often black
 * — and `preload="metadata"` fetches only enough to draw it, with a play mark. Nothing here takes a click: the card's link
 * opens the topic, where the video plays.
 */
function MediaStrip({ media }: { media: ReturnType<typeof contentMedia> }) {
  const shown = media.slice(0, MEDIA_SHOWN)
  const more = media.length - shown.length

  return (
    <div aria-hidden className="bc-pointer-events-none bc-mt-2 bc-flex bc-items-center bc-gap-2">
      {shown.map(({ kind, src }, index) => (
        <span
          className="bc-relative bc-h-14 bc-w-20 bc-shrink-0 bc-overflow-hidden bc-rounded-md bc-border bc-border-solid bc-border-line bc-bg-surface-sunken"
          key={`${src}-${index}`}
        >
          {kind === 'video' ? (
            <>
              <video
                className="bc-h-full bc-w-full bc-object-cover"
                muted
                playsInline
                preload="metadata"
                src={src.includes('#') ? src : `${src}#t=0.5`}
              />
              <span className="bc-absolute bc-inset-0 bc-flex bc-items-center bc-justify-center">
                <span className="bc-flex bc-h-6 bc-w-6 bc-items-center bc-justify-center bc-rounded-full bc-bg-black/60 bc-text-white">
                  <LuPlay size={12} />
                </span>
              </span>
            </>
          ) : (
            <img alt="" className="bc-h-full bc-w-full bc-object-cover" loading="lazy" src={src} />
          )}
        </span>
      ))}
      {more > 0 && <span className="bc-text-sm bc-font-medium bc-text-ink-muted">+{more}</span>}
    </div>
  )
}
