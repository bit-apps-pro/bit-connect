import getRequest from '@utils/request/get'

interface DeleteCommentResponse {
  id: number
}

/**
 * Delete a comment by its ID via custom Bit-Connect API
 * @param commentId - The ID of the comment to delete
 * @returns The deleted comment ID
 */
export async function deleteCommentApi(commentId: number): Promise<DeleteCommentResponse> {
  const response = await getRequest<DeleteCommentResponse>(`comments-delete/${commentId}`)

  return response.data
}
