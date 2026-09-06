import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'

/**
 * Animates a theme switch as a circular reveal: the switched UI itself grows
 * out of the click that caused it, exactly as it will look, while the old
 * theme holds still beneath. No overlay, no blank disc — the circle's content
 * *is* the new theme.
 *
 * Built on the View Transitions API: the browser snapshots the outgoing frame,
 * the switch is applied inside the transition (wrapped in `flushSync`, because
 * startViewTransition expects the DOM to be final when its callback returns
 * and React 18 would otherwise batch the re-render past that point), and the
 * incoming frame is revealed through an expanding `clip-path` circle. Paced
 * deliberately: a fast wipe reads as a glitch, so the reveal takes most of a
 * second and decelerates as it lands.
 *
 * Where View Transitions are unavailable, a framer-motion ripple stands in — a
 * feathered disc in the incoming surface colour expands from the click, the
 * switch happens under full cover, and the disc fades over the switched UI.
 * Same idea, one honest limitation: the disc is a flat colour, not the UI.
 *
 * Skips itself (plain, instant switch) for `prefers-reduced-motion` — a
 * viewport-covering wipe is exactly the class of motion that setting asks to
 * remove. Keyboard selections have no pointer position; with View Transitions
 * they get a soft cross-fade, without them an instant switch — sweeping in
 * from a guessed corner reads as a glitch, not a response.
 */

/** Mirrors --bc-surface in tokens.css — the fallback disc paints the *incoming*
    theme, which is not on the page yet, so it cannot be read from a token. */
const SURFACE = { dark: '#141414', light: '#ffffff' }

/** Above everything both apps stack: antd popups sit at zIndexPopupBase 100k. */
const RIPPLE_Z_INDEX = 1_000_000

/** Where the fallback disc's feather starts, as a fraction of its radius. The
    disc is overscanned by 1/SOLID_CORE so the solid part alone covers the
    viewport. */
const SOLID_CORE = 0.72

/** How long the fallback disc holds at full cover before fading — long enough
    for the theme's re-render to commit, invisible beneath an opaque disc. */
const COVER_HOLD_MS = 90

/** The reveal's pace. Long enough to read as the theme spreading, ending in a
    glide — "very fast" was the complaint with the previous timings. */
const REVEAL_MS = 850
const REVEAL_EASING = 'cubic-bezier(0.32, 0, 0.16, 1)'

const supportsViewTransition = (doc: Document) => typeof doc.startViewTransition === 'function'

const transitionSkipped = () => {
  /* the theme is already applied; only the animation was lost */
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface ThemeSwitch {
  /** Performs the actual switch (the atom write). */
  apply: () => void
  /** Pointer position the reveal grows from; omit for a fade / plain switch. */
  origin?: { x: number; y: number }
  /** Whether the theme being switched *to* renders dark. */
  targetIsDark: boolean
}

/** The pointer position from a menu selection, or undefined for keyboard
    events (antd reports those with clientX/Y of 0). */
export function originFromEvent(event: {
  clientX?: number
  clientY?: number
}): undefined | { x: number; y: number } {
  const { clientX, clientY } = event
  if (typeof clientX !== 'number' || typeof clientY !== 'number') return undefined
  if (clientX === 0 && clientY === 0) return undefined
  return { x: clientX, y: clientY }
}

/** Radius from an origin to the farthest viewport corner. */
const coveringRadius = (origin: { x: number; y: number }) =>
  Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y)
  )

/**
 * The primary path: snapshot, switch, then reveal the new frame through a
 * growing circle — or a cross-fade when there is no origin to grow from.
 * The default view-transition animations are disabled in tokens.css so both
 * snapshots hold still while this drives the reveal.
 */
function revealWithViewTransition(
  doc: Document,
  apply: () => void,
  origin?: { x: number; y: number }
): void {
  const transition = doc.startViewTransition(() => flushSync(apply))

  transition.ready
    .then(() => {
      if (origin) {
        doc.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${origin.x}px ${origin.y}px)`,
              `circle(${coveringRadius(origin)}px at ${origin.x}px ${origin.y}px)`
            ]
          },
          { duration: REVEAL_MS, easing: REVEAL_EASING, pseudoElement: '::view-transition-new(root)' }
        )
      } else {
        doc.documentElement.animate(
          { opacity: [0, 1] },
          { duration: 400, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' }
        )
      }
    })
    // `ready` rejects when the browser skips the transition (e.g. a second
    // switch lands mid-flight). The theme has still been applied — losing the
    // animation is the correct outcome.
    .catch(transitionSkipped)
}

interface RippleState {
  apply: () => void
  covered: boolean
  isDark: boolean
  radius: number
  x: number
  y: number
}

export default function useThemeSwitchRipple() {
  const [state, setState] = useState<RippleState | undefined>()

  const startSwitch = useCallback(
    ({ apply, origin, targetIsDark }: ThemeSwitch) => {
      if (prefersReducedMotion() || typeof document === 'undefined') {
        apply()
        return
      }

      if (supportsViewTransition(document)) {
        revealWithViewTransition(document, apply, origin)
        return
      }

      // Fallback ripple. One switch at a time: a second click mid-ripple
      // applies instantly rather than stacking discs mid-transition.
      if (!origin || state !== undefined) {
        apply()
        return
      }
      // Overscanned so the disc's solid core (not its feathered edge) is what
      // covers the screen.
      const radius = coveringRadius(origin) / SOLID_CORE
      setState({ apply, covered: false, isDark: targetIsDark, radius, x: origin.x, y: origin.y })
    },
    [state]
  )

  const surface = state && (state.isDark ? SURFACE.dark : SURFACE.light)

  const ripple =
    typeof document === 'undefined'
      ? undefined
      : createPortal(
          <AnimatePresence>
            {state && (
              <motion.div
                animate={{ scale: 1 }}
                exit={{ opacity: 0 }}
                initial={{ scale: 0 }}
                onAnimationComplete={() => {
                  if (state.covered) return
                  // Full cover: swap the theme beneath the disc, hold a beat
                  // so the re-render commits, then let AnimatePresence fade
                  // the disc over the already-switched UI.
                  state.apply()
                  setState({ ...state, covered: true })
                  setTimeout(() => setState(undefined), COVER_HOLD_MS)
                }}
                style={{
                  background: `radial-gradient(circle, ${surface} ${SOLID_CORE * 100}%, transparent 100%)`,
                  height: state.radius * 2,
                  left: state.x - state.radius,
                  pointerEvents: 'none',
                  position: 'fixed',
                  top: state.y - state.radius,
                  width: state.radius * 2,
                  zIndex: RIPPLE_Z_INDEX
                }}
                transition={{
                  opacity: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
                  scale: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
                }}
              />
            )}
          </AnimatePresence>,
          document.body
        )

  return { ripple, startSwitch }
}
