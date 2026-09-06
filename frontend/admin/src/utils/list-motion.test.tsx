import { renderHook } from '@testing-library/react'
import { useReducedMotion } from 'framer-motion'
import { describe, expect, it, vi } from 'vitest'

import { useCardMotion, useSwapMotion } from './list-motion'

vi.mock('framer-motion', () => ({ useReducedMotion: vi.fn() }))

const withReducedMotion = (reduced: boolean) => vi.mocked(useReducedMotion).mockReturnValue(reduced)

describe('useCardMotion', () => {
  it('staggers the cards as they arrive', () => {
    withReducedMotion(false)
    const motion = renderHook(() => useCardMotion()).result.current

    expect(motion(0).transition.default.delay).toBe(0)
    expect(motion(1).transition.default.delay).toBeCloseTo(0.04)
  })

  // A full page of twenty should not spend a second and a half arriving; by the
  // sixth card the stagger has done its job.
  it('stops staggering once the effect has landed', () => {
    withReducedMotion(false)
    const motion = renderHook(() => useCardMotion()).result.current

    expect(motion(6).transition.default.delay).toBe(0.24)
    expect(motion(20).transition.default.delay).toBe(0.24)
  })

  // A reader who asked for less movement is not asking for faster movement, so
  // the entrance is dropped outright rather than shortened.
  it('drops the entrance entirely under reduced motion', () => {
    withReducedMotion(true)

    expect(renderHook(() => useCardMotion()).result.current(0).initial).toBe(false)
  })

  // Something has to mark that a card left, or the list appears to jump.
  it('keeps a plain fade on the way out under reduced motion', () => {
    withReducedMotion(true)
    const exit = renderHook(() => useCardMotion()).result.current(0).exit

    expect(exit).toEqual({ opacity: 0, transition: { duration: 0.12 } })
    expect(exit).not.toHaveProperty('y')
    expect(exit).not.toHaveProperty('scale')
  })

  it('lifts a card away when motion is welcome', () => {
    withReducedMotion(false)
    const exit = renderHook(() => useCardMotion()).result.current(0).exit

    expect(exit).toMatchObject({ opacity: 0, scale: 0.97, y: -8 })
  })

  // Position only, not size: animating the box means framer scales it between
  // two heights and every line of text inside stretches for the duration.
  it('tracks position rather than the whole box', () => {
    withReducedMotion(false)

    expect(renderHook(() => useCardMotion()).result.current(0).layout).toBe('position')
  })

  // Tracking layout makes framer measure and project every element it is set
  // on. A log has no departures and no reordering, so it opts out.
  it('can be told not to track layout at all', () => {
    withReducedMotion(false)

    expect(renderHook(() => useCardMotion({ layout: false })).result.current(0).layout).toBe(false)
  })

  it('never tracks layout under reduced motion', () => {
    withReducedMotion(true)

    expect(renderHook(() => useCardMotion()).result.current(0).layout).toBe(false)
  })

  // A card would otherwise wait out the entrance delay before closing a gap
  // that opened well after it arrived.
  it('gives the gap-closing its own timing', () => {
    withReducedMotion(false)
    const motion = renderHook(() => useCardMotion()).result.current(6)

    expect(motion.transition.layout.duration).toBe(0.25)
    expect(motion.transition.layout).not.toHaveProperty('delay')
  })

  it('always settles at rest', () => {
    for (const reduced of [true, false]) {
      withReducedMotion(reduced)

      expect(renderHook(() => useCardMotion()).result.current(3).animate).toEqual({
        opacity: 1,
        y: 0
      })
    }
  })
})

describe('useSwapMotion', () => {
  it('swaps rather than travels', () => {
    withReducedMotion(false)
    const motion = renderHook(() => useSwapMotion()).result.current

    expect(motion.initial).toEqual({ opacity: 0, y: 6 })
    expect(motion.exit).toEqual({ opacity: 0, y: -6 })
  })

  it('fades in place under reduced motion', () => {
    withReducedMotion(true)
    const motion = renderHook(() => useSwapMotion()).result.current

    expect(motion.initial).toBe(false)
    expect(motion.exit).toEqual({ opacity: 0, y: 0 })
  })
})
