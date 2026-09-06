import { toEditAttribution } from '@/types/edit-attribution'
import { type Comment } from '@/types/post'
import { type TopicComment } from '@/types/wordpress-post'

import { type SortOption } from '../single-post.type'

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
 * Sort hierarchical comments (only top-level, preserving replies)
 */
export const sortHierarchicalComments = (comments: Comment[], sortOption: SortOption): Comment[] => {
  const sorted = [...comments]

  if (sortOption === 'newest') {
    sorted.sort((a, b) => compareDatesDesc(a.createdAt || '', b.createdAt || ''))
  } else if (sortOption === 'mostVoted') {
    sorted.sort((a, b) => {
      const votesA = a.votes ?? 0
      const votesB = b.votes ?? 0
      if (votesB !== votesA) return votesB - votesA
      return compareDatesDesc(a.createdAt || '', b.createdAt || '')
    })
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
  }

  return sorted
}
