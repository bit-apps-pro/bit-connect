import { type Topic } from '@features/topic-modal/shared/type'

import { type Comment } from '@/types/post'
import { type TopicComment } from '@/types/wordpress-post'

import { type Vote } from './helper/vote-flip'

/**
 * How a thread is ordered.
 *
 * `all` and `newest` are the two orderings this plugin performs. The union
 * stays open because the sort control's choices are an extension point
 * (use-comment-sort-options): another plugin may offer an ordering of its own
 * and perform it through comment-order. This plugin's sorter treats anything
 * it does not recognise as newest-first.
 */
export type SortOption = 'all' | 'newest' | (string & {})

export interface SinglePostStore {
  comments: TopicComment[]
  commentsHasMore: boolean
  commentsPage: number
  commentsTotalPages: number
  createComment: (content: string, parentId?: number, attachmentIds?: number[]) => Promise<void>
  deleteComment: (commentId: number) => Promise<void>
  deletePost: (postId: number) => Promise<void>
  error: string | undefined
  fetchComments: (postId: number) => Promise<void>
  /**
   * Pull in the page holding a linked-to comment, if it is not already loaded.
   * Resolves to true once the comment is in the list.
   */
  fetchCommentThread: (commentId: number) => Promise<boolean>
  fetchMoreComments: () => Promise<void>
  fetchPostByName: (postName: string) => Promise<void>
  isDeleting: boolean
  isLoading: boolean
  isLoadingComments: boolean
  isLoadingMoreComments: boolean
  isSubmitting: boolean
  isVoting: boolean
  post: Topic | undefined
  setCommentVote: (commentId: number, vote: Vote) => void
  setError: (error: string | undefined) => void
  setLoading: (isLoading: boolean) => void
  setPost: (post: Topic) => void
  setSortOption: (sortOption: SortOption) => void
  sortOption: SortOption
  toggleVote: (postId: number) => Promise<void>
  transformedComments: Comment[]
  updateComment: (commentId: number, content: string, attachmentIds?: number[]) => Promise<void>
}
