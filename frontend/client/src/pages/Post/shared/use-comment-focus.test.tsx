import { act, cleanup, renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSinglePostStore } from '@/store/single-post.zustand'

import useCommentFocus from './use-comment-focus'

vi.mock('@/store/single-post.zustand', () => {
  const fetchCommentThread = vi.fn()

  return {
    useSinglePostStore: Object.assign(
      (selector: (state: { fetchCommentThread: unknown }) => unknown) =>
        selector({ fetchCommentThread }),
      { fetchCommentThread }
    )
  }
})

const fetchCommentThread = (
  useSinglePostStore as unknown as { fetchCommentThread: ReturnType<typeof vi.fn> }
).fetchCommentThread

const at = (hash: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[`/topic-1${hash}`]}>{children}</MemoryRouter>
  }

/** A comment row already in the document, at a fixed distance down the page. */
function placeComment(commentId: number, offsetTop = 1200) {
  const node = document.createElement('div')
  node.id = `comment-${commentId}`

  Object.defineProperty(node, 'offsetTop', { configurable: true, value: offsetTop })
  // eslint-disable-next-line unicorn/no-null -- offsetParent is null at the top of the chain
  Object.defineProperty(node, 'offsetParent', { configurable: true, value: null })

  node.scrollIntoView = vi.fn()
  document.body.append(node)

  return node
}

beforeEach(() => {
  // Fake timers cover requestAnimationFrame too, which is what the hook waits
  // on while the branch above the comment unfolds.
  vi.useFakeTimers()
  fetchCommentThread.mockResolvedValue(true)

  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never
})

afterEach(() => {
  cleanup()

  // Drained before handing the clock back: a timer left queued here fires
  // inside the next test's render and leaves React mid-update.
  act(() => {
    vi.runOnlyPendingTimers()
  })

  vi.useRealTimers()
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

/** Lets the queued promises and timers run. */
async function settle(ms = 0) {
  await act(async () => {
    await Promise.resolve()
    if (ms > 0) vi.advanceTimersByTime(ms)
    await Promise.resolve()
  })
}

// Three things have to happen in order and none is instant: the page holding
// the comment may not be loaded, the branch leading to it starts collapsed, and
// only once both are settled does the element exist to scroll to.
describe('following a #comment-N link', () => {
  it('marks the comment before its element exists', async () => {
    const { result } = renderHook(() => useCommentFocus(true), { wrapper: at('#comment-55') })

    await settle()

    // Marked first is what makes the row on the path open itself, which is what
    // brings the element into existence.
    expect(result.current).toBe(55)
  })

  it('asks the store which page holds the comment', async () => {
    renderHook(() => useCommentFocus(true), { wrapper: at('#comment-55') })

    await settle()

    expect(fetchCommentThread).toHaveBeenCalledWith(55)
  })

  // A reply is a fragment of a conversation, and the lines above it are most of
  // what makes it make sense.
  it('centres the comment rather than aligning it to the top', async () => {
    const node = placeComment(55)

    renderHook(() => useCommentFocus(true), { wrapper: at('#comment-55') })

    await settle(50)

    expect(node.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  })

  // Browsers exempt their own fragment jumps from prefers-reduced-motion; a
  // smooth scroll asked for in script is not exempt, so it has to be asked for
  // conditionally.
  it('does not scroll smoothly for a reader who asked for less motion', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never
    const node = placeComment(55)

    renderHook(() => useCommentFocus(true), { wrapper: at('#comment-55') })

    await settle(50)

    expect(node.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' })
  })

  // The comment list does not exist until the topic is on screen, and the store
  // has no post id to fetch against.
  it('waits for the topic before doing anything', async () => {
    const { result } = renderHook(() => useCommentFocus(false), { wrapper: at('#comment-55') })

    await settle(100)

    expect(fetchCommentThread).not.toHaveBeenCalled()
    expect(result.current).toBeUndefined()
  })

  it('starts once the topic arrives', async () => {
    const { rerender, result } = renderHook(({ ready }) => useCommentFocus(ready), {
      initialProps: { ready: false },
      wrapper: at('#comment-55')
    })

    await settle()
    rerender({ ready: true })
    await settle()

    expect(result.current).toBe(55)
  })
})

describe('a fragment that names no comment', () => {
  it('marks nothing and asks for nothing', async () => {
    const { result } = renderHook(() => useCommentFocus(true), { wrapper: at('#respond') })

    await settle(100)

    expect(result.current).toBeUndefined()
    expect(fetchCommentThread).not.toHaveBeenCalled()
  })

  it('ignores a fragment whose tail is not an id', async () => {
    const { result } = renderHook(() => useCommentFocus(true), { wrapper: at('#comment-abc') })

    await settle(100)

    expect(result.current).toBeUndefined()
  })

  it('does nothing at all with no fragment', async () => {
    const { result } = renderHook(() => useCommentFocus(true), { wrapper: at('') })

    await settle(100)

    expect(result.current).toBeUndefined()
  })
})

describe('the highlight', () => {
  // Timed from the moment the reader can see the row: started when the element
  // first appeared, most of it would be spent off-screen on exactly the long
  // threads where the mark matters most.
  it('is released once the scroll has settled and the mark has been shown', async () => {
    placeComment(55)

    const { result } = renderHook(() => useCommentFocus(true), { wrapper: at('#comment-55') })

    await settle(100)
    expect(result.current).toBe(55)

    // Long enough for the settle loop to give up and the highlight to expire.
    await settle(1000)
    await settle(4100)

    expect(result.current).toBeUndefined()
  })

  it('is not released while the target is still moving', async () => {
    const node = placeComment(55, 1200)

    const { result } = renderHook(() => useCommentFocus(true), { wrapper: at('#comment-55') })

    await settle(100)

    // The thread grows in bursts separated by network waiting, and the row keeps
    // being pushed down while that happens.
    for (const top of [1800, 2400, 3000, 3600, 4200]) {
      Object.defineProperty(node, 'offsetTop', { configurable: true, value: top })
      await settle(200)
    }

    expect(result.current).toBe(55)
  })

  // A single scroll lands where the row was going to be several hundred
  // milliseconds ago, which is how a reader ends up looking at the wrong part of
  // a thread they were sent to.
  it('re-scrolls when the layout pushes the target down', async () => {
    const node = placeComment(55, 1200)

    renderHook(() => useCommentFocus(true), { wrapper: at('#comment-55') })

    await settle(100)
    const afterFirst = vi.mocked(node.scrollIntoView).mock.calls.length

    Object.defineProperty(node, 'offsetTop', { configurable: true, value: 3000 })
    await settle(200)

    expect(vi.mocked(node.scrollIntoView).mock.calls.length).toBeGreaterThan(afterFirst)
  })

  // Sub-pixel drift is not movement.
  it('does not re-scroll for drift under a pixel', async () => {
    const node = placeComment(55, 1200)

    renderHook(() => useCommentFocus(true), { wrapper: at('#comment-55') })

    await settle(100)
    const afterFirst = vi.mocked(node.scrollIntoView).mock.calls.length

    Object.defineProperty(node, 'offsetTop', { configurable: true, value: 1200.4 })
    await settle(200)

    expect(vi.mocked(node.scrollIntoView).mock.calls.length).toBe(afterFirst)
  })
})

describe('leaving the comment behind', () => {
  it('stops chasing once the component is gone', async () => {
    const node = placeComment(55, 1200)

    const { unmount } = renderHook(() => useCommentFocus(true), { wrapper: at('#comment-55') })

    await settle(100)
    unmount()

    const afterUnmount = vi.mocked(node.scrollIntoView).mock.calls.length
    Object.defineProperty(node, 'offsetTop', { configurable: true, value: 5000 })
    await settle(500)

    expect(vi.mocked(node.scrollIntoView).mock.calls.length).toBe(afterUnmount)
  })

  // A target that will never render — deleted, or hidden from this reader —
  // stops being waited on.
  it('gives up on a comment whose element never appears', async () => {
    renderHook(() => useCommentFocus(true), { wrapper: at('#comment-55') })

    await settle(100)

    // Past the appearance deadline, with nothing ever having rendered.
    await settle(6000)

    // A row that turns up afterwards is not chased: the wait is over, and
    // scrolling the page then would move it under a reader who has long since
    // started reading something else.
    const node = placeComment(55)
    await settle(1000)

    expect(node.scrollIntoView).not.toHaveBeenCalled()
  })

  it('survives the store failing to find the thread', async () => {
    fetchCommentThread.mockRejectedValue(new Error('Network down'))
    const node = placeComment(55)

    const { result } = renderHook(() => useCommentFocus(true), { wrapper: at('#comment-55') })

    await settle(100)

    expect(result.current).toBe(55)
    expect(node.scrollIntoView).toHaveBeenCalled()
  })
})
