import postRequest from '@utils/request/post'

interface VoteResponse {
  hasVoted: boolean
  votes: number
}

/**
 * Toggle vote for a post
 * @param postId - The ID of the post to vote on
 * @returns Promise<VoteResponse> - The updated vote data
 */
export async function toggleVoteApi(postId: number): Promise<VoteResponse> {
  const response = await postRequest<Record<string, never>, VoteResponse>(`posts/${postId}/vote`, {
    body: {}
  })

  return response.data
}
