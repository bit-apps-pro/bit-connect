import { __ } from '@common/helpers/i18nWrap'
import { type WPAttachmentData } from '@features/file-uploader/state/use-file-store'
import getScrollParent from '@utils/get-scroll-parent'
import { useEffect, useRef, useState } from 'react'

import { type Comment } from '@/types/post'

import CommentItem from './CommentItem'
import styles from './CommentThread.module.css'

interface CommentListProps {
  comments: Comment[]
  /** The comment a `#comment-N` link asked for, if the page was opened with one. */
  focusedCommentId?: number
  hasMore?: boolean
  isLoadingMore?: boolean
  onDelete?: (commentId: number) => void
  onEdit?: (commentId: number, content: string, attachments?: WPAttachmentData[]) => void
  onLoadMore?: () => void
  onReply?: (commentId: number, content: string, attachments?: WPAttachmentData[]) => void
  onVote?: (commentId: number) => void
  sortOption: 'all' | 'mostVoted' | 'newest'
  topicSlug: string
  topicTitle: string
}

export default function CommentList({
  comments,
  focusedCommentId,
  hasMore = false,
  isLoadingMore = false,
  onDelete,
  onEdit,
  onLoadMore,
  onReply,
  onVote,
  sortOption,
  topicSlug,
  topicTitle
}: CommentListProps) {
  const topLevelComments = comments.filter(comment => !comment.parentId || comment.parentId === 0)

  // The "all caught up" note is only meaningful after the user has actually
  // paginated — a list that fits in the first page never shows it.
  const [hasPaginated, setHasPaginated] = useState(false)
  useEffect(() => {
    setHasPaginated(false)
  }, [sortOption])

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  // The list lives inside a scrollable layout container, so observe relative to
  // the nearest scrollable ancestor rather than the viewport.
  const sentinelRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          // fetchMoreComments guards against concurrent calls internally.
          setHasPaginated(true)
          onLoadMore?.()
        }
      },
      { root: getScrollParent(node), rootMargin: '300px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore])

  return (
    <div>
      {/* The sort control renders beside the "Comments" heading (see
          PostDetailsPage) — `sortOption` is still needed here to reset the
          pagination note when the sort changes. */}
      <ul className={styles.commentList}>
        {topLevelComments.map(comment => (
          <li className={styles.commentListItem} key={comment.id}>
            <CommentItem
              comment={comment}
              depth={0}
              focusedCommentId={focusedCommentId}
              onDelete={onDelete}
              onEdit={onEdit}
              onReply={onReply}
              onVote={onVote}
              topicSlug={topicSlug}
              topicTitle={topicTitle}
            />
          </li>
        ))}

        {/* Sentinel: observed to load the next page of comments */}
        {hasMore && <li aria-hidden="true" className="bc-h-px" ref={sentinelRef} />}
      </ul>

      {isLoadingMore && (
        <div className="bc-flex bc-items-center bc-justify-center bc-p-4">
          <span>{__('Loading more...')}</span>
        </div>
      )}

      {hasPaginated && !hasMore && !isLoadingMore && topLevelComments.length > 0 && (
        <div className="bc-flex bc-items-center bc-justify-center bc-p-4 bc-text-ink-subtle bc-text-sm">
          <span>{__("🎉 You're all caught up — no more comments")}</span>
        </div>
      )}
    </div>
  )
}
