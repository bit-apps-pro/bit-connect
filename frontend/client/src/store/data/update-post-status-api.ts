import { type Topic } from '@features/topic-modal/shared/type'
import postRequest from '@utils/request/post'

interface UpdatePostStatusPayload {
  id: number
  statuses: number
}

/**
 * Update status for a post by post ID
 * @param postId - The ID of the post to update
 * @param statusIds - Array of status term IDs to set for the post
 * @returns Promise<Topic> - The updated post/topic
 */
export async function updatePostStatusApi(postId: number, statusId: number): Promise<Topic> {
  const response = await postRequest<UpdatePostStatusPayload, Topic>(`topics/${postId}`, {
    body: {
      id: postId,
      statuses: statusId
    }
  })

  return response.data
}
