import postRequest from '@utils/request/post'

/**
 * Delete a post/topic by its ID
 * @param postId - The ID of the post to delete
 * @returns Promise<void>
 */
export async function deletePostApi(postId: number): Promise<void> {
  // POST, never GET: a link preview or a prefetch must not be able to delete.
  await postRequest(`topics-delete/${postId}`)
}
