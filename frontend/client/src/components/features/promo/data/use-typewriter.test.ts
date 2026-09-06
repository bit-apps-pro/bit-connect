import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import useTypewriter from './use-typewriter'

const PHRASES = ['ab', 'cd']
const OPTIONS = { deleteSpeed: 10, holdMs: 100, typeSpeed: 20 }

/**
 * Every delay in OPTIONS is a multiple of this, so no tick is ever stepped over.
 */
const STEP = 10

/**
 * Time has to move in slices with an act() flush between them: it is the flush
 * of one tick's state that lets the effect schedule the next timeout, so a
 * single big `advanceTimersByTime` fires the first timer and then finds an empty
 * queue — the loop looks stalled after one character.
 */
const advance = (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += STEP) {
    act(() => void vi.advanceTimersByTime(STEP))
  }
}

describe('useTypewriter', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts empty and types one character at a time', () => {
    const { result } = renderHook(() => useTypewriter(PHRASES, OPTIONS))

    expect(result.current.text).toBe('')

    advance(20)
    expect(result.current.text).toBe('a')

    advance(20)
    expect(result.current.text).toBe('ab')
  })

  it('holds the finished phrase before erasing it', () => {
    const { result } = renderHook(() => useTypewriter(PHRASES, OPTIONS))

    advance(40)
    expect(result.current.text).toBe('ab')

    // Still whole most of the way through the hold — the pause is the point.
    advance(90)
    expect(result.current.text).toBe('ab')
    expect(result.current.isErasing).toBe(false)

    advance(10)
    expect(result.current.isErasing).toBe(true)
  })

  it('erases a character at a time, then types the next phrase', () => {
    const { result } = renderHook(() => useTypewriter(PHRASES, OPTIONS))

    advance(140)
    expect(result.current.text).toBe('ab')

    advance(10)
    expect(result.current.text).toBe('a')

    advance(10)
    expect(result.current.text).toBe('')

    advance(20)
    expect(result.current.text).toBe('c')
  })

  it('wraps back to the first phrase after the last', () => {
    const { result } = renderHook(() => useTypewriter(PHRASES, OPTIONS))

    // Two full cycles: type (40) + hold (100) + erase (20) each.
    advance((40 + 100 + 20) * 2)
    expect(result.current.text).toBe('')

    advance(20)
    expect(result.current.text).toBe('a')
  })

  it('pins the first phrase whole and schedules nothing when paused', () => {
    const { result } = renderHook(() => useTypewriter(PHRASES, { ...OPTIONS, paused: true }))

    expect(result.current.text).toBe('ab')
    expect(vi.getTimerCount()).toBe(0)

    advance(1000)
    expect(result.current.text).toBe('ab')
  })

  it('leaves no timer behind on unmount', () => {
    const { unmount } = renderHook(() => useTypewriter(PHRASES, OPTIONS))

    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stays empty rather than throwing on an empty phrase list', () => {
    const { result } = renderHook(() => useTypewriter([], OPTIONS))

    advance(200)
    expect(result.current.text).toBe('')
  })
})
