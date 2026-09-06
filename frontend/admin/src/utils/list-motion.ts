import { useReducedMotion } from 'framer-motion'

/**
 * The motion shared by the moderation lists, in one place.
 *
 * It was written for the report queue, where the thing worth animating is not
 * the arrival of a card but its departure: pressing Keep or Remove and watching
 * the item lift away while the rest close the gap is the confirmation that the
 * decision landed. Activity has no departures — nothing is ever removed from a
 * log — so there it is the entrance and the layout shift on paging that carry,
 * and the exit only runs when a filter swaps one set of rows for another.
 *
 * Every value collapses under `prefers-reduced-motion`. The entrance is dropped
 * outright rather than shortened — a reader who asked for less movement is not
 * asking for faster movement — while the exit stays as a plain fade, because
 * something has to mark that a card left or the list appears to jump.
 *
 * `layout` is opt-out, because it only pays for itself in a list whose items
 * move relative to each other. Tracking it makes framer measure and project
 * every element it is set on, and the queue earns that: closing the gap under a
 * departing card is the whole point there. A log has no departures and no
 * reordering — rows arrive at the top and stay put — so on Activity the same
 * bookkeeping runs over twenty rows to animate a shift that never happens.
 */
export function useCardMotion({ layout = true }: { layout?: boolean } = {}) {
  const shouldReduceMotion = useReducedMotion()

  return (index: number) => ({
    animate: { opacity: 1, y: 0 },
    exit: shouldReduceMotion
      ? { opacity: 0, transition: { duration: 0.12 } }
      : { opacity: 0, scale: 0.97, transition: { duration: 0.2, ease: 'easeIn' as const }, y: -8 },
    initial: shouldReduceMotion ? false : { opacity: 0, y: 12 },
    // Position only, not size. Cards below a departing one slide up into the
    // gap either way, but animating the box as well means framer scales it
    // between two heights, and every line of text inside stretches with it for
    // the duration — most visible on the one interaction that changes a card's
    // height, the excerpt's "Show all".
    layout: layout && !shouldReduceMotion ? ('position' as const) : false,
    transition: {
      // Capped so a full page of twenty does not spend a second and a half
      // arriving; by the sixth card the stagger has done its job.
      default: { delay: Math.min(index * 0.04, 0.24), duration: 0.28, ease: 'easeOut' as const },
      // Its own timing, or a card would wait out the entrance delay above
      // before closing a gap that opened well after it arrived.
      layout: { duration: 0.25, ease: 'easeOut' as const }
    }
  })
}

/** The header count and the empty state, which swap rather than travel. */
export function useSwapMotion() {
  const shouldReduceMotion = useReducedMotion()

  return {
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: shouldReduceMotion ? 0 : -6 },
    initial: shouldReduceMotion ? false : { opacity: 0, y: 6 },
    transition: { duration: 0.18, ease: 'easeOut' as const }
  }
}
