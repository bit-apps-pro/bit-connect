import { type Topic } from '@features/topic-modal/shared/type'
import postRequest from '@utils/request/post'

interface UpdatePostLockPayload {
  is_locked: boolean
}

/**
 * Close a topic to new comments, or open it again.
 *
 * Its comments stay readable either way, and moderators can still reply in a
 * locked topic — TopicController refuses the change to anyone without the
 * lock capability.
 */
export async function updatePostLockApi(postId: number, isLocked: boolean): Promise<Topic> {
  const response = await postRequest<UpdatePostLockPayload, Topic>(`topics/${postId}`, {
    body: { is_locked: isLocked }
  })

  return response.data
}
