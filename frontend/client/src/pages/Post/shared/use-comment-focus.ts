import { commentAnchorId, commentIdFromFragment, parseCommentId } from '@features/share'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router'

import { useSinglePostStore } from '@/store/single-post.zustand'

/**
 * How long to keep waiting for the comment's element to appear.
 *
 * It is not in the DOM the moment its data arrives: every ancestor on the path
 * has to open first, and those unfold on a height transition. This is generous
 * enough to outlast that and short enough that a target which will never render
 * — deleted, or hidden from this reader — stops being waited on.
 */
const APPEAR_TIMEOUT_MS = 5000

/**
 * How long to keep looking once the server has said the comment is not there.
 *
 * Long enough for the first page of the list to land, which can still bring the
 * comment in; short enough that a deleted reply is reported almost at once.
 */
const NOT_FOUND_GRACE_MS = 1500

/** How often the scroll is re-checked against the target's current position. */
const SETTLE_INTERVAL_MS = 100

/**
 * How long the target must hold still before the scroll stops being corrected.
 *
 * Measured in time rather than animation frames. Frames were the obvious unit
 * and the wrong one: the thread grows in bursts separated by network waiting,
 * and a handful of quiet frames inside one of those gaps looks exactly like a
 * settled layout. This one held still for eight frames while another 1800px of
 * replies was still on its way, so the scroll stopped a screen and a half short
 * of the comment it was sent to.
 */
const SETTLED_FOR_MS = 700

export interface CommentFocus {
  /** The comment to mark, while the page is still on the link that named it. */
  focusedCommentId?: number
  /**
   * The link named a comment this topic cannot show: deleted, held for
   * moderation, from another topic, or not an id at all.
   */
  isMissing: boolean
}

/**
 * Take the reader to the comment a link names.
 *
 * Two forms name one: the portal's own `/{topic}/comment/{id}`, and WordPress's
 * `#comment-{id}` fragment, which links written before the path existed still
 * carry. Both land the same way.
 *
 * Three things have to happen in order and none of them is instant: the page
 * holding the comment may not be loaded, the branch leading to it starts
 * collapsed, and only once both are settled does the element exist to scroll to.
 * So this asks the store for the thread, then watches for the element rather
 * than assuming a frame is enough.
 *
 * The mark stays for as long as the address names the comment, the way a
 * permalink to a reply reads on Reddit: the URL says "this one", so the page
 * keeps saying it too. Leaving the link — "View all comments", or following
 * anything out of the thread — is what releases it.
 */
export default function useCommentFocus(isTopicReady: boolean): CommentFocus {
  const { hash } = useLocation()
  const { commentId: commentParam } = useParams()
  const fetchCommentThread = useSinglePostStore(state => state.fetchCommentThread)

  const [focusedCommentId, setFocusedCommentId] = useState<number | undefined>()
  const [isMissing, setIsMissing] = useState(false)

  // What the last run acted on. Without it, every unrelated re-render would
  // re-scroll the page out from under someone who had scrolled away.
  const handledRef = useRef<string>('')

  // The path wins over a fragment when a URL somehow carries both. Keyed on the
  // raw text rather than the parsed id, so `comment/abc` is still a link that
  // asked for something — and gets told it is not there — rather than no link.
  const target = commentParam === undefined ? hash : `comment/${commentParam}`

  useEffect(() => {
    const commentId =
      commentParam === undefined ? commentIdFromFragment(hash) : parseCommentId(commentParam)

    // No link at all — or one that left: following something out of the
    // comment releases the mark and lets the same link work again later.
    if (commentParam === undefined && !commentId) {
      handledRef.current = ''
      setFocusedCommentId(undefined)
      setIsMissing(false)

      return
    }

    // The topic itself has to be on screen first: the comment list does not
    // exist until it is, and the store has no post id to fetch against.
    if (!isTopicReady || handledRef.current === target) return
    handledRef.current = target

    // A path whose id is not an id names nothing this topic could hold.
    if (!commentId) {
      setFocusedCommentId(undefined)
      setIsMissing(true)

      return
    }

    let cancelled = false
    let frame: number | undefined
    let settleTimer: number | undefined

    const giveUp = () => {
      setFocusedCommentId(undefined)
      setIsMissing(true)
    }

    // Marked before the element is found, not after: this is what makes the row
    // on the path open itself, which is what brings the element into existence.
    setFocusedCommentId(commentId)
    setIsMissing(false)

    const findNode = () =>
      // CSS.escape guards the selector against an id that is not a bare word.
      // The ids this builds are always `comment-<digits>`, so nothing here can
      // reach it today — but a selector built by concatenation is the kind of
      // thing that stops being safe quietly, and escaping costs nothing.
      document.querySelector<HTMLElement>(`#${CSS.escape(commentAnchorId(commentId))}`)

    /**
     * Where the element sits in the document, independent of any scrolling.
     *
     * Measured by walking offsetParents rather than from a bounding rect: a rect
     * is relative to the viewport, so it keeps changing throughout a smooth
     * scroll and cannot tell "the layout moved under me" from "I am scrolling
     * towards it" — which is exactly the distinction the settle loop needs.
     */
    const documentTop = (node: HTMLElement): number => {
      let top = 0
      let element: HTMLElement | null = node

      while (element) {
        top += element.offsetTop
        element = element.offsetParent as HTMLElement | null
      }

      return top
    }

    const scrollTo = (node: HTMLElement, smooth: boolean) => {
      // `scrollIntoView` resolves against whichever ancestor actually scrolls,
      // so this works whether the portal is scrolling its layout container or
      // the page. Centred rather than aligned to the top: a reply is a fragment
      // of a conversation, and the lines above it are most of what makes it
      // make sense.
      node.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' })
    }

    const scrollWhenPresent = (deadline: number) => {
      if (cancelled) return

      const node = findNode()

      if (!node) {
        if (Date.now() < deadline) {
          frame = requestAnimationFrame(() => scrollWhenPresent(deadline))
        } else {
          // Never rendered: deleted, held for moderation, or not in this topic.
          // Said once the wait is over rather than left silent, so a reader
          // who followed a dead link is told why nothing happened.
          giveUp()
        }

        return
      }

      // Smooth scrolling is not exempt from the reduced-motion setting the way
      // browsers exempt their own fragment jumps, so it is asked for here.
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // Move straight away, so the reader is not left staring at the top of the
      // thread while the rest settles.
      scrollTo(node, smooth)

      // Then keep correcting. The target's position is still moving after it
      // first renders: the page holding it is merged into a list that re-sorts
      // around it, the branch above it unfolds on a height transition, and
      // avatars resolve at their own pace — all of which push it down by more
      // than a screen. A single scroll lands where the row was going to be
      // several hundred milliseconds ago, which is how the reader ends up
      // looking at the wrong part of a thread they were sent to.
      let lastTop = documentTop(node)
      let movedAt = Date.now()

      const settle = () => {
        if (cancelled) return

        const current = findNode()

        // The row was re-keyed or dropped out from under us; nothing to chase.
        if (!current) return

        const top = documentTop(current)

        // Sub-pixel drift is not movement. Anything larger means the layout
        // shifted and the scroll has to be redone against the new position.
        if (Math.abs(top - lastTop) > 1) {
          lastTop = top
          movedAt = Date.now()
          scrollTo(current, smooth)
        }

        // Still for long enough, or out of time — either way this stops chasing
        // and leaves the page to the reader. The mark itself stays: it belongs
        // to the address, not to the scroll.
        if (Date.now() - movedAt < SETTLED_FOR_MS && Date.now() < deadline) {
          settleTimer = window.setTimeout(settle, SETTLE_INTERVAL_MS)
        }
      }

      settleTimer = window.setTimeout(settle, SETTLE_INTERVAL_MS)
    }

    // Already loaded resolves immediately; otherwise the server is asked which
    // page holds it. Either way the wait for the element starts afterwards, so
    // the deadline covers the unfolding rather than the request.
    //
    // A "not found" answer only shortens the wait rather than ending it. The
    // store also answers false when the page-1 load running alongside overtook
    // this one, or when the request failed — and in both of those the comment
    // may still arrive with the list. The short grace covers that without
    // leaving a dead link silent for long.
    fetchCommentThread(commentId)
      .catch(() => false)
      .then(landed => {
        if (cancelled) return
        scrollWhenPresent(Date.now() + (landed ? APPEAR_TIMEOUT_MS : NOT_FOUND_GRACE_MS))
      })

    return () => {
      cancelled = true
      if (settleTimer) clearTimeout(settleTimer)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [commentParam, hash, isTopicReady, fetchCommentThread, target])

  return { focusedCommentId, isMissing }
}
