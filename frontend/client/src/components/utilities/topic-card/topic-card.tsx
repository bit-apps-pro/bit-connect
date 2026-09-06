import { __ } from '@common/helpers/i18nWrap'
import { type Topic } from '@features/topic-modal/shared/type'
import VoteBox from '@pages/Post/ui/voteBox/VoteBox'
import UserLink from '@utilities/user-link'
import { Flex, Tag, Typography } from 'antd'
import { LuClock, LuMessageCircle } from 'react-icons/lu'
import { Link } from 'react-router'

import { useAdminSettingsStore } from '@/store/admin-settings.zustand'
import useChipProps from '@/utils/use-chip-props'
import { relativeTime } from '@/utils/utils'

import './topic-card.css'

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
const ENTITIES: Record<string, string> = {
  '&#039;': "'",
  '&amp;': '&',
  '&gt;': '>',
  '&lt;': '<',
  '&nbsp;': ' ',
  '&quot;': '"'
}

const excerptOf = (html: string) => {
  const text = html
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/&(?:#039|amp|gt|lt|nbsp|quot);/g, entity => ENTITIES[entity] ?? entity)
    .replaceAll(/\s+/g, ' ')
    .trim()

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

  const formattedDate = relativeTime(postDateGmt)
  const { settings } = useAdminSettingsStore()
  const canComment = settings.topicAccess.comment
  const { chipTagProps } = useChipProps()

  const handlePostVote = async () => {
    await onVote(postId)
  }

  return (
    <div className="topic-card bc-relative bc-flex bc-max-w-full bc-gap-3 bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-line bc-p-3 bc-transition-all lg:bc-gap-4 lg:bc-p-4">
      {/* Above the card link overlay so voting never navigates. */}
      <div className="bc-relative bc-z-10">
        <VoteBox isVote={hasVoted} onVote={handlePostVote} votes={total} />
      </div>

      <div className="bc-flex bc-min-w-0 bc-max-w-full bc-flex-1 bc-flex-col">
        {/* The link stretches over the whole card (see topic-card.css), so the
            target is the card rather than the title text alone. */}
        <Link className="topic-card__link" to={`/${topic.post_name}`}>
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

            {topicTypes && (
              <Tag className="bc-m-0 bc-shrink-0 md:bc-hidden" {...chipTagProps(topicTypes.meta.color)}>
                {topicTypes.name}
              </Tag>
            )}

            {statuses && (
              <Tag
                className="bc-m-0 bc-hidden bc-shrink-0 md:bc-inline-block"
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
            {/* The icon is decoration next to a self-explanatory "2mo ago"; at
                320px its 26px was the difference between the meta fitting on
                two lines and spilling onto three. */}
            <LuClock className="bc-hidden sm:bc-block" size={18} />
            <span className="bc-whitespace-nowrap">{formattedDate}</span>
          </Flex>

          {canComment && (
            <Flex
              align="center"
              aria-label={`${commentsCount} ${__('comments')}`}
              className="bc-text-sm bc-text-ink-muted"
              gap="small"
            >
              <LuMessageCircle size={18} />
              <span>{commentsCount}</span>
            </Flex>
          )}

          {/* From md only: below that the type is the chip beside the title. */}
          {topicTypes && (
            <Tag
              className="bc-m-0 bc-hidden bc-shrink-0 md:bc-inline-block"
              {...chipTagProps(topicTypes.meta.color)}
            >
              {topicTypes.name}
            </Tag>
          )}

          {/* Tags are the card's least-used signal and the first thing to wrap:
              on a phone they took a second row of their own on some cards and
              not others, so no two rows read alike. They return from md, where
              the meta line has room for them. The topic page always shows the
              full set. */}
          {tags.length > 0 && (
            <div className="bc-hidden bc-min-w-0 bc-flex-wrap bc-gap-x-2 bc-gap-y-1 md:bc-flex">
              {tags.map(tag => (
                <Typography.Text key={tag.term_id} type="secondary">
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
