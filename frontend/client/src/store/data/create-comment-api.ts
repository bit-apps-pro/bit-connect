import queryRequest from '@common/helpers/request'

import { type EditAttributionResponse } from '@/types/edit-attribution'
import { type MemberBadge } from '@/types/member-badge'
import { type TopicComment } from '@/types/wordpress-post'

interface CommentCreatePayload {
  attachments?: number[]
  content: string
  parent_id?: number
}

export interface CommentResponse {
  attachments?: {
    filename: string
    filesize: number
    id: number
    type: string
    url: string
  }[]
  author: number
  author_avatar_urls: {
    '24': string
    '48': string
    '96': string
  }
  /** The author's standing, or null when they are an ordinary member. */
  author_badge?: MemberBadge | null
  author_name: string
  author_slug?: string
  author_url: string
  content: {
    rendered: string
  }
  date: string
  date_gmt: string
  /** Who last edited this comment, or null when nobody has. */
  edited?: EditAttributionResponse | null
  hasVoted?: boolean
  hidden?: boolean
  id: number
  link: string
  parent: number
  post: number
  status: number | string
  type: string
  votes?: number
}

export const commentResponseToTopicComment = (comment: CommentResponse): TopicComment => {
  const status = String(comment.status)
  return {
    attachments: comment.attachments ?? [],
    // The server resolves this through AvatarService, so it is the member's
    // uploaded picture when they have one and their Gravatar otherwise. Dropping
    // it here left every comment in the thread showing an initial instead of the
    // face the same person shows everywhere else on the page. 96px: the largest
    // offered, so the 36px avatar stays sharp on a retina screen.
    author_avatar:
      comment.author_avatar_urls?.['96'] ||
      comment.author_avatar_urls?.['48'] ||
      comment.author_avatar_urls?.['24'] ||
      '',
    author_badge: comment.author_badge,
    author_slug: comment.author_slug ?? '',
    // eslint-disable-next-line unicorn/no-null
    children: null,
    comment_approved: status === 'approved' || status === '1' ? '1' : '0',
    comment_author: comment.author_name,
    comment_author_url: comment.author_url,
    comment_content: comment.content.rendered,
    comment_date: comment.date,
    comment_date_gmt: comment.date_gmt,
    comment_ID: comment.id.toString(),
    comment_karma: '0',
    comment_parent: comment.parent.toString(),
    comment_post_ID: comment.post.toString(),
    comment_type: comment.type,
    edited: comment.edited,
    hidden: comment.hidden,
    populated_children: false,
    post_fields: [],
    user_id: comment.author.toString(),
    vote: {
      hasVoted: comment.hasVoted ?? false,
      total: comment.votes ?? 0
    }
  }
}

export async function createCommentApi(
  content: string,
  postId: number,
  parentId?: number,
  attachmentIds?: number[]
): Promise<TopicComment> {
  const payload: CommentCreatePayload = { content }

  if (parentId) {
    payload.parent_id = parentId
  }

  if (attachmentIds && attachmentIds.length > 0) {
    payload.attachments = attachmentIds
  }

  const response = await queryRequest<CommentResponse>(`posts/${postId}/comments`, payload)

  return commentResponseToTopicComment(response.data)
}
