import queryRequest from '@common/helpers/request'

import { type TopicComment } from '@/types/wordpress-post'

import { type CommentResponse, commentResponseToTopicComment } from './create-comment-api'

interface CommentUpdatePayload {
  attachments?: number[]
  content: string
}

export async function updateCommentApi(
  commentId: number,
  content: string,
  attachmentIds?: number[]
): Promise<TopicComment> {
  const payload: CommentUpdatePayload = { content }

  if (attachmentIds) {
    payload.attachments = attachmentIds
  }

  const response = await queryRequest<CommentResponse>(`comments/${commentId}`, payload)

  return commentResponseToTopicComment(response.data)
}
