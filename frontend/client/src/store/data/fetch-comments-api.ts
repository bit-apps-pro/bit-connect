import getRequest from '@utils/request/get'

import { type TopicComment } from '@/types/wordpress-post'

import { type SortOption } from '../single-post.type'
import { type CommentResponse, commentResponseToTopicComment } from './create-comment-api'

export interface CommentsPagination {
  current_page: number
  per_page: number
  total: number
  total_pages: number
}

interface CommentsResponseData {
  data: CommentResponse[]
  pagination: CommentsPagination
}

export interface CommentsPage {
  comments: TopicComment[]
  pagination: CommentsPagination
}

export interface FetchCommentsParams {
  /**
   * A comment to land on, for a `#comment-N` link. The server answers with
   * whichever page holds it and says so in `pagination.current_page`, which is
   * the only way to know: pages are reachable in sequence from the first, and
   * which one a comment falls on depends on the sort and on how many threads
   * precede it.
   */
  focus?: number
  page?: number
  perPage?: number
  sort?: SortOption
}

/**
 * Fetch a single page of a post's top-level comment threads. Each thread's
 * descendants are returned alongside it, so the page can be nested into a tree.
 */
export async function fetchCommentsApi(
  postId: number,
  { focus, page = 1, perPage = 10, sort = 'newest' }: FetchCommentsParams = {}
): Promise<CommentsPage> {
  const response = await getRequest<CommentsResponseData>(`posts/${postId}/comments`, {
    queryParam: focus ? { focus, per_page: perPage, sort } : { page, per_page: perPage, sort }
  })

  const { data, pagination } = response.data
  const comments = Array.isArray(data) ? data.map(commentResponseToTopicComment) : []

  return {
    comments,
    pagination: pagination ?? {
      current_page: 1,
      per_page: comments.length,
      total: comments.length,
      total_pages: 1
    }
  }
}
