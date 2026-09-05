import { type Comment } from '@/types/post'

export const MAX_VISUAL_DEPTH = 3

/**
 * Returns the visual indentation depth, capped at MAX_VISUAL_DEPTH.
 *
 * @param depth - The actual nesting depth of the comment
 * @returns The visual depth capped at MAX_VISUAL_DEPTH
 */
export function getVisualDepth(depth: number): number {
  return Math.min(depth, MAX_VISUAL_DEPTH)
}

/**
 * Recursively collects all descendant replies into a flat array (depth-first order).
 * Used at max depth so that further replies render as siblings instead of nesting deeper.
 *
 * @param comments - Array of reply comments to flatten
 * @returns Flat array containing all descendants
 */
export function flattenReplies(comments: Comment[]): Comment[] {
  const result: Comment[] = []
  for (const comment of comments) {
    result.push(comment)
    if (comment.replies?.length) {
      result.push(...flattenReplies(comment.replies))
    }
  }
  return result
}

/**
 * Whether any of these replies — at any depth — is the given comment.
 *
 * Replies start collapsed, so a link to one buried three levels down opens a
 * page where the target is not in the DOM to scroll to. Every comment on the
 * path asks this about its own subtree and opens itself when the answer is yes,
 * which unfolds exactly the one branch that leads to the target and leaves the
 * rest of the thread as the reader would otherwise have found it.
 *
 * @param replies   the subtree to search
 * @param commentId the comment being looked for
 */
export function repliesContain(replies: Comment[] | undefined, commentId: number): boolean {
  if (!replies?.length) return false

  return replies.some(reply => reply.id === commentId || repliesContain(reply.replies, commentId))
}

/**
 * Builds a nested comment tree structure from a flat list of comments.
 *
 * @param comments - Flat array of comments
 * @returns Nested array of comments with replies
 */
export function buildCommentTree(comments: Comment[]): Comment[] {
  const commentMap = new Map<number, Comment>()
  const rootComments: Comment[] = []

  // First pass: create a map of all comments
  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] })
  })

  // Second pass: build the tree structure
  comments.forEach(comment => {
    const commentNode = commentMap.get(comment.id)!

    if (comment.parentId) {
      // This is a reply, find its parent
      const parent = commentMap.get(comment.parentId)
      if (parent) {
        parent.replies.push(commentNode)
      } else {
        // Parent not found, treat as root comment
        rootComments.push(commentNode)
      }
    } else {
      // This is a root comment
      rootComments.push(commentNode)
    }
  })

  return rootComments
}
