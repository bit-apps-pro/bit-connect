import { toEditAttribution } from '@/types/edit-attribution'
import { type Comment } from '@/types/post'
import { type TopicComment } from '@/types/wordpress-post'

import { type SortOption } from '../single-post.type'
import orderComments from './comment-order'

function buildCommentTree(comments: Comment[], parentId = 0): Comment[] {
  const result: Comment[] = []

  for (const comment of comments) {
    if (comment.parentId === parentId) {
      const children = buildCommentTree(comments, comment.id)
      if (children.length > 0) {
        comment.replies = children
      }
      result.push(comment)
    }
  }

  return result
}

/**
 * Sorting helpers
 */
const compareDatesDesc = (a: string, b: string) => {
  const dateA = new Date(a).getTime()
  const dateB = new Date(b).getTime()

  // Handle invalid dates
  if (Number.isNaN(dateA) && Number.isNaN(dateB)) return 0
  if (Number.isNaN(dateA)) return 1 // Invalid dates go to the end
  if (Number.isNaN(dateB)) return -1

  return dateB - dateA
}

/**
 * Convert TopicComment (topic controller response) to app Comment format
 */
const topicCommentToAppComment = (topicComment: TopicComment): Comment => {
  const parentId = Number.parseInt(topicComment.comment_parent || '0', 10)
  const userId = Number.parseInt(topicComment.user_id || '0', 10)
  return {
    attachments: topicComment.attachments,
    avatar: topicComment.author_avatar || '',
    // Normalised to undefined so the app-level shape carries no null literals,
    // which the lint rules disallow. MemberBadge treats both as "no badge".
    badge: topicComment.author_badge ?? undefined,
    content: topicComment.comment_content,
    createdAt: topicComment.comment_date,
    edited: toEditAttribution(topicComment.edited),
    hasVoted: topicComment.vote.hasVoted,
    hidden: topicComment.hidden ?? false,
    id: Number.parseInt(topicComment.comment_ID, 10),
    isAdmin: topicComment.isAdmin ?? false,
    parentId: Number.isNaN(parentId) ? 0 : parentId,
    pinned: topicComment.pinned ?? false,
    replies: [],
    user: topicComment.comment_author,
    userId: Number.isNaN(userId) ? 0 : userId,
    userSlug: topicComment.author_slug || '',
    votes: topicComment.vote.total
  }
}

/**
 * Transform flat TopicComment[] to hierarchical Comment[] format
 */
export const transformTopicCommentsToComments = (topicComments: TopicComment[]): Comment[] => {
  const flatComments = topicComments.map(topicCommentToAppComment)
  return buildCommentTree(flatComments)
}

/**
 * Lift the pinned reply to the front, whatever the sort said.
 *
 * The twin of the hoist CommentController does server-side, and it has to
 * exist on both sides: the topic page builds its thread from the topic payload
 * and sorts it here, while paginating hits the comments endpoint and gets the
 * order from there. One without the other means the pinned reply jumps as soon
 * as the reader scrolls.
 *
 * Moves rather than copies, so the thread still appears exactly once, and
 * leaves the array alone when the pin is already first or there is no pin —
 * which is every topic on a forum without the add-on.
 */
const hoistPinned = (comments: Comment[]): Comment[] => {
  const index = comments.findIndex(comment => comment.pinned)
  if (index <= 0) return comments

  const pinned = comments[index]!
  return [pinned, ...comments.slice(0, index), ...comments.slice(index + 1)]
}

/**
 * Sort hierarchical comments (only top-level, preserving replies).
 *
 * Two orderings are performed here. Any other value is handed to the
 * comment-order extension point; when nothing there claims it either, the
 * thread falls back to newest-first rather than to an unspecified order.
 * Whichever ordering wins, a pinned reply is then lifted to the front.
 */
export const sortHierarchicalComments = (comments: Comment[], sortOption: SortOption): Comment[] => {
  const sorted = [...comments]

  if (sortOption === 'newest') {
    sorted.sort((a, b) => compareDatesDesc(a.createdAt || '', b.createdAt || ''))
  } else if (sortOption === 'all') {
    // For 'all', sort by oldest first (ascending date order)
    sorted.sort((a, b) => {
      const dateA = new Date(a.createdAt || '').getTime()
      const dateB = new Date(b.createdAt || '').getTime()

      if (Number.isNaN(dateA) && Number.isNaN(dateB)) return 0
      if (Number.isNaN(dateA)) return 1
      if (Number.isNaN(dateB)) return -1

      return dateA - dateB
    })
  } else {
    const ordered = orderComments(sorted, sortOption)
    if (ordered) return hoistPinned(ordered)

    sorted.sort((a, b) => compareDatesDesc(a.createdAt || '', b.createdAt || ''))
  }

  return hoistPinned(sorted)
}
