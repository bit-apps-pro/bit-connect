import { __ } from '@common/helpers/i18nWrap'
import { type Topic } from '@features/topic-modal/shared/type'
import { Tag } from 'antd'
import { LuArrowBigUp, LuMessageCircle, LuMessageSquare, LuSquarePen } from 'react-icons/lu'
import { Link } from 'react-router'

import useChipProps from '@/utils/use-chip-props'
import { relativeTime } from '@/utils/utils'

import { type FeedEntry, type UserComment } from '../data/use-user-content'

/** Strip stored HTML down to a one-line preview. */
const plainText = (html: string) =>
  html
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()

function Kind({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <span className="bc-flex bc-min-w-0 bc-items-center bc-gap-1.5 bc-text-[12px] bc-text-ink-subtle">
      <span aria-hidden="true" className="bc-flex bc-shrink-0">
        {icon}
      </span>
      {children}
    </span>
  )
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <div className="bc-mt-1.5 bc-flex bc-flex-wrap bc-items-center bc-gap-3 bc-text-[11px] bc-text-ink-subtle">
      {children}
    </div>
  )
}

function TopicEntry({ occurredAt, topic }: { occurredAt: string; topic: Topic }) {
  const topicType = topic.terms?.topic_types
  const { chipTagProps } = useChipProps()

  return (
    <>
      <Kind icon={<LuSquarePen size={13} />}>{__('posted a topic')}</Kind>

      <Link
        className="bc-mt-1 bc-block bc-text-[15px] bc-font-semibold bc-leading-snug bc-text-ink bc-no-underline hover:bc-text-primary"
        to={`/${topic.post_name}`}
      >
        {topic.post_title}
      </Link>

      <Meta>
        <span className="bc-flex bc-items-center bc-gap-1">
          <LuArrowBigUp size={13} />
          {topic.vote?.total ?? 0}
        </span>
        <span className="bc-flex bc-items-center bc-gap-1">
          <LuMessageCircle size={12} />
          {topic.comments_count ?? 0}
        </span>
        <span>{relativeTime(occurredAt)}</span>
        {topicType && (
          <Tag
            className="bc-m-0 bc-px-2 bc-py-0 bc-text-[10px] bc-leading-[18px]"
            {...chipTagProps(topicType.meta?.color)}
          >
            {topicType.name}
          </Tag>
        )}
      </Meta>
    </>
  )
}

function CommentEntry({ comment, occurredAt }: { comment: UserComment; occurredAt: string }) {
  return (
    <>
      <Kind icon={<LuMessageSquare size={13} />}>
        <span className="bc-shrink-0">{__('commented on')}</span>
        <Link
          className="bc-truncate bc-font-medium bc-text-primary bc-no-underline hover:bc-underline"
          to={`/${comment.post_name}`}
        >
          {comment.post_title}
        </Link>
      </Kind>

      {/* Plain text rather than rendered HTML: the feed is a scannable list, and
          a comment's headings, images and quotes would break the rhythm. */}
      <Link
        className="bc-mt-1 bc-line-clamp-2 bc-block bc-text-[14px] bc-leading-[1.45] bc-text-ink bc-no-underline"
        to={`/${comment.post_name}`}
      >
        {plainText(comment.comment_content)}
      </Link>

      <Meta>
        <span className="bc-flex bc-items-center bc-gap-1">
          <LuArrowBigUp size={13} />
          {comment.vote?.total ?? 0}
        </span>
        <span>{relativeTime(occurredAt)}</span>
      </Meta>
    </>
  )
}

/**
 * One entry in the merged overview feed.
 *
 * Topics and comments share a row shape — a kind line, the content, then a
 * meta line — so a mixed timeline scans as one list instead of two interleaved
 * designs.
 */
export default function FeedRow({ entry }: { entry: FeedEntry }) {
  return (
    <article className="bc-border-0 bc-border-b bc-border-solid bc-border-line bc-px-4 bc-py-3 last:bc-border-b-0 hover:bc-bg-surface-sunken">
      {entry.kind === 'topic' ? (
        <TopicEntry occurredAt={entry.occurred_at} topic={entry.topic} />
      ) : (
        <CommentEntry comment={entry.comment} occurredAt={entry.occurred_at} />
      )}
    </article>
  )
}
