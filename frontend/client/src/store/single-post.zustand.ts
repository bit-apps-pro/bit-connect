import { create } from 'zustand'

import { type TopicComment } from '@/types/wordpress-post'

import { createCommentApi } from './data/create-comment-api'
import { deleteCommentApi } from './data/delete-comment-api'
import { deletePostApi } from './data/delete-post-api'
import { fetchCommentsApi } from './data/fetch-comments-api'
import { fetchPostByNameApi } from './data/fetch-post-api'
import { toggleCommentVoteApi } from './data/toggle-comment-vote-api'
import { toggleVoteApi } from './data/toggle-vote-api'
import { updateCommentApi } from './data/update-comment-api'
import { sortHierarchicalComments, transformTopicCommentsToComments } from './helper/post-commons'
import { syncTopicVote } from './helper/topic-vote-sync'
import { syncVotesReceived } from './helper/user-stats-sync'
import { flipVote, type Vote } from './helper/vote-flip'
import { type SinglePostStore } from './single-post.type'

const defaultVoteState = {
  hasVoted: false,
  total: 0
}

const COMMENTS_PER_PAGE = 10

// Monotonic token shared by every comment fetch (initial load, sort change,
// infinite-scroll append). Each fetch stamps itself before awaiting; if a newer
// fetch has started by the time the response lands, the stale one is discarded.
// This prevents a slow response for post A / an old sort from clobbering the
// list the user is now looking at.
let commentsRequestSeq = 0

// Same guard for the topic itself: navigating A -> B -> C fires three fetches
// and whichever lands last would otherwise win, leaving the page parked on an
// older topic under the current URL.
let postRequestSeq = 0

export const useSinglePostStore = create<SinglePostStore>((set, get) => ({
  comments: [],
  commentsHasMore: false,
  commentsPage: 1,
  commentsTotalPages: 1,
  createComment: async (content: string, parentId?: number, attachmentIds?: number[]) => {
    const currentPost = get().post

    if (!currentPost?.ID) {
      const errorMessage = 'Post ID is required'
      set({ error: errorMessage })
      throw new Error(errorMessage)
    }

    set({ error: undefined, isSubmitting: true })

    try {
      const newComment = await createCommentApi(content, currentPost.ID, parentId, attachmentIds)
      newComment.vote = { ...defaultVoteState }
      const existingComments = get().comments
      const updatedComments = [...existingComments, newComment]

      set(state => ({
        comments: updatedComments,
        isSubmitting: false,
        transformedComments: sortHierarchicalComments(
          transformTopicCommentsToComments(updatedComments),
          state.sortOption
        )
      }))
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to create comment'
      set({ error: errorMessage, isSubmitting: false })
      throw error
    }
  },
  deleteComment: async (commentId: number) => {
    set({ error: undefined, isSubmitting: true })

    try {
      await deleteCommentApi(commentId)

      // Remove the comment and any of its children from the flat comments array
      const commentIdStr = commentId.toString()

      // Collect all descendant IDs to remove (children, grandchildren, etc.)
      const getDescendantIds = (comments: TopicComment[], parentId: string): Set<string> => {
        const ids = new Set<string>()
        for (const comment of comments) {
          if (comment.comment_parent === parentId) {
            ids.add(comment.comment_ID)
            for (const childId of getDescendantIds(comments, comment.comment_ID)) {
              ids.add(childId)
            }
          }
        }
        return ids
      }

      const currentComments = get().comments
      const descendantIds = getDescendantIds(currentComments, commentIdStr)
      descendantIds.add(commentIdStr)

      const updatedComments = currentComments.filter(comment => !descendantIds.has(comment.comment_ID))

      set(state => ({
        comments: updatedComments,
        isSubmitting: false,
        transformedComments: sortHierarchicalComments(
          transformTopicCommentsToComments(updatedComments),
          state.sortOption
        )
      }))
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to delete comment'
      set({ error: errorMessage, isSubmitting: false })
      throw error
    }
  },
  deletePost: async (postId: number) => {
    set({ error: undefined, isDeleting: true })

    try {
      await deletePostApi(postId)
      set({ isDeleting: false, post: undefined })
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to delete post'
      set({ error: errorMessage, isDeleting: false })
      throw error
    }
  },
  error: undefined,
  // Load the first page of comment threads, replacing the list. Server sorts
  // and paginates by the current sort option; children travel with their
  // top-level parent so each page is a set of complete threads.
  fetchComments: async (postId: number) => {
    const requestId = ++commentsRequestSeq
    set({ isLoadingComments: true })

    try {
      const { comments, pagination } = await fetchCommentsApi(postId, {
        page: 1,
        perPage: COMMENTS_PER_PAGE,
        sort: get().sortOption
      })

      // A newer fetch (post change, sort change, or append) started while this
      // request was in flight — discard this stale response.
      if (requestId !== commentsRequestSeq) return

      set(state => ({
        comments,
        commentsHasMore: pagination.current_page < pagination.total_pages,
        commentsPage: pagination.current_page,
        commentsTotalPages: pagination.total_pages,
        isLoadingComments: false,
        transformedComments: sortHierarchicalComments(
          transformTopicCommentsToComments(comments),
          state.sortOption
        )
      }))
    } catch {
      if (requestId !== commentsRequestSeq) return
      // Silently fail — comment list stays empty, post content is still visible
      set({ isLoadingComments: false })
    }
  },

  // Bring in the thread holding a linked-to comment.
  //
  // A `#comment-N` link has to work on a topic with three hundred replies, where
  // the target sits on a page infinite scroll would only reach after the reader
  // scrolled past everything before it. The server resolves which page that is
  // (see the `focus` param) and this merges that one page into whatever is
  // already loaded.
  //
  // The sequential cursor is deliberately left where it was: `commentsPage`
  // tracks how far the *scroll* has read, and moving it to the focused page
  // would make infinite scroll resume from there, silently skipping every page
  // in between. Re-fetching a page already merged this way is harmless — the
  // append below drops duplicates.
  fetchCommentThread: async (commentId: number) => {
    const { comments, post, sortOption } = get()
    const wanted = commentId.toString()

    if (comments.some(comment => comment.comment_ID === wanted)) return true
    if (!post?.ID) return false

    // Deliberately does NOT take a new request id. The token exists so a newer
    // fetch can discard an older one, and claiming it here would throw away the
    // page-1 load this is running alongside. Reading it instead means a topic or
    // sort change lands first and this merge stands down.
    const requestId = commentsRequestSeq

    try {
      const { comments: page } = await fetchCommentsApi(post.ID, {
        focus: commentId,
        perPage: COMMENTS_PER_PAGE,
        sort: sortOption
      })

      // The topic or the sort changed under us; these threads belong to a list
      // that is no longer on screen.
      if (requestId !== commentsRequestSeq) return false

      let landed = false

      set(state => {
        const existingIds = new Set(state.comments.map(comment => comment.comment_ID))
        const merged = [...state.comments, ...page.filter(item => !existingIds.has(item.comment_ID))]

        landed = merged.some(comment => comment.comment_ID === wanted)

        return {
          comments: merged,
          transformedComments: sortHierarchicalComments(
            transformTopicCommentsToComments(merged),
            state.sortOption
          )
        }
      })

      return landed
    } catch {
      // Nothing to put right: the topic and the comments already loaded are
      // still on screen, and the link simply does not reach its target.
      return false
    }
  },

  // Load the next page of comment threads and append it (infinite scroll).
  // Guards against concurrent calls and stops once the last page is loaded.
  fetchMoreComments: async () => {
    const { commentsHasMore, commentsPage, isLoadingMoreComments, post, sortOption } = get()
    if (!commentsHasMore || isLoadingMoreComments || !post?.ID) return

    const requestId = ++commentsRequestSeq
    set({ isLoadingMoreComments: true })

    try {
      const { comments, pagination } = await fetchCommentsApi(post.ID, {
        page: commentsPage + 1,
        perPage: COMMENTS_PER_PAGE,
        sort: sortOption
      })

      // Post or sort changed mid-flight (a page-1 reload superseded us) — discard.
      if (requestId !== commentsRequestSeq) return

      set(state => {
        // Append only threads we don't already have (defensive against overlap).
        const existingIds = new Set(state.comments.map(comment => comment.comment_ID))
        const merged = [
          ...state.comments,
          ...comments.filter(comment => !existingIds.has(comment.comment_ID))
        ]

        return {
          comments: merged,
          commentsHasMore: pagination.current_page < pagination.total_pages,
          commentsPage: pagination.current_page,
          commentsTotalPages: pagination.total_pages,
          isLoadingMoreComments: false,
          transformedComments: sortHierarchicalComments(
            transformTopicCommentsToComments(merged),
            state.sortOption
          )
        }
      })
    } catch {
      if (requestId !== commentsRequestSeq) return
      set({ isLoadingMoreComments: false })
    }
  },
  fetchPostByName: async (postName: string) => {
    const requestId = ++postRequestSeq

    // Clear the previous topic and its comments *before* awaiting. This store is
    // a module singleton that outlives the route, and the page renders straight
    // off `post` — leaving the old one in place paints the previous topic under
    // the new URL until this request lands.
    set({
      comments: [],
      commentsHasMore: false,
      commentsPage: 1,
      commentsTotalPages: 1,
      error: undefined,
      isLoading: true,
      post: undefined,
      transformedComments: []
    })

    try {
      const topic = await fetchPostByNameApi(postName)

      // A newer navigation superseded us — discard this response.
      if (requestId !== postRequestSeq) return

      set({ isLoading: false, post: topic })

      // Comments are not embedded in the topic payload; load page 1 separately.
      await get().fetchComments(topic.ID)
    } catch (error) {
      if (requestId !== postRequestSeq) return
      const errorMessage = (error as Error).message || 'Failed to fetch post'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },
  isDeleting: false,
  isLoading: false,
  isLoadingComments: false,
  isLoadingMoreComments: false,
  isSubmitting: false,
  isVoting: false,
  post: undefined,
  setError: error => set({ error }),
  setLoading: isLoading => set({ isLoading }),
  setPost: post => set({ post }),
  // Changing the sort changes which threads belong on each page. Apply the new
  // sort locally first (so the already-loaded comments reorder immediately),
  // then re-fetch page 1 from the server with that sort.
  setSortOption: sortOption => {
    // Reset pagination synchronously so the infinite-scroll sentinel can't fire
    // with stale page/hasMore state before the re-fetch below completes.
    set(state => ({
      commentsHasMore: false,
      commentsPage: 1,
      sortOption,
      transformedComments: sortHierarchicalComments(
        transformTopicCommentsToComments(state.comments),
        sortOption
      )
    }))

    const postId = get().post?.ID
    if (postId) {
      get()
        .fetchComments(postId)
        .catch(() => {
          // Silent — handled like the initial comment load.
        })
    }
  },
  sortOption: 'newest',
  toggleCommentVote: async (commentId: number) => {
    const id = commentId.toString()

    // The rendered tree is derived from the raw comments, so both are rebuilt
    // together — the button reads from the derived copy.
    const show = (vote: Vote) => {
      set(state => {
        const comments = state.comments.map(comment =>
          comment.comment_ID === id ? { ...comment, vote } : comment
        )

        return {
          comments,
          transformedComments: sortHierarchicalComments(
            transformTopicCommentsToComments(comments),
            state.sortOption
          )
        }
      })
    }

    const comment = get().comments.find(item => item.comment_ID === id)
    const before = comment?.vote

    set({ isVoting: true })
    // Straight away, so the count answers the click rather than the round trip.
    if (before) show(flipVote(before))

    try {
      // Call custom API to toggle vote (uses bit-connect API)
      const response = await toggleCommentVoteApi(commentId)

      show({ hasVoted: response.hasVoted, total: response.votes })
      set({ isVoting: false })

      // Sidebar and profile card both show the author's upvote total, and a
      // vote on their comment counts towards it.
      if (comment?.user_id) syncVotesReceived(comment.user_id, response.hasVoted)
    } catch (error) {
      // Put back what the button showed before the click: the vote did not land,
      // and a count that stayed moved would claim otherwise.
      if (before) show(before)

      const errorMessage = (error as Error).message || 'Failed to vote on comment'
      set({ error: errorMessage, isVoting: false })
      throw error
    }
  },
  toggleVote: async (postId: number) => {
    // Guarded rather than assumed: a vote for another topic can still be in
    // flight when the reader opens this one, and it must not write its result
    // over the post now on screen.
    const votedPost = get().post?.ID === postId ? get().post : undefined

    // A profile listing this topic keeps its own cached copy; move it too, so
    // returning to that tab doesn't show the vote as it was before.
    const show = (vote: Vote) => {
      set(state => (state.post?.ID === postId ? { post: { ...state.post, vote } } : {}))
      syncTopicVote(postId, vote)
    }

    const before = votedPost?.vote
    // Straight away, so the count answers the click rather than the round trip.
    if (before) show(flipVote(before))

    try {
      const voteData = await toggleVoteApi(postId)

      show({ hasVoted: voteData.hasVoted, total: voteData.votes })
      set({ isVoting: false })

      // Keeps the AuthorCard beside the topic in step with the vote button.
      if (votedPost) syncVotesReceived(votedPost.post_author, voteData.hasVoted)
    } catch (error) {
      // Put back what the button showed before the click: the vote did not land,
      // and a count that stayed moved would claim otherwise.
      if (before) show(before)

      const errorMessage = (error as Error).message || 'Failed to vote on post'
      set({ error: errorMessage, isVoting: false })
      throw error
    }
  },
  transformedComments: [],
  updateComment: async (commentId: number, content: string, attachmentIds?: number[]) => {
    set({ error: undefined, isSubmitting: true })

    try {
      const updatedComment = await updateCommentApi(commentId, content, attachmentIds)

      // Update the comment in the raw comments array
      const updateCommentContent = (comments: TopicComment[]): TopicComment[] => {
        return comments.map(comment => {
          if (comment.comment_ID === commentId.toString()) {
            return {
              ...comment,
              ...updatedComment,
              // Preserve vote data and children from existing comment
              children: comment.children,
              vote: comment.vote
            }
          }
          return comment
        })
      }

      const updatedComments = updateCommentContent(get().comments)

      set(state => ({
        comments: updatedComments,
        isSubmitting: false,
        transformedComments: sortHierarchicalComments(
          transformTopicCommentsToComments(updatedComments),
          state.sortOption
        )
      }))
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to update comment'
      set({ error: errorMessage, isSubmitting: false })
      throw error
    }
  }
}))
