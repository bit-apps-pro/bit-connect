import { type Topic } from '@features/topic-modal/shared/type'
import postRequest from '@utils/request/post'

interface UpdatePostStagePayload {
  id: number
  stages: number[]
}

/**
 * Update stage for a post by post ID
 * @param postId - The ID of the post to update
 * @param stageTermId - Stage term ID to set for the post
 * @returns Promise<Topic> - The updated post/topic
 */
export async function updatePostStageApi(postId: number, stageTermId: number): Promise<Topic> {
  const response = await postRequest<UpdatePostStagePayload, Topic>(`topics/${postId}`, {
    body: {
      id: postId,
      stages: [stageTermId]
    }
  })

  return response.data
}
