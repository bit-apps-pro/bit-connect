import { type Variants } from 'framer-motion'

/**
 * The page's motion vocabulary, in one place.
 *
 * Every animation here tells you where something came from: a panel arriving,
 * a card revealed by a switch. Nothing moves for decoration — a settings screen
 * that bounces is a settings screen you stop trusting.
 *
 * `MotionConfig reducedMotion="user"` wraps the page, so everything below
 * degrades to a plain opacity change for anyone who asked their system for less
 * motion.
 */

/**
 * Nothing animates a tab panel's arrival, and that is deliberate.
 *
 * antd renders only the active pane, so every visit to a tab mounts it afresh.
 * An entrance animation therefore replays on every switch, and worse, framer
 * holds the content at `opacity: 0` until its first animation frame runs —
 * behind a mount this size that landed ~110ms after the click, so the panel was
 * blank for long enough to read as the app hanging. The content is in the DOM
 * about 30ms after the click; showing it then is the fastest a tab can feel,
 * and the tab bar's own ink bar already carries the change.
 */

/**
 * A block replaced by another in the same place.
 *
 * Deliberately not `hidden`/`show`: those labels belong to blocks that reveal,
 * and a swap that borrowed them would put nested reveals through this fade too.
 */
export const swapVariants: Variants = {
  in: { opacity: 1, transition: { duration: 0.18, ease: 'easeOut' }, y: 0 },
  out: { opacity: 0, transition: { duration: 0.12, ease: 'easeIn' }, y: 6 }
}

/**
 * One tab's panel giving way to the next. Softer than swapVariants: a whole
 * form changes here, so it drifts in on a long ease-out over a small distance
 * rather than popping, and leaves quickly so the two never overlap for long.
 */
export const panelVariants: Variants = {
  in: { opacity: 1, transition: { duration: 0.32, ease: [0.32, 0.72, 0, 1] }, y: 0 },
  out: { opacity: 0, transition: { duration: 0.14, ease: 'easeIn' }, y: 4 }
}

/** A block a switch just revealed: it opens from nothing to its own height. */
export const revealVariants: Variants = {
  hidden: { height: 0, opacity: 0 },
  show: {
    height: 'auto',
    opacity: 1,
    transition: { height: { duration: 0.3, ease: 'easeOut' }, opacity: { delay: 0.1, duration: 0.2 } }
  },
  // Out faster than in: a section you just switched off should be gone, not
  // lingering while you look for what replaced it.
  exit: {
    height: 0,
    opacity: 0,
    transition: { height: { duration: 0.22, ease: 'easeIn' }, opacity: { duration: 0.12 } }
  }
}
