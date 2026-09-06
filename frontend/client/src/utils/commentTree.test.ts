import { describe, expect, it } from 'vitest'

import { type Comment } from '@/types/post'

import { buildCommentTree, flattenReplies, getVisualDepth, MAX_VISUAL_DEPTH } from './commentTree'

// Minimal Comment factory — only the fields the tree logic reads matter.
const makeComment = (id: number, parentId?: number, replies: Comment[] = []): Comment => ({
  avatar: '',
  content: `comment ${id}`,
  id,
  isAdmin: false,
  parentId,
  replies,
  user: `user${id}`,
  votes: 0
})

describe('getVisualDepth', () => {
  it('returns the depth when below the cap', () => {
    expect(getVisualDepth(0)).toBe(0)
    expect(getVisualDepth(2)).toBe(2)
  })

  it('caps the depth at MAX_VISUAL_DEPTH', () => {
    expect(getVisualDepth(MAX_VISUAL_DEPTH)).toBe(MAX_VISUAL_DEPTH)
    expect(getVisualDepth(MAX_VISUAL_DEPTH + 5)).toBe(MAX_VISUAL_DEPTH)
  })
})

describe('flattenReplies', () => {
  it('returns an empty array for no replies', () => {
    expect(flattenReplies([])).toEqual([])
  })

  it('flattens nested replies depth-first', () => {
    const tree: Comment[] = [
      makeComment(1, undefined, [makeComment(2, 1, [makeComment(3, 2)]), makeComment(4, 1)])
    ]
    expect(flattenReplies(tree).map(c => c.id)).toEqual([1, 2, 3, 4])
  })
})

describe('buildCommentTree', () => {
  it('returns root comments with empty replies when there are no children', () => {
    const flat = [makeComment(1), makeComment(2)]
    const tree = buildCommentTree(flat)
    expect(tree.map(c => c.id)).toEqual([1, 2])
    expect(tree[0].replies).toEqual([])
  })

  it('nests replies under their parent', () => {
    const flat = [makeComment(1), makeComment(2, 1), makeComment(3, 1), makeComment(4, 2)]
    const tree = buildCommentTree(flat)

    expect(tree.map(c => c.id)).toEqual([1])
    expect(tree[0].replies.map(c => c.id)).toEqual([2, 3])
    expect(tree[0].replies[0].replies.map(c => c.id)).toEqual([4])
  })

  it('treats a reply with an unknown parent as a root comment', () => {
    const flat = [makeComment(1), makeComment(2, 999)]
    const tree = buildCommentTree(flat)
    expect(tree.map(c => c.id)).toEqual([1, 2])
  })

  it('does not mutate the input comments', () => {
    const flat = [makeComment(1), makeComment(2, 1)]
    buildCommentTree(flat)
    // Original objects keep their (empty) replies — the tree uses copies.
    expect(flat[0].replies).toEqual([])
  })
})
