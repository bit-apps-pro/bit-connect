/**
 * The frame of the bell's dropdown, shared by the panel and the bell's loading
 * state so the panel does not change size when its rows arrive. A module of
 * its own: the panel is loaded on demand, and the bell must not import it.
 *
 * One resolved width rather than a fixed width plus a max-width, so antd
 * measures exactly the box it draws. This is tidiness, not the mobile fix —
 * the clamp already produced the right *width*; what did not fit was the
 * *anchor*, which is why phones skip the dropdown entirely (see the class note
 * on NotificationBell). It still matters between md and the 22rem panel, where
 * a narrow tablet window shrinks the panel rather than letting it hang.
 */
export const PANEL_FRAME =
  'bc-w-[min(23rem,calc(100vw-2rem))] bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-shadow-xl'
