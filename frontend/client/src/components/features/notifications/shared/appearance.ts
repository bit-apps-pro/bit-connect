import { type IconType } from 'react-icons'
import {
  LuAtSign,
  LuBell,
  LuCircleCheck,
  LuHeart,
  LuMessageSquare,
  LuReply,
  LuShieldAlert,
  LuSparkles,
  LuTriangleAlert,
  LuTrophy
} from 'react-icons/lu'

/**
 * How each kind of notification looks.
 *
 * The badge is the thing doing the work here. A list where every row is an
 * avatar and a sentence forces the reader to actually read each one to find the
 * reply among the upvotes; a small coloured glyph on the corner of the avatar
 * lets them find it by shape and colour first, and read second. It is why every
 * mature notification feed converges on this pattern.
 *
 * Colour is deliberately not decorative: red is only ever moderation acting on
 * your content, amber is only ever something waiting on a decision. A reader
 * who learns that once should never be surprised by it — which is also why
 * these come from the semantic tokens rather than from a picked palette.
 */
export interface NotificationAppearance {
  /** Soft token for the badge disc behind the glyph. */
  bg: string
  /** Solid token for the glyph itself. */
  fg: string
  Icon: IconType
}

const APPEARANCE: Record<string, NotificationAppearance> = {
  badge_awarded: { bg: 'bc-bg-tone-amber-soft', fg: 'bc-text-tone-amber', Icon: LuTrophy },
  comment_reply: { bg: 'bc-bg-info-soft', fg: 'bc-text-info', Icon: LuReply },
  // The one red. Something you wrote was taken down, and nothing else in this
  // list should be able to look as serious as that does.
  content_actioned: { bg: 'bc-bg-negative-soft', fg: 'bc-text-negative', Icon: LuShieldAlert },
  mention: { bg: 'bc-bg-tone-violet-soft', fg: 'bc-text-tone-violet', Icon: LuAtSign },
  report_filed: { bg: 'bc-bg-tone-amber-soft', fg: 'bc-text-tone-amber', Icon: LuTriangleAlert },
  report_resolved: { bg: 'bc-bg-tone-amber-soft', fg: 'bc-text-tone-amber', Icon: LuCircleCheck },
  topic_new: { bg: 'bc-bg-tone-teal-soft', fg: 'bc-text-tone-teal', Icon: LuSparkles },
  topic_reply: { bg: 'bc-bg-info-soft', fg: 'bc-text-info', Icon: LuMessageSquare },
  topic_status_changed: { bg: 'bc-bg-tone-teal-soft', fg: 'bc-text-tone-teal', Icon: LuCircleCheck },
  vote_received: { bg: 'bc-bg-positive-soft', fg: 'bc-text-positive', Icon: LuHeart }
}

const FALLBACK: NotificationAppearance = {
  bg: 'bc-bg-surface-sunken',
  fg: 'bc-text-ink-muted',
  Icon: LuBell
}

/**
 * A type this build does not know about still gets a badge rather than a hole —
 * a server newer than the bundle is a normal state during a rollout.
 */
export default function appearanceFor(type: string): NotificationAppearance {
  return APPEARANCE[type] ?? FALLBACK
}
