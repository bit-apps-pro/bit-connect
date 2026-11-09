import postRequest from '@utils/request/post'

interface DeleteCommentResponse {
  id: number
}

/**
 * Delete a comment by its ID via custom Bit-Connect API
 * @param commentId - The ID of the comment to delete
 * @returns The deleted comment ID
 */
export async function deleteCommentApi(commentId: number): Promise<DeleteCommentResponse> {
  // POST, never GET: a link preview or a prefetch must not be able to delete.
  const response = await postRequest<never, DeleteCommentResponse>(`comments-delete/${commentId}`)

  return response.data
}
