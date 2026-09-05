import { commentAnchorId, commentIdFromFragment } from '@features/share'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'

import { useSinglePostStore } from '@/store/single-post.zustand'

/** How long the linked-to reply stays marked once it has been scrolled to. */
const HIGHLIGHT_MS = 4000

/**
 * How long to keep waiting for the comment's element to appear.
 *
 * It is not in the DOM the moment its data arrives: every ancestor on the path
 * has to open first, and those unfold on a height transition. This is generous
 * enough to outlast that and short enough that a target which will never render
 * — deleted, or hidden from this reader — stops being waited on.
 */
const APPEAR_TIMEOUT_MS = 5000

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

/**
 * Take the reader to the comment a `#comment-N` link names.
 *
 * Three things have to happen in order and none of them is instant: the page
 * holding the comment may not be loaded, the branch leading to it starts
 * collapsed, and only once both are settled does the element exist to scroll to.
 * So this asks the store for the thread, then watches for the element rather
 * than assuming a frame is enough.
 *
 * Returns the comment to mark, which the list passes down so the row on the path
 * opens itself and the target draws its highlight.
 */
export default function useCommentFocus(isTopicReady: boolean): number | undefined {
  const { hash } = useLocation()
  const fetchCommentThread = useSinglePostStore(state => state.fetchCommentThread)

  const [focusedCommentId, setFocusedCommentId] = useState<number | undefined>()

  // What the last run acted on. Without it, every unrelated re-render would
  // re-scroll the page out from under someone who had scrolled away, and the
  // highlight would keep restarting.
  const handledRef = useRef<string>('')

  useEffect(() => {
    const commentId = commentIdFromFragment(hash)

    // Navigating away from the fragment — following a link out of the comment,
    // say — releases the mark and lets the same link work again later.
    if (!commentId) {
      handledRef.current = ''
      setFocusedCommentId(undefined)

      return
    }

    // The topic itself has to be on screen first: the comment list does not
    // exist until it is, and the store has no post id to fetch against.
    if (!isTopicReady || handledRef.current === hash) return
    handledRef.current = hash

    let cancelled = false
    let clearTimer: number | undefined
    let frame: number | undefined
    let settleTimer: number | undefined

    // Marked before the element is found, not after: this is what makes the row
    // on the path open itself, which is what brings the element into existence.
    setFocusedCommentId(commentId)

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
        // and leaves the page to the reader.
        if (Date.now() - movedAt < SETTLED_FOR_MS && Date.now() < deadline) {
          settleTimer = window.setTimeout(settle, SETTLE_INTERVAL_MS)

          return
        }

        // The highlight is only worth timing from the moment the reader can
        // actually see the row. Started when the element first appeared, most
        // of it would be spent off-screen on exactly the long threads where the
        // mark matters most, and the reader would arrive at a row that had
        // already stopped saying it was the one they came for.
        clearTimer = window.setTimeout(() => {
          if (!cancelled) setFocusedCommentId(undefined)
        }, HIGHLIGHT_MS)
      }

      settleTimer = window.setTimeout(settle, SETTLE_INTERVAL_MS)
    }

    // Already loaded resolves immediately; otherwise the server is asked which
    // page holds it. Either way the wait for the element starts afterwards, so
    // the deadline covers the unfolding rather than the request.
    fetchCommentThread(commentId)
      .catch(() => false)
      .then(() => {
        if (cancelled) return
        scrollWhenPresent(Date.now() + APPEAR_TIMEOUT_MS)
      })

    return () => {
      cancelled = true
      if (clearTimer) clearTimeout(clearTimer)
      if (settleTimer) clearTimeout(settleTimer)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [hash, isTopicReady, fetchCommentThread])

  return focusedCommentId
}
