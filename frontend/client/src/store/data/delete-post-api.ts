import getRequest from '@utils/request/get'

/**
 * Delete a post/topic by its ID
 * @param postId - The ID of the post to delete
 * @returns Promise<void>
 */
export async function deletePostApi(postId: number): Promise<void> {
  await getRequest(`topics-delete/${postId}`)
}
