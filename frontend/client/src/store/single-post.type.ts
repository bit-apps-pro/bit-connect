import { type Topic } from '@features/topic-modal/shared/type'

import { type Comment } from '@/types/post'
import { type TopicComment } from '@/types/wordpress-post'

export type SortOption = 'all' | 'mostVoted' | 'newest'

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
  setError: (error: string | undefined) => void
  setLoading: (isLoading: boolean) => void
  /**
   * Move the topic's pin to this comment, or clear it with `undefined`/0.
   *
   * Local only — it records a change the server has already accepted, it does
   * not ask for one. Nothing in the free plugin calls it; see the note on the
   * implementation.
   */
  setPinnedComment: (commentId: number | undefined) => void
  setPost: (post: Topic) => void
  setSortOption: (sortOption: SortOption) => void
  sortOption: SortOption
  toggleCommentVote: (commentId: number) => Promise<void>
  toggleVote: (postId: number) => Promise<void>
  transformedComments: Comment[]
  updateComment: (commentId: number, content: string, attachmentIds?: number[]) => Promise<void>
}
