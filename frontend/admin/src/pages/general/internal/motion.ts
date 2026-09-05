import { type Transition, type Variants } from 'framer-motion'

/**
 * The page's motion vocabulary, in one place.
 *
 * Every animation here is either telling you where something came from (a panel
 * arriving, a card revealed by a switch) or holding your eye on something that
 * changed under it (the selected choice, the phrase in the promo preview).
 * Nothing moves for decoration — a settings screen that bounces is a settings
 * screen you stop trusting.
 *
 * `MotionConfig reducedMotion="user"` wraps the page, so everything below
 * degrades to a plain opacity change for anyone who asked their system for less
 * motion.
 */

/** The one spring on this page. Soft, barely overshooting, over in ~0.4s. */
export const SOFT_SPRING: Transition = { bounce: 0.2, duration: 0.4, type: 'spring' }

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
