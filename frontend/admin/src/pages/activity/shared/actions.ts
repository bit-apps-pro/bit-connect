import { type IconType } from 'react-icons'
import {
  LuEyeOff,
  LuHistory,
  LuLock,
  LuLockOpen,
  LuPin,
  LuPinOff,
  LuRotateCcw,
  LuShieldCheck,
  LuTrash2
} from 'react-icons/lu'

/**
 * How each recorded action looks in the log.
 *
 * The wording is not here — the server sends `action_label` off the
 * ActivityActions enum, which is where it belongs and where it is translated.
 * What the server cannot send is what a row should look like, and on a screen
 * that is mostly one action repeated (a busy forum auto-hides far more than a
 * moderator does anything) an icon and a tint are what let a reader find the
 * three rows that were a decision.
 *
 * The tint groups by what the action did to the content's *availability*, which
 * is the axis a moderator reads a log along: shut it down, opened it back up,
 * or changed it. Pinning is neither, so it sits on a decorative tone rather
 * than borrowing a status colour it would misreport.
 */
export interface ActionLook {
  Icon: IconType
  /** Medallion tint: the background, and the icon that sits on it. */
  tint: string
}

const RESTRICTED = 'bc-bg-tone-amber-soft bc-text-tone-amber'
const DESTROYED = 'bc-bg-negative-soft bc-text-negative'
const OPENED = 'bc-bg-positive-soft bc-text-positive'
const NEUTRAL = 'bc-bg-surface-raised bc-text-ink-muted'

const LOOKS: Record<string, ActionLook> = {
  delete_comment: { Icon: LuTrash2, tint: DESTROYED },
  delete_post: { Icon: LuTrash2, tint: DESTROYED },
  hide: { Icon: LuEyeOff, tint: RESTRICTED },
  lock_post: { Icon: LuLock, tint: RESTRICTED },
  pin_post: { Icon: LuPin, tint: 'bc-bg-tone-violet-soft bc-text-tone-violet' },
  resolve_reports: { Icon: LuShieldCheck, tint: OPENED },
  restore: { Icon: LuRotateCcw, tint: OPENED },
  unlock_post: { Icon: LuLockOpen, tint: OPENED },
  unpin_post: { Icon: LuPinOff, tint: NEUTRAL }
}

/**
 * A slug the server added after this map was written still gets a row.
 *
 * A generic clock rather than anything that guesses at meaning: an unmapped slug
 * is one the screen knows nothing about, and a pencil or a bin against it would
 * assert what it did.
 */
const UNKNOWN: ActionLook = { Icon: LuHistory, tint: NEUTRAL }

export const lookOf = (action: string): ActionLook => LOOKS[action] ?? UNKNOWN
