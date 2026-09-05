import { useEffect, useState } from 'react'

interface TypewriterOptions {
  /** ms per character while erasing — quicker than typing, as a real backspace is. */
  deleteSpeed?: number
  /** ms a finished phrase sits on screen before it is erased. */
  holdMs?: number
  /**
   * Pin the first phrase and never animate. Set from `prefers-reduced-motion`:
   * the promo still reads as a sentence, it just stops moving.
   */
  paused?: boolean
  /** ms per character while typing. */
  typeSpeed?: number
}

/**
 * Types each phrase out, holds it, erases it, then moves to the next — looping
 * forever.
 *
 * One `setTimeout` is alive at a time and it is derived from the current state
 * rather than from a running interval, so React's own render loop is the clock.
 * That keeps the hook honest under fake timers (see the test beside it) and
 * means an unmount can never leave a tick behind.
 */
export default function useTypewriter(phrases: string[], options: TypewriterOptions = {}) {
  const { deleteSpeed = 35, holdMs = 1700, paused = false, typeSpeed = 65 } = options

  const [index, setIndex] = useState(0)
  const [length, setLength] = useState(0)
  const [isErasing, setIsErasing] = useState(false)

  const phrase = phrases[index] ?? ''

  useEffect(() => {
    if (paused || phrases.length === 0) return

    // Fully typed: pause on it so it can actually be read.
    if (!isErasing && length >= phrase.length) {
      const holdTimer = setTimeout(() => setIsErasing(true), holdMs)

      return () => clearTimeout(holdTimer)
    }

    // Fully erased: advance immediately. No timer — the caret carries the beat,
    // and an extra pause here reads as the animation having stopped.
    if (isErasing && length === 0) {
      setIsErasing(false)
      setIndex(current => (current + 1) % phrases.length)

      return
    }

    const stepTimer = setTimeout(
      () => setLength(current => current + (isErasing ? -1 : 1)),
      isErasing ? deleteSpeed : typeSpeed
    )

    return () => clearTimeout(stepTimer)
  }, [deleteSpeed, holdMs, isErasing, length, paused, phrase.length, phrases.length, typeSpeed])

  return {
    /** True while backspacing, for callers that want to style the caret differently. */
    isErasing,
    /** `slice` rather than an index guard: a shorter `phrases` prop can only shrink it. */
    text: paused ? phrase : phrase.slice(0, length)
  }
}
