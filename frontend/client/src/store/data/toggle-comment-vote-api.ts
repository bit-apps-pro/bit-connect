import postRequest from '@utils/request/post'

interface CommentVoteResponse {
  hasVoted: boolean
  votes: number
}

/**
 * Toggle vote for a comment
 * @param commentId - The ID of the comment to vote on
 * @returns Promise<CommentVoteResponse> - The updated vote data
 */
export async function toggleCommentVoteApi(commentId: number): Promise<CommentVoteResponse> {
  const response = await postRequest<Record<string, never>, CommentVoteResponse>(
    `comments/${commentId}/vote`,
    {
      body: {}
    }
  )

  return response.data
}
